const path = require('path');
console.log('--- PATH DEBUGGER ---');
console.log('Current File:', __filename);
console.log('Looking for DB at:', path.resolve(__dirname, '../config/db.js'));


const express = require('express');
const router = express.Router();
// Assuming this file is in a folder called 'routes', 
// we go up one level to find the 'config' folder.
const db = require('../config/db'); 

// 1. READ ALL: Get all patient profiles
// Note: The path is just '/' because server.js adds the '/api/patients' prefix
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM patients');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching patients:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 1b. READ ONE: Get a single patient profile by ID (powers the Patient Profile detail view)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM patients WHERE patient_id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching patient:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. CREATE: Register a new patient account
router.post('/', async (req, res) => {
    const { patient_id, name, age, gender, contact, last_visit, status } = req.body;
    try {
        const query = `
            INSERT INTO patients (patient_id, name, age, gender, contact, last_visit, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await db.query(query, [patient_id, name, age, gender, contact, last_visit, status]);
        
        res.status(201).json({ patient_id, name, age, gender, contact, last_visit, status });
    } catch (error) {
        console.error('Error creating patient:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 3. UPDATE: Modify an existing patient record
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, age, gender, contact, last_visit, status } = req.body;
    try {
        const query = `
            UPDATE patients 
            SET name = ?, age = ?, gender = ?, contact = ?, last_visit = ?, status = ? 
            WHERE patient_id = ?
        `;
        await db.query(query, [name, age, gender, contact, last_visit, status, id]);
        res.json({ patient_id: id, name, age, gender, contact, last_visit, status });
    } catch (error) {
        console.error('Error updating patient:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE: Purge a profile from the ledger
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM patients WHERE patient_id = ?', [id]);
        res.json({ success: true, message: `Profile ${id} successfully cleared.` });
    } catch (error) {
        console.error('Error deleting patient:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;