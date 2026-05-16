'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run } = require('../database');
const { generateToken, authenticate } = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const userCount = queryOne('SELECT COUNT(*) as count FROM users', []);
    const role = (userCount && userCount.count === 0) ? 'admin' : 'member';
    const id = uuidv4();
    const hash = await bcrypt.hash(password, 10);
    const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    run('INSERT INTO users (id, name, email, password, role, avatar_color) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name.trim(), email.toLowerCase().trim(), hash, role, avatarColor]);

    const user = queryOne('SELECT id, name, email, role, avatar_color, bio, created_at FROM users WHERE id = ?', [id]);
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);
    const { password: _, ...safeUser } = user;
    const token = generateToken(safeUser);
    res.json({ token, user: safeUser });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  try {
    const user = queryOne('SELECT id, name, email, role, avatar_color, bio, created_at, last_login FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, bio, avatar_color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    run('UPDATE users SET name = ?, bio = ?, avatar_color = ?, updated_at = datetime("now") WHERE id = ?',
      [name.trim(), bio || '', avatar_color || '#6366f1', req.user.id]);
    const user = queryOne('SELECT id, name, email, role, avatar_color, bio, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// Change password
router.put('/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    run('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

module.exports = router;
