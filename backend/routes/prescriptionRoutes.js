const express = require('express');
const router = express.Router();
const db = require('../config/db.js');

// GET /api/prescriptions?patient_id=P001
router.get('/', async (req, res) => {
    const { patient_id } = req.query;
    try {
        const query = patient_id
            ? 'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY prescription_id DESC'
            : 'SELECT * FROM prescriptions ORDER BY prescription_id DESC';
        const params = patient_id ? [patient_id] : [];
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching prescriptions:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/prescriptions
router.post('/', async (req, res) => {
    const { patient_id, od_sph, od_cyl, os_sph, os_cyl, notes } = req.body;
    if (!patient_id) {
        return res.status(400).json({ error: 'patient_id is required.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO prescriptions (patient_id, od_sph, od_cyl, os_sph, os_cyl, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [patient_id, od_sph || null, od_cyl || null, os_sph || null, os_cyl || null, notes || null]
        );
        res.status(201).json({ prescription_id: result.insertId, patient_id, od_sph, od_cyl, os_sph, os_cyl, notes });
    } catch (error) {
        console.error('❌ Error creating prescription:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/prescriptions/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { od_sph, od_cyl, os_sph, os_cyl, notes } = req.body;

    try {
        const [result] = await db.query(
            `UPDATE prescriptions 
             SET od_sph = ?, od_cyl = ?, os_sph = ?, os_cyl = ?, notes = ?
             WHERE prescription_id = ?`,
            [
                od_sph || null,
                od_cyl || null,
                os_sph || null,
                os_cyl || null,
                notes || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Prescription record not found.' });
        }

        res.json({
            prescription_id: Number(id),
            od_sph: od_sph || null,
            od_cyl: od_cyl || null,
            os_sph: os_sph || null,
            os_cyl: os_cyl || null,
            notes: notes || null
        });
    } catch (error) {
        console.error('❌ Error updating prescription:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;