const path = require('path');
console.log('--- PATH DEBUGGER ---');
console.log('Current File:', __filename);
console.log('Looking for DB at:', path.resolve(__dirname, '../config/db.js'));

const express = require('express');
const router = express.Router();
// We use '../' to go up one level from the 'routes' folder to 'config'
const db = require('../config/db.js');

// 1. GET: Fetch all active appointments (Includes Patient Name)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                a.appointment_id,
                a.patient_id,
                p.name AS patient_name,
                CAST(a.appointment_date AS CHAR) AS appointment_date,
                CAST(a.appointment_time AS CHAR) AS appointment_time,
                a.purpose_of_visit,
                a.appointment_status
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.patient_id
        `);
        res.json(rows);
    } catch (error) {
        console.error('❌ MARIADB GET ERROR:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. POST: New scheduled session (Combined validation and insert)
router.post('/', async (req, res) => {
    const { patient_id, appointment_date, appointment_time, purpose_of_visit, appointment_status } = req.body;

    // 1. Validation
    if (!patient_id || !appointment_date || !appointment_time || !purpose_of_visit) {
        return res.status(400).json({ error: 'Please provide all operational fields.' });
    }

    try {
        // 2. Check if the slot is ALREADY taken
        const [existing] = await db.query(
            'SELECT * FROM appointments WHERE appointment_date = ? AND appointment_time = ? AND appointment_status != "Cancelled"',
            [appointment_date, appointment_time]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'This time slot has just been reserved by another user.' });
        }

        // 3. Perform the insert
        const queryText = `
            INSERT INTO appointments (patient_id, appointment_date, appointment_time, purpose_of_visit, appointment_status) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.query(queryText, [
            patient_id, 
            appointment_date, 
            appointment_time, 
            purpose_of_visit, 
            appointment_status || 'Pending'
        ]);
        
        res.status(201).json({ 
            message: 'Appointment slot successfully reserved!', 
            appointmentId: result.insertId 
        });
    } catch (error) {
        console.error('❌ Error writing appointment record to MariaDB:', error.message);
        res.status(500).json({ error: 'Failed to write session record to the database.' });
    }
});

// 3. PUT: Edit an existing appointment (date/time/purpose/status)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { patient_id, appointment_date, appointment_time, purpose_of_visit, appointment_status } = req.body;

    if (!patient_id || !appointment_date || !appointment_time || !purpose_of_visit) {
        return res.status(400).json({ error: 'Please provide all operational fields.' });
    }

    try {
        // Only block the move if some OTHER appointment already holds that slot —
        // excluding the row we're editing so you can keep (or just tweak) its own time.
        const [existing] = await db.query(
            `SELECT * FROM appointments
             WHERE appointment_date = ? AND appointment_time = ? AND appointment_status != 'Cancelled'
             AND appointment_id != ?`,
            [appointment_date, appointment_time, id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'This time slot is already reserved by another appointment.' });
        }

        const [result] = await db.query(
            `UPDATE appointments
             SET patient_id = ?, appointment_date = ?, appointment_time = ?, purpose_of_visit = ?, appointment_status = ?
             WHERE appointment_id = ?`,
            [patient_id, appointment_date, appointment_time, purpose_of_visit, appointment_status || 'Pending', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }

        res.json({
            message: 'Appointment updated!',
            appointment_id: Number(id),
            patient_id,
            appointment_date,
            appointment_time,
            purpose_of_visit,
            appointment_status: appointment_status || 'Pending',
        });
    } catch (error) {
        console.error('❌ Error updating appointment:', error.message);
        res.status(500).json({ error: 'Failed to update appointment record.' });
    }
});

// 4. PATCH: Quick status-only update
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { appointment_status } = req.body;

    if (!appointment_status) {
        return res.status(400).json({
            error: 'appointment_status is required.'
        });
    }

    try {
        // Get the existing appointment first
        const [appointments] = await db.query(
            `SELECT
                appointment_id,
                patient_id,
                appointment_date,
                appointment_time,
                appointment_status
             FROM appointments
             WHERE appointment_id = ?`,
            [id]
        );

        if (appointments.length === 0) {
            return res.status(404).json({
                error: 'Appointment not found.'
            });
        }

        const appointment = appointments[0];

        const oldStatus = String(
            appointment.appointment_status || ''
        ).trim().toLowerCase();

        const newStatus = String(
            appointment_status
        ).trim();

        // Update appointment status
        const [result] = await db.query(
            `UPDATE appointments
             SET appointment_status = ?
             WHERE appointment_id = ?`,
            [newStatus, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Appointment not found.'
            });
        }

        // Only create a notification when the status actually changes
        if (oldStatus !== newStatus.toLowerCase()) {

            let title = '';
            let body = '';
            let type = '';

            const date = String(appointment.appointment_date || '');
            const time = String(appointment.appointment_time || '');

            switch (newStatus.toLowerCase()) {

                case 'approved':
                    type = 'appointment_approved';
                    title = 'Appointment Approved';
                    body =
                        `Your appointment on ${date} at ${time} has been approved.`;
                    break;

                case 'rejected':
                    type = 'appointment_rejected';
                    title = 'Appointment Rejected';
                    body =
                        `Your appointment on ${date} at ${time} has been rejected.`;
                    break;

                case 'cancelled':
                    type = 'appointment_cancelled';
                    title = 'Appointment Cancelled';
                    body =
                        `Your appointment on ${date} at ${time} has been cancelled.`;
                    break;

                case 'completed':
                    type = 'appointment_completed';
                    title = 'Appointment Completed';
                    body =
                        `Your appointment on ${date} at ${time} has been marked as completed.`;
                    break;
            }

            // Insert notification only for supported statuses
            if (type && title && body) {
                await db.query(
                    `INSERT INTO notifications
                        (patient_id, type, title, body)
                     VALUES (?, ?, ?, ?)`,
                    [
                        appointment.patient_id,
                        type,
                        title,
                        body
                    ]
                );

                console.log(
                    `🔔 Notification created for patient ${appointment.patient_id}: ${title}`
                );
            }
        }

        res.json({
            appointment_id: Number(id),
            appointment_status: newStatus
        });

    } catch (error) {
        console.error(
            '❌ Error updating appointment status:',
            error.message
        );

        res.status(500).json({
            error: 'Failed to update appointment status.'
        });
    }
});

// 5. GET: Fetch appointments for one patient
router.get('/patient/:patient_id', async (req, res) => {
    const { patient_id } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT 
                a.appointment_id,
                a.patient_id,
                p.name AS patient_name,
                CAST(a.appointment_date AS CHAR) AS appointment_date,
                CAST(a.appointment_time AS CHAR) AS appointment_time,
                a.purpose_of_visit,
                a.appointment_status
            FROM appointments a
            LEFT JOIN patients p 
                ON a.patient_id = p.patient_id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
        `, [patient_id]);

        res.json(rows);

    } catch (error) {
        console.error(
            '❌ MARIADB GET PATIENT APPOINTMENTS ERROR:',
            error.message
        );

        res.status(500).json({
            error: 'Failed to fetch patient appointments.'
        });
    }
});

// 6. POST: Check for upcoming appointment reminders
router.post('/reminders/check', async (req, res) => {
    try {
        const [appointments] = await db.query(`
            SELECT
                a.appointment_id,
                a.patient_id,
                a.appointment_date,
                a.appointment_time,
                a.appointment_status
            FROM appointments a
            WHERE
                LOWER(a.appointment_status) = 'approved'
                AND TIMESTAMP(a.appointment_date, a.appointment_time)
                    BETWEEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
                    AND DATE_ADD(
                        DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR),
                        INTERVAL 24 HOUR
                    )
        `);

        let created = 0;

        for (const appointment of appointments) {

            // Check if a reminder already exists for this appointment
            const [existing] = await db.query(
                `SELECT notification_id
                 FROM notifications
                 WHERE appointment_id = ?
                   AND type = 'appointment_reminder'
                 LIMIT 1`,
                [appointment.appointment_id]
            );

            if (existing.length > 0) {
                continue;
            }

            // Format appointment date
            const date = new Date(appointment.appointment_date);

            const formattedDate = date.toLocaleDateString(
                'en-US',
                {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC'
                }
            );

            // Format appointment time
            const timeParts = String(
                appointment.appointment_time
            ).slice(0, 8).split(':');

            let hours = Number(timeParts[0]);
            const minutes = timeParts[1];

            const period = hours >= 12 ? 'PM' : 'AM';

            hours = hours % 12 || 12;

            const formattedTime =
                `${hours}:${minutes} ${period}`;

            // Create notification
            await db.query(
                `INSERT INTO notifications
                    (patient_id, appointment_id, type, title, body)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    appointment.patient_id,
                    appointment.appointment_id,
                    'appointment_reminder',
                    'Appointment Reminder',
                    `Your appointment is scheduled for ${formattedDate} at ${formattedTime}.`
                ]
            );

            created++;
        }

        res.json({
            success: true,
            appointments_found: appointments.length,
            reminders_created: created
        });

    } catch (error) {
        console.error(
            '❌ Error checking appointment reminders:',
            error.message
        );

        res.status(500).json({
            error: 'Failed to check appointment reminders.'
        });
    }
});

module.exports = router;