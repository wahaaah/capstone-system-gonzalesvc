const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production';

// POST /api/auth/login — authenticates super_admin / admin / staff users
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE username = ? AND is_active = 1',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const user = rows[0];
        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const token = jwt.sign(
            { user_id: user.user_id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('❌ Login error:', error.message);
        res.status(500).json({ error: error.message || 'Login failed.' });
    }
});

// Middleware other routes can use to require a valid session + minimum role
function requireAuth(allowedRoles) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided.' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (allowedRoles && !allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Insufficient permissions.' });
            }
            req.user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }
    };
}

// POST /api/auth/users — Super-Admin only: create new Admin/Staff accounts
router.post('/users', requireAuth(['super_admin']), async (req, res) => {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'username, password, and role are required.' });
    }
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            [username, passwordHash, full_name || null, role]
        );
        res.status(201).json({ user_id: result.insertId, username, full_name, role });
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/users — Super-Admin: list accounts (no password hashes returned)
router.get('/users', requireAuth(['super_admin']), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT user_id, username, full_name, role, is_active, created_at FROM users'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/auth/users/:id/status — Super-Admin only: activate/deactivate an account
router.patch('/users/:id/status', requireAuth(['super_admin']), async (req, res) => {
    const { is_active } = req.body;
    if (is_active === undefined) {
        return res.status(400).json({ error: 'is_active (true/false) is required.' });
    }
    try {
        await db.query('UPDATE users SET is_active = ? WHERE user_id = ?', [is_active ? 1 : 0, req.params.id]);
        res.json({ user_id: req.params.id, is_active: !!is_active });
    } catch (error) {
        console.error('❌ Error updating account status:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
