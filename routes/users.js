'use strict';
const express = require('express');
const { query, queryOne, run } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// List all users (admin only)
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const users = query('SELECT id, name, email, role, avatar_color, bio, created_at, last_login FROM users ORDER BY created_at ASC', []);
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by id
router.get('/:id', authenticate, (req, res) => {
  try {
    const user = queryOne('SELECT id, name, email, role, avatar_color, bio, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const taskCount = queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ?', [req.params.id]);
    const completedCount = queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? AND status = "completed"', [req.params.id]);
    res.json({ ...user, task_count: taskCount?.count || 0, completed_count: completedCount?.count || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Change user role (admin only)
router.put('/:id/role', authenticate, requireAdmin, (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot change own role' });
    run('UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?', [role, req.params.id]);
    res.json({ message: 'Role updated' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
