const express = require('express');
const router = express.Router();
const db = require('../config/db.js');

// ======================================================
// GET /api/notifications/patient/:patient_id
// Get all notifications for one patient
// ======================================================
router.get('/patient/:patient_id', async (req, res) => {
    const { patient_id } = req.params;

    try {
        const [rows] = await db.query(
            `
            SELECT
                notification_id,
                patient_id,
                type,
                title,
                body,
                is_read,
                created_at
            FROM notifications
            WHERE patient_id = ?
            ORDER BY created_at DESC
            `,
            [patient_id]
        );

        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching notifications:', error.message);

        res.status(500).json({
            error: 'Failed to fetch notifications.'
        });
    }
});


// ======================================================
// GET /api/notifications/patient/:patient_id/unread-count
// Get unread notification count
// ======================================================
router.get('/patient/:patient_id/unread-count', async (req, res) => {
    const { patient_id } = req.params;

    try {
        const [rows] = await db.query(
            `
            SELECT COUNT(*) AS unread_count
            FROM notifications
            WHERE patient_id = ?
              AND is_read = 0
            `,
            [patient_id]
        );

        res.json({
            unread_count: Number(rows[0].unread_count)
        });
    } catch (error) {
        console.error(
            '❌ Error fetching unread notification count:',
            error.message
        );

        res.status(500).json({
            error: 'Failed to fetch unread notification count.'
        });
    }
});


// ======================================================
// PATCH /api/notifications/:id/read
// Mark one notification as read
// ======================================================
router.patch('/:id/read', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(
            `
            UPDATE notifications
            SET is_read = 1
            WHERE notification_id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Notification not found.'
            });
        }

        res.json({
            success: true,
            notification_id: Number(id)
        });
    } catch (error) {
        console.error(
            '❌ Error marking notification as read:',
            error.message
        );

        res.status(500).json({
            error: 'Failed to mark notification as read.'
        });
    }
});


// ======================================================
// PATCH /api/notifications/patient/:patient_id/read-all
// Mark all notifications as read
// ======================================================
router.patch('/patient/:patient_id/read-all', async (req, res) => {
    const { patient_id } = req.params;

    try {
        await db.query(
            `
            UPDATE notifications
            SET is_read = 1
            WHERE patient_id = ?
              AND is_read = 0
            `,
            [patient_id]
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error(
            '❌ Error marking all notifications as read:',
            error.message
        );

        res.status(500).json({
            error: 'Failed to mark all notifications as read.'
        });
    }
});

module.exports = router;