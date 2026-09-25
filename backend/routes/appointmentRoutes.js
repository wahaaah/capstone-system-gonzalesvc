const path = require('path');

console.log('--- PATH DEBUGGER ---');
console.log('Current File:', __filename);
console.log(
    'Looking for DB at:',
    path.resolve(__dirname, '../config/db.js')
);

const express = require('express');
const router = express.Router();

// We use '../' to go up one level from the 'routes' folder to 'config'
const db = require('../config/db.js');


// ============================================================
// HELPER: FORMAT TIME TO 12-HOUR FORMAT
// ============================================================

function formatTime12Hour(timeValue) {
    const timeString = String(timeValue || '').slice(0, 8);

    const [hourString, minuteString] = timeString.split(':');

    let hour = Number(hourString);
    const minute = minuteString || '00';

    if (Number.isNaN(hour)) {
        return String(timeValue || '');
    }

    const period = hour >= 12 ? 'PM' : 'AM';

    hour = hour % 12 || 12;

    return `${hour}:${minute} ${period}`;
}


// ============================================================
// HELPER: FORMAT DATE WITHOUT GMT / UTC CONVERSION
// ============================================================

function formatDateLong(dateValue) {
    const dateString = String(dateValue || '').slice(0, 10);

    const [year, month, day] = dateString.split('-');

    const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];

    const monthNumber = Number(month);

    if (
        !year ||
        !month ||
        !day ||
        Number.isNaN(monthNumber) ||
        monthNumber < 1 ||
        monthNumber > 12
    ) {
        return dateString;
    }

    return `${monthNames[monthNumber - 1]} ${Number(day)}, ${year}`;
}


// ============================================================
// 1. GET: Fetch all active appointments
// Includes Patient Name
// ============================================================

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
            LEFT JOIN patients p 
                ON a.patient_id = p.patient_id
        `);

        res.json(rows);

    } catch (error) {

        console.error(
            '❌ MARIADB GET ERROR:',
            error.message
        );

        res.status(500).json({
            error: error.message
        });
    }
});


// ============================================================
// 2. POST: New scheduled session
// Combined validation and insert
// ============================================================

router.post('/', async (req, res) => {

    const {
        patient_id,
        appointment_date,
        appointment_time,
        purpose_of_visit,
        appointment_status
    } = req.body;

    // Validation
    if (
        !patient_id ||
        !appointment_date ||
        !appointment_time ||
        !purpose_of_visit
    ) {
        return res.status(400).json({
            error: 'Please provide all operational fields.'
        });
    }

    try {

        // Check if the slot is already taken
        const [existing] = await db.query(
            `SELECT *
             FROM appointments
             WHERE appointment_date = ?
               AND appointment_time = ?
               AND appointment_status != "Cancelled"`,
            [
                appointment_date,
                appointment_time
            ]
        );

        if (existing.length > 0) {

            return res.status(409).json({
                error:
                    'This time slot has just been reserved by another user.'
            });
        }

        // Perform the insert
        const queryText = `
            INSERT INTO appointments
                (
                    patient_id,
                    appointment_date,
                    appointment_time,
                    purpose_of_visit,
                    appointment_status
                )
            VALUES (?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(
            queryText,
            [
                patient_id,
                appointment_date,
                appointment_time,
                purpose_of_visit,
                appointment_status || 'Pending'
            ]
        );

        res.status(201).json({

            message:
                'Appointment slot successfully reserved!',

            appointmentId:
                result.insertId
        });

    } catch (error) {

        console.error(
            '❌ Error writing appointment record to MariaDB:',
            error.message
        );

        res.status(500).json({
            error:
                'Failed to write session record to the database.'
        });
    }
});


// ============================================================
// 3. PUT: Edit an existing appointment
// Date / Time / Purpose / Status
// ============================================================

router.put('/:id', async (req, res) => {

    const { id } = req.params;

    const {
        patient_id,
        appointment_date,
        appointment_time,
        purpose_of_visit,
        appointment_status
    } = req.body;

    // Validation
    if (
        !patient_id ||
        !appointment_date ||
        !appointment_time ||
        !purpose_of_visit
    ) {
        return res.status(400).json({
            error:
                'Please provide all operational fields.'
        });
    }

    try {

        // --------------------------------------------------
        // GET THE EXISTING APPOINTMENT FIRST
        // --------------------------------------------------

        const [appointments] = await db.query(
            `SELECT
                appointment_id,
                patient_id,
                appointment_date,
                appointment_time,
                purpose_of_visit,
                appointment_status
             FROM appointments
             WHERE appointment_id = ?`,
            [id]
        );

        if (appointments.length === 0) {

            return res.status(404).json({
                error:
                    'Appointment not found.'
            });
        }

        const oldAppointment =
            appointments[0];

        const oldStatus =
            String(
                oldAppointment.appointment_status || ''
            )
                .trim()
                .toLowerCase();

        const newStatus =
            String(
                appointment_status || 'Pending'
            )
                .trim();

        const newStatusLower =
            newStatus.toLowerCase();


        // --------------------------------------------------
        // CHECK IF THE NEW TIME SLOT IS ALREADY TAKEN
        // --------------------------------------------------

        const [existing] = await db.query(
            `SELECT *
             FROM appointments
             WHERE appointment_date = ?
               AND appointment_time = ?
               AND appointment_status != 'Cancelled'
               AND appointment_id != ?`,
            [
                appointment_date,
                appointment_time,
                id
            ]
        );

        if (existing.length > 0) {

            return res.status(409).json({
                error:
                    'This time slot is already reserved by another appointment.'
            });
        }


        // --------------------------------------------------
        // UPDATE APPOINTMENT
        // --------------------------------------------------

        const [result] = await db.query(
            `UPDATE appointments
             SET
                patient_id = ?,
                appointment_date = ?,
                appointment_time = ?,
                purpose_of_visit = ?,
                appointment_status = ?
             WHERE appointment_id = ?`,
            [
                patient_id,
                appointment_date,
                appointment_time,
                purpose_of_visit,
                newStatus,
                id
            ]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                error:
                    'Appointment not found.'
            });
        }


        // --------------------------------------------------
        // CREATE NOTIFICATION ONLY WHEN STATUS CHANGED
        // --------------------------------------------------

        if (oldStatus !== newStatusLower) {

            let type = '';
            let title = '';
            let body = '';


            // --------------------------------------------------
            // FORMAT DATE AND TIME
            // --------------------------------------------------

            const formattedDate =
                formatDateLong(
                    appointment_date
                );

            const formattedTime =
                formatTime12Hour(
                    appointment_time
                );


            // --------------------------------------------------
            // APPROVED / CONFIRMED
            // --------------------------------------------------

            switch (newStatusLower) {

                case 'approved':
                case 'confirmed':
                case 'accepted':

                    type =
                        'appointment_approved';

                    title =
                        'Appointment Confirmed';

                    body =
                        `Your appointment on ${formattedDate} at ${formattedTime} has been confirmed.`;

                    break;


                // --------------------------------------------------
                // REJECTED
                // --------------------------------------------------

                case 'rejected':
                case 'declined':

                    type =
                        'appointment_rejected';

                    title =
                        'Appointment Rejected';

                    body =
                        `Your appointment on ${formattedDate} at ${formattedTime} has been rejected.`;

                    break;


                // --------------------------------------------------
                // CANCELLED
                // --------------------------------------------------

                case 'cancelled':
                case 'canceled':

                    type =
                        'appointment_cancelled';

                    title =
                        'Appointment Cancelled';

                    body =
                        `Your appointment on ${formattedDate} at ${formattedTime} has been cancelled.`;

                    break;


                // --------------------------------------------------
                // COMPLETED
                // --------------------------------------------------

                case 'completed':

                    type =
                        'appointment_completed';

                    title =
                        'Appointment Completed';

                    body =
                        `Your appointment on ${formattedDate} at ${formattedTime} has been marked as completed.`;

                    break;
            }


            // --------------------------------------------------
            // INSERT NOTIFICATION
            // --------------------------------------------------

            if (
                type &&
                title &&
                body
            ) {

                await db.query(
                    `INSERT INTO notifications
                        (
                            patient_id,
                            appointment_id,
                            type,
                            title,
                            body
                        )
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        patient_id,
                        Number(id),
                        type,
                        title,
                        body
                    ]
                );

                console.log(
                    `🔔 Notification created for patient ${patient_id}: ${title}`
                );
            }
        }


        // --------------------------------------------------
        // RESPONSE
        // --------------------------------------------------

        res.json({

            message:
                'Appointment updated!',

            appointment_id:
                Number(id),

            patient_id,

            appointment_date,

            appointment_time,

            purpose_of_visit,

            appointment_status:
                newStatus
        });

    } catch (error) {

        console.error(
            '❌ Error updating appointment:',
            error.message
        );

        res.status(500).json({
            error:
                'Failed to update appointment record.'
        });
    }
});


// ============================================================
// 4. PATCH: Quick status-only update
// ============================================================

router.patch('/:id', async (req, res) => {

    const { id } = req.params;

    const {
        appointment_status
    } = req.body;

    if (!appointment_status) {

        return res.status(400).json({
            error:
                'appointment_status is required.'
        });
    }

    try {

        // --------------------------------------------------
        // GET THE EXISTING APPOINTMENT FIRST
        // --------------------------------------------------

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
                error:
                    'Appointment not found.'
            });
        }

        const appointment =
            appointments[0];


        const oldStatus =
            String(
                appointment.appointment_status || ''
            )
                .trim()
                .toLowerCase();

        const newStatus =
            String(
                appointment_status
            )
                .trim();

        const newStatusLower =
            newStatus.toLowerCase();


        // --------------------------------------------------
        // UPDATE APPOINTMENT STATUS
        // --------------------------------------------------

        const [result] = await db.query(
            `UPDATE appointments
             SET appointment_status = ?
             WHERE appointment_id = ?`,
            [
                newStatus,
                id
            ]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                error:
                    'Appointment not found.'
            });
        }


        // --------------------------------------------------
        // CREATE NOTIFICATION ONLY WHEN STATUS CHANGES
        // --------------------------------------------------

        if (
            oldStatus !== newStatusLower
        ) {

            let title = '';
            let body = '';
            let type = '';


            // --------------------------------------------------
            // FORMAT DATE AND TIME
            // --------------------------------------------------

            const formattedDate =
                formatDateLong(
                    appointment.appointment_date
                );

            const formattedTime =
                formatTime12Hour(
                    appointment.appointment_time
                );


            // --------------------------------------------------
            // STATUS NOTIFICATIONS
            // --------------------------------------------------

            switch (newStatusLower) {

                case 'approved':
                case 'confirmed':
                case 'accepted':

                    type =
                        'appointment_approved';

                    title =
                        'Appointment Confirmed';

                    body =
                        `Your appointment on ${formattedDate} at ${formattedTime} has been confirmed.`;

                    break;


                case 'rejected':
                case 'declined':

                    type =
                        'appointment_rejected';

                    title =
                        'Appointment Rejected';

                    body =
                        `Your appointment on ${formattedDate} at ${formattedTime} has been rejected.`;

                    break;


                case 'cancelled':
                case 'canceled':

                    type =
                        'appointment_cancelled';

                    title =
                        'Appointment Cancelled';

                    body =
                        `Your appointment on ${formattedDate} at ${formattedTime} has been cancelled.`;

                    break;


                case 'completed':

                    type =
                        'appointment_completed';

                    title =
                        'Appointment Completed';

                    body =
                        `Your appointment on ${formattedDate} at ${formattedTime} has been marked as completed.`;

                    break;
            }


            // --------------------------------------------------
            // INSERT NOTIFICATION
            // --------------------------------------------------

            if (
                type &&
                title &&
                body
            ) {

                await db.query(
                    `INSERT INTO notifications
                        (
                            patient_id,
                            appointment_id,
                            type,
                            title,
                            body
                        )
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        appointment.patient_id,
                        Number(id),
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


        // --------------------------------------------------
        // RESPONSE
        // --------------------------------------------------

        res.json({

            appointment_id:
                Number(id),

            appointment_status:
                newStatus
        });

    } catch (error) {

        console.error(
            '❌ Error updating appointment status:',
            error.message
        );

        res.status(500).json({
            error:
                'Failed to update appointment status.'
        });
    }
});


// ============================================================
// 5. GET: Fetch appointments for one patient
// ============================================================

router.get(
    '/patient/:patient_id',
    async (req, res) => {

        const { patient_id } =
            req.params;

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
                ORDER BY
                    a.appointment_date ASC,
                    a.appointment_time ASC
            `, [
                patient_id
            ]);

            res.json(rows);

        } catch (error) {

            console.error(
                '❌ MARIADB GET PATIENT APPOINTMENTS ERROR:',
                error.message
            );

            res.status(500).json({
                error:
                    'Failed to fetch patient appointments.'
            });
        }
    }
);


// ============================================================
// 6. POST: Check for upcoming appointment reminders
// ============================================================

router.post(
    '/reminders/check',
    async (req, res) => {

        try {

            const [appointments] =
                await db.query(`
                    SELECT
                        a.appointment_id,
                        a.patient_id,
                        a.appointment_date,
                        a.appointment_time,
                        a.appointment_status
                    FROM appointments a
                    WHERE
                        LOWER(a.appointment_status) = 'approved'
                        AND TIMESTAMP(
                            a.appointment_date,
                            a.appointment_time
                        )
                        BETWEEN
                            DATE_ADD(
                                UTC_TIMESTAMP(),
                                INTERVAL 8 HOUR
                            )
                        AND
                            DATE_ADD(
                                DATE_ADD(
                                    UTC_TIMESTAMP(),
                                    INTERVAL 8 HOUR
                                ),
                                INTERVAL 24 HOUR
                            )
                `);


            let created = 0;


            for (
                const appointment
                of appointments
            ) {

                // --------------------------------------------------
                // CHECK IF REMINDER ALREADY EXISTS
                // --------------------------------------------------

                const [existing] =
                    await db.query(
                        `SELECT notification_id
                         FROM notifications
                         WHERE appointment_id = ?
                           AND type = 'appointment_reminder'
                         LIMIT 1`,
                        [
                            appointment.appointment_id
                        ]
                    );

                if (
                    existing.length > 0
                ) {
                    continue;
                }


                // --------------------------------------------------
                // FORMAT APPOINTMENT DATE
                // NO new Date()
                // NO GMT
                // NO UTC DATE CONVERSION
                // --------------------------------------------------

                const formattedDate =
                    formatDateLong(
                        appointment.appointment_date
                    );


                // --------------------------------------------------
                // FORMAT APPOINTMENT TIME
                // --------------------------------------------------

                const formattedTime =
                    formatTime12Hour(
                        appointment.appointment_time
                    );


                // --------------------------------------------------
                // CREATE REMINDER NOTIFICATION
                // --------------------------------------------------

                await db.query(
                    `INSERT INTO notifications
                        (
                            patient_id,
                            appointment_id,
                            type,
                            title,
                            body
                        )
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


            // --------------------------------------------------
            // RESPONSE
            // --------------------------------------------------

            res.json({

                success:
                    true,

                appointments_found:
                    appointments.length,

                reminders_created:
                    created
            });

        } catch (error) {

            console.error(
                '❌ Error checking appointment reminders:',
                error.message
            );

            res.status(500).json({
                error:
                    'Failed to check appointment reminders.'
            });
        }
    }
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;