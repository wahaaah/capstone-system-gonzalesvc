const path = require('path');

console.log('--- PATH DEBUGGER ---');
console.log('Current File:', __filename);
console.log('Looking for DB at:', path.resolve(__dirname, '../config/db.js'));

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. READ ALL: Get all patient profiles with dynamic last visit calculation
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.*, 
                v.last_visit
            FROM patients p
            LEFT JOIN (
                SELECT 
                    patient_id, 
                    MAX(visit_date) AS last_visit
                FROM (
                    SELECT 
                        patient_id, 
                        appointment_date AS visit_date 
                    FROM appointments 
                    WHERE appointment_status NOT IN ('Canceled', 'Cancelled')

                    UNION ALL

                    SELECT 
                        a.patient_id, 
                        t.created_at AS visit_date
                    FROM transactions t
                    INNER JOIN appointments a 
                        ON t.appointment_id = a.appointment_id
                ) all_visits
                GROUP BY patient_id
            ) v 
                ON p.patient_id = v.patient_id
            ORDER BY p.name ASC
        `;

        const [rows] = await db.query(query);
        res.json(rows);

    } catch (error) {
        console.error('Error fetching patients:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. CREATE: Register a new patient account
router.post('/', async (req, res) => {
    const { patient_id, name, age, gender, contact, status } = req.body;

    try {
        const query = `
            INSERT INTO patients 
                (patient_id, name, age, gender, contact, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        await db.query(query, [
            patient_id,
            name,
            age,
            gender,
            contact,
            status || 'Active'
        ]);

        res.status(201).json({
            patient_id,
            name,
            age,
            gender,
            contact,
            status: status || 'Active'
        });

    } catch (error) {
        console.error('Error creating patient:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 3. UPDATE: Modify an existing patient record
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, age, gender, contact, status } = req.body;

    try {
        const query = `
            UPDATE patients 
            SET name = ?, age = ?, gender = ?, contact = ?, status = ? 
            WHERE patient_id = ?
        `;

        await db.query(query, [
            name,
            age,
            gender,
            contact,
            status,
            id
        ]);

        res.json({
            patient_id: id,
            name,
            age,
            gender,
            contact,
            status
        });

    } catch (error) {
        console.error('Error updating patient:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE: Purge a profile from the ledger
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await db.query(
            'DELETE FROM patients WHERE patient_id = ?',
            [id]
        );

        res.json({
            success: true,
            message: `Profile ${id} successfully cleared.`
        });

    } catch (error) {
        console.error('Error deleting patient:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;