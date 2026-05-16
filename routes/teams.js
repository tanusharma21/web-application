'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

function enrichTeam(team, userId) {
  const members = query(`
    SELECT u.id, u.name, u.email, u.avatar_color, tm.role, tm.joined_at
    FROM team_members tm JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ?`, [team.id]);
  const projectCount = queryOne('SELECT COUNT(*) as count FROM projects WHERE team_id = ?', [team.id]);
  const creator = queryOne('SELECT id, name, avatar_color FROM users WHERE id = ?', [team.created_by]);
  return { ...team, members, project_count: projectCount?.count || 0, creator };
}

// Get all teams for current user
router.get('/', authenticate, (req, res) => {
  try {
    let teams;
    if (req.user.role === 'admin') {
      teams = query('SELECT * FROM teams ORDER BY created_at DESC', []);
    } else {
      teams = query(`SELECT t.* FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ? ORDER BY t.created_at DESC`, [req.user.id]);
    }
    res.json(teams.map(t => enrichTeam(t, req.user.id)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create team
router.post('/', authenticate, (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name required' });
    const id = uuidv4();
    run('INSERT INTO teams (id, name, description, color, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, name.trim(), description || '', color || '#6366f1', req.user.id]);
    // Add creator as admin member
    run('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), id, req.user.id, 'admin']);
    const team = queryOne('SELECT * FROM teams WHERE id = ?', [id]);
    res.status(201).json(enrichTeam(team, req.user.id));
  } catch (e) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get team by id
router.get('/:id', authenticate, (req, res) => {
  try {
    const team = queryOne('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(enrichTeam(team, req.user.id));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Update team
router.put('/:id', authenticate, (req, res) => {
  try {
    const team = queryOne('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.created_by !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const { name, description, color } = req.body;
    run('UPDATE teams SET name = ?, description = ?, color = ?, updated_at = datetime("now") WHERE id = ?',
      [name || team.name, description ?? team.description, color || team.color, req.params.id]);
    const updated = queryOne('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    res.json(enrichTeam(updated, req.user.id));
  } catch (e) {
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete team
router.delete('/:id', authenticate, (req, res) => {
  try {
    const team = queryOne('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.created_by !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    run('DELETE FROM teams WHERE id = ?', [req.params.id]);
    run('DELETE FROM team_members WHERE team_id = ?', [req.params.id]);
    res.json({ message: 'Team deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Add member
router.post('/:id/members', authenticate, (req, res) => {
  try {
    const { user_id, role } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const team = queryOne('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const existing = queryOne('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?', [req.params.id, user_id]);
    if (existing) return res.status(409).json({ error: 'User already in team' });
    run('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), req.params.id, user_id, role || 'member']);
    const updated = queryOne('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    res.json(enrichTeam(updated, req.user.id));
  } catch (e) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member
router.delete('/:id/members/:userId', authenticate, (req, res) => {
  try {
    run('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [req.params.id, req.params.userId]);
    res.json({ message: 'Member removed' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
