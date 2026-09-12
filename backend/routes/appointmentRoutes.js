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

// 4. PATCH: Quick status-only update (e.g. cancel) — matches appointmentService.updateStatus on the frontend
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { appointment_status } = req.body;

    if (!appointment_status) {
        return res.status(400).json({ error: 'appointment_status is required.' });
    }

    try {
        const [result] = await db.query(
            'UPDATE appointments SET appointment_status = ? WHERE appointment_id = ?',
            [appointment_status, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }
        res.json({ appointment_id: Number(id), appointment_status });
    } catch (error) {
        console.error('❌ Error updating appointment status:', error.message);
        res.status(500).json({ error: 'Failed to update appointment status.' });
    }
});

module.exports = router;