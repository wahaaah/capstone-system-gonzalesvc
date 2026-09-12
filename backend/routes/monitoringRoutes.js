const express = require('express');
const router = express.Router();
const db = require('../config/db.js');
const { requireAuth } = require('./authRoutes');

// GET /api/monitoring/stats — Super-Admin only: system-wide monitoring snapshot.
// This is the read-only "monitoring" half of the Super-Admin role (the other half,
// account maintenance, lives in authRoutes' /users endpoints).
router.get('/stats', requireAuth(['super_admin']), async (req, res) => {
    try {
        const [[{ totalPatients }]] = await db.query('SELECT COUNT(*) AS totalPatients FROM patients');
        const [[{ totalAppointments }]] = await db.query('SELECT COUNT(*) AS totalAppointments FROM appointments');
        const [[{ appointmentsToday }]] = await db.query(
            'SELECT COUNT(*) AS appointmentsToday FROM appointments WHERE appointment_date = CURDATE()'
        );
        const [[{ totalTransactions, totalRevenue }]] = await db.query(
            `SELECT COUNT(*) AS totalTransactions, COALESCE(SUM(total_amount), 0) AS totalRevenue FROM transactions`
        );
        const [[{ totalFrames }]] = await db.query('SELECT COUNT(*) AS totalFrames FROM frames');
        const [[{ totalProducts }]] = await db.query('SELECT COUNT(*) AS totalProducts FROM products');
        const [[{ lowStockProducts }]] = await db.query(
            'SELECT COUNT(*) AS lowStockProducts FROM products WHERE stock_quantity <= 5'
        );
        const [usersByRole] = await db.query(
            `SELECT role, COUNT(*) AS count, SUM(is_active) AS active FROM users GROUP BY role`
        );
        const [recentActivity] = await db.query(
            `SELECT 'appointment' AS type, appointment_id AS id, patient_id AS reference, created_at
             FROM appointments ORDER BY created_at DESC LIMIT 5`
        );

        res.json({
            totalPatients,
            totalAppointments,
            appointmentsToday,
            totalTransactions,
            totalRevenue,
            totalFrames,
            totalProducts,
            lowStockProducts,
            usersByRole,
            recentActivity,
        });
    } catch (error) {
        console.error('❌ Error fetching monitoring stats:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
