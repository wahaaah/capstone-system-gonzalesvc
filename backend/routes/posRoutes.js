const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('./authRoutes');

// GET: Fetch all transactions (Includes patient/customer name for direct patients and walk-ins)
router.get('/transactions', async (req, res) => {
    try {
        const query = `
            SELECT 
                t.id,
                t.appointment_id,
                t.patient_id,
                t.total_amount,
                t.payment_status,
                t.created_at,
                COALESCE(p_direct.name, p_appt.name, 'Walk-in / Guest') AS customer_name
            FROM transactions t
            LEFT JOIN appointments a ON t.appointment_id = a.appointment_id
            LEFT JOIN patients p_appt ON a.patient_id = p_appt.patient_id
            LEFT JOIN patients p_direct ON t.patient_id = p_direct.patient_id
            ORDER BY t.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching transactions:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PATCH: Update transaction payment status
router.patch('/transactions/:id/status', async (req, res) => {
    const { payment_status } = req.body;
    try {
        await db.query('UPDATE transactions SET payment_status = ? WHERE id = ?', [
            payment_status,
            req.params.id
        ]);
        res.json({ success: true, id: req.params.id, payment_status });
    } catch (error) {
        console.error('❌ Error updating payment status:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET: Fetch transactions and item breakdowns for a specific patient
router.get('/pos/patient/:patient_id', async (req, res) => {
    const { patient_id } = req.params;
    try {
        const query = `
            SELECT 
                t.id AS transaction_id,
                t.appointment_id,
                t.patient_id,
                t.total_amount,
                t.payment_status,
                t.created_at,
                COALESCE(a.purpose_of_visit, 'Direct Purchase') AS purpose_of_visit,
                GROUP_CONCAT(CONCAT(COALESCE(p.name, f.name), ' (x', ti.quantity, ')') SEPARATOR ', ') AS items_summary
            FROM transactions t
            LEFT JOIN appointments a ON t.appointment_id = a.appointment_id
            LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
            LEFT JOIN products p ON ti.product_id = p.id
            LEFT JOIN frames f ON ti.frame_id = f.frame_id
            WHERE a.patient_id = ? OR t.patient_id = ?
            GROUP BY 
                t.id, 
                t.appointment_id, 
                t.patient_id,
                t.total_amount, 
                t.payment_status, 
                t.created_at, 
                a.purpose_of_visit
            ORDER BY t.created_at DESC
        `;
        const [rows] = await db.query(query, [patient_id, patient_id]);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching patient transactions:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET: Fetch all products for POS catalog and inventory
router.get('/products', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM products ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching products:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET: Fetch itemized details for a specific transaction
router.get('/transactions/:id/items', async (req, res) => {
    try {
        const query = `
            SELECT 
                ti.id,
                ti.transaction_id,
                ti.quantity,
                ti.unit_price,
                ti.product_id,
                ti.frame_id,
                COALESCE(p.name, CONCAT(f.brand, ' - ', f.name), f.name, 'Unknown Item') AS item_name,
                CASE 
                    WHEN ti.frame_id IS NOT NULL THEN 'frame'
                    ELSE 'product'
                END AS item_type
            FROM transaction_items ti
            LEFT JOIN products p ON ti.product_id = p.id
            LEFT JOIN frames f ON ti.frame_id = f.frame_id
            WHERE ti.transaction_id = ?
        `;
        const [rows] = await db.query(query, [req.params.id]);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching transaction items:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST: Admin only — create a medical product/inventory item
router.post('/products', requireAuth(['admin']), async (req, res) => {
    const { name, category, description, image_url, price, stock_quantity } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ error: 'name and price are required.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO products (name, category, description, image_url, price, stock_quantity)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, category || null, description || null, image_url || null, price, stock_quantity || 0]
        );
        res.status(201).json({ id: result.insertId, name, category, description, image_url, price, stock_quantity });
    } catch (error) {
        console.error('❌ Error creating product:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PUT: Admin only — update product details
router.put('/products/:id', requireAuth(['admin']), async (req, res) => {
    const { name, category, description, image_url, price, stock_quantity } = req.body;
    try {
        await db.query(
            `UPDATE products SET name=?, category=?, description=?, image_url=?, price=?, stock_quantity=?
             WHERE id=?`,
            [name, category, description, image_url, price, stock_quantity, req.params.id]
        );
        res.json({ id: req.params.id, name, category, description, image_url, price, stock_quantity });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE: Admin only
router.delete('/products/:id', requireAuth(['admin']), async (req, res) => {
    try {
        await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Real checkout — handles both products and frames (appointment, direct patient, & walk-in)
router.post('/checkout', async (req, res) => {
    let { appointment_id, patient_id, items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one cart item is required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // If an appointment_id is provided but patient_id is missing, auto-fetch patient_id from the appointment
        if (appointment_id && !patient_id) {
            const [apptRows] = await connection.query(
                'SELECT patient_id FROM appointments WHERE appointment_id = ?',
                [appointment_id]
            );
            if (apptRows.length > 0 && apptRows[0].patient_id) {
                patient_id = apptRows[0].patient_id;
            }
        }

        const appointmentIdValue = appointment_id ? Number(appointment_id) : null;
        const patientIdValue = patient_id ? patient_id : null; // <-- Do NOT wrap in Number() since IDs are strings

        const totalAmount = items.reduce(
            (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
            0
        );

        const [transResult] = await connection.query(
            'INSERT INTO transactions (appointment_id, patient_id, total_amount, payment_status) VALUES (?, ?, ?, ?)',
            [appointmentIdValue, patientIdValue, totalAmount, 'Paid']
        );
        const transactionId = transResult.insertId;

        for (const item of items) {
            const productId = item.product_id ? Number(item.product_id) : null;
            const frameId = item.frame_id ? Number(item.frame_id) : null;
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unit_price);

            if (frameId) {
                // Verify frame stock
                const [stockRows] = await connection.query(
                    'SELECT stock_quantity, name FROM frames WHERE frame_id = ? FOR UPDATE',
                    [frameId]
                );
                if (stockRows.length === 0) {
                    throw new Error(`Frame ID ${frameId} not found.`);
                }
                if (stockRows[0].stock_quantity < quantity) {
                    throw new Error(`Insufficient stock for frame '${stockRows[0].name}'.`);
                }

                // Insert into transaction_items
                await connection.query(
                    'INSERT INTO transaction_items (transaction_id, product_id, frame_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
                    [transactionId, null, frameId, quantity, unitPrice]
                );

                // Update frames stock table
                await connection.query(
                    'UPDATE frames SET stock_quantity = stock_quantity - ? WHERE frame_id = ?',
                    [quantity, frameId]
                );
            } else if (productId) {
                // Verify product stock
                const [stockRows] = await connection.query(
                    'SELECT stock_quantity, name FROM products WHERE id = ? FOR UPDATE',
                    [productId]
                );
                if (stockRows.length === 0) {
                    throw new Error(`Product ID ${productId} not found.`);
                }
                if (stockRows[0].stock_quantity < quantity) {
                    throw new Error(`Insufficient stock for product ID ${productId}.`);
                }

                // Insert into transaction_items
                await connection.query(
                    'INSERT INTO transaction_items (transaction_id, product_id, frame_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
                    [transactionId, productId, null, quantity, unitPrice]
                );

                // Update products stock table
                await connection.query(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                    [quantity, productId]
                );
            } else {
                throw new Error('Invalid item: missing product_id or frame_id.');
            }
        }

        await connection.commit();
        res.status(201).json({
            message: 'Checkout processed successfully',
            transactionId,
            totalAmount
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Checkout failed:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;