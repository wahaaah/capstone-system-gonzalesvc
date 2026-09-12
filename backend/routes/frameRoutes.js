const express = require('express');
const router = express.Router();
const db = require('../config/db.js');
const { requireAuth } = require('./authRoutes');

// GET /api/frames — public (Guest/Patient browsing + Admin/Staff catalog view)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM frames ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching frames:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/frames/:id — single frame detail (for the try-on viewer)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM frames WHERE frame_id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Frame not found.' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/frames — Admin/Staff only: add a frame to the catalog
router.post('/', requireAuth(['admin', 'staff']), async (req, res) => {
    const { 
        name, brand, material, category, description, price, stock_quantity, 
        image_2d_url, model_3d_url, conversion_status 
    } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({ error: 'name and price are required.' });
    }

    // Default status: if GLB URL is provided, mark 'Converted', otherwise 'Not Converted'
    const status = conversion_status || (model_3d_url ? 'Converted' : 'Not Converted');

    try {
        const [result] = await db.query(
            `INSERT INTO frames (name, brand, material, category, description, price, stock_quantity, image_2d_url, model_3d_url, conversion_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, 
                brand || null, 
                material || null, 
                category || null, 
                description || null, 
                price, 
                stock_quantity || 0, 
                image_2d_url || null,
                model_3d_url || null,
                status
            ]
        );
        res.status(201).json({ 
            frame_id: result.insertId, name, brand, material, category, description, price, stock_quantity, image_2d_url, model_3d_url, conversion_status: status 
        });
    } catch (error) {
        console.error('❌ Error creating frame:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/frames/:id — Admin/Staff only: update frame details
router.put('/:id', requireAuth(['admin', 'staff']), async (req, res) => {
    const { 
        name, brand, material, category, description, price, stock_quantity, 
        image_2d_url, model_3d_url, conversion_status 
    } = req.body;

    try {
        await db.query(
            `UPDATE frames SET name=?, brand=?, material=?, category=?, description=?, price=?, stock_quantity=?, image_2d_url=?, model_3d_url=?, conversion_status=?
             WHERE frame_id=?`,
            [
                name, brand, material, category, description, price, stock_quantity, 
                image_2d_url || null, model_3d_url || null, conversion_status || 'Not Converted', 
                req.params.id
            ]
        );
        res.json({ frame_id: req.params.id, name, brand, material, category, description, price, stock_quantity, image_2d_url, model_3d_url, conversion_status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/frames/:id — Admin/Staff only
router.delete('/:id', requireAuth(['admin', 'staff']), async (req, res) => {
    try {
        await db.query('DELETE FROM frames WHERE frame_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/frames/:id/convert — Admin/Staff only: simulated 2D→3D conversion pipeline.
// NOTE: a real OpenCV/photogrammetry pipeline is out of scope for this pass — this endpoint
// models the workflow (Not Converted -> Processing -> Converted) and stores the resulting
// model_3d_url, so the frontend viewer and admin UI have a real contract to build against.
router.post('/:id/convert', requireAuth(['admin', 'staff']), async (req, res) => {
    const { model_3d_url } = req.body;
    try {
        await db.query(
            `UPDATE frames SET conversion_status = ?, model_3d_url = ? WHERE frame_id = ?`,
            [model_3d_url ? 'Converted' : 'Processing', model_3d_url || null, req.params.id]
        );
        const [rows] = await db.query('SELECT * FROM frames WHERE frame_id = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
