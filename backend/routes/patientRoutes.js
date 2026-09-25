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


// 2. READ ONE: Get a specific patient by patient ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

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
            WHERE p.patient_id = ?
            LIMIT 1
        `;

        const [rows] = await db.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Patient not found'
            });
        }

        res.json(rows[0]);

    } catch (error) {
        console.error('Error fetching patient:', error.message);
        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// 3. CREATE PATIENT
// =====================================================

router.post('/', async (req, res) => {
    const {
        patient_id,
        name,
        age,
        gender,
        contact,
        status
    } = req.body;

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
        res.status(500).json({
            error: error.message
        });
    }
});


// =====================================================
// 4. UPDATE PATIENT
// =====================================================

router.put('/:id', async (req, res) => {
    const { id } = req.params;

    const {
        name,
        first_name,
        last_name,
        age,
        gender,
        contact,
        contact_number,
        email,
        date_of_birth,
        status
    } = req.body;

    try {
        // Build the patient's full name.
        // Mobile app sends first_name + last_name.
        // Web/admin can still send name directly.
        let updatedName = name;

        if (!updatedName && (first_name !== undefined || last_name !== undefined)) {
            const first = String(first_name || '').trim();
            const last = String(last_name || '').trim();

            updatedName = `${first} ${last}`.trim();
        }

        // Use whichever contact field was supplied.
        const updatedContact =
            contact_number !== undefined
                ? contact_number
                : contact;

        // Update the fields that exist in your patients table.
        const query = `
            UPDATE patients
            SET
                name = ?,
                gender = ?,
                contact = ?,
                email = ?
            WHERE patient_id = ?
        `;

        const [result] = await db.query(query, [
            updatedName,
            gender ?? null,
            updatedContact ?? null,
            email ?? null,
            id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        res.json({
            success: true,
            message: 'Patient profile updated successfully.',
            patient_id: id,
            name: updatedName,
            gender: gender ?? null,
            contact: updatedContact ?? null,
            email: email ?? null
        });

    } catch (error) {
        console.error('Error updating patient:', error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// 5. DELETE PATIENT
// =====================================================

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
        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// 6. MOBILE PATIENT REGISTRATION
// =====================================================

router.post('/register', async (req, res) => {
    const { name, age, gender, contact, email, password } = req.body;

    try {
        // Check if email already exists
        const [existing] = await db.query('SELECT * FROM patients WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }

        // Generate a unique patient ID like GVC-XXXX
        const patient_id = 'GVC-' + Math.floor(1000 + Math.random() * 9000);

        const query = `
            INSERT INTO patients 
                (patient_id, name, age, gender, contact, email, password, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
        `;

        await db.query(query, [
            patient_id,
            name,
            age || null,
            gender || null,
            contact || null,
            email,
            password // Note: In production, use bcrypt.hash() here!
        ]);

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            patient_id,
            email,
            name
        });

    } catch (error) {
        console.error('Error during mobile registration:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// =====================================================
// 7. MOBILE PATIENT LOGIN
// =====================================================

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const query = `SELECT * FROM patients WHERE email = ? LIMIT 1`;
        const [rows] = await db.query(query, [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const patient = rows[0];

        // Check password (direct match since it's stored plain for now, or use bcrypt.compare later)
        if (patient.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        res.json({
            success: true,
            message: 'Login successful!',
            patient_id: patient.patient_id,
            name: patient.name,
            email: patient.email
        });

    } catch (error) {
        console.error('Error during mobile login:', error.message);
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;