'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

function enrichProject(project) {
  const members = query(`
    SELECT u.id, u.name, u.email, u.avatar_color, pm.role
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?`, [project.id]);
  const taskStats = queryOne(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo
    FROM tasks WHERE project_id = ?`, [project.id]);
  const creator = queryOne('SELECT id, name, avatar_color FROM users WHERE id = ?', [project.created_by]);
  const team = project.team_id ? queryOne('SELECT id, name, color FROM teams WHERE id = ?', [project.team_id]) : null;
  const progress = taskStats?.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
  return { ...project, members, task_stats: taskStats || {total:0,completed:0,in_progress:0,todo:0}, progress, creator, team };
}

// Get all projects
router.get('/', authenticate, (req, res) => {
  try {
    let projects;
    if (req.user.role === 'admin') {
      projects = query('SELECT * FROM projects ORDER BY created_at DESC', []);
    } else {
      projects = query(`SELECT p.* FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = ? ORDER BY p.created_at DESC`, [req.user.id]);
    }
    res.json(projects.map(enrichProject));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create project
router.post('/', authenticate, (req, res) => {
  try {
    const { name, description, status, priority, color, team_id, start_date, due_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });
    const id = uuidv4();
    run('INSERT INTO projects (id, name, description, status, priority, color, team_id, created_by, start_date, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name.trim(), description || '', status || 'active', priority || 'medium',
       color || '#6366f1', team_id || null, req.user.id, start_date || null, due_date || null]);
    run('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), id, req.user.id, 'admin']);
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json(enrichProject(project));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get project by id
router.get('/:id', authenticate, (req, res) => {
  try {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(enrichProject(project));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update project
router.put('/:id', authenticate, (req, res) => {
  try {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { name, description, status, priority, color, team_id, start_date, due_date } = req.body;
    run(`UPDATE projects SET name=?, description=?, status=?, priority=?, color=?, team_id=?, start_date=?, due_date=?, updated_at=datetime("now") WHERE id=?`,
      [name || project.name, description ?? project.description, status || project.status,
       priority || project.priority, color || project.color, team_id ?? project.team_id,
       start_date ?? project.start_date, due_date ?? project.due_date, req.params.id]);
    const updated = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(enrichProject(updated));
  } catch (e) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', authenticate, (req, res) => {
  try {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.created_by !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    run('DELETE FROM tasks WHERE project_id = ?', [req.params.id]);
    run('DELETE FROM project_members WHERE project_id = ?', [req.params.id]);
    run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Project deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Add member to project
router.post('/:id/members', authenticate, (req, res) => {
  try {
    const { user_id, role } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const existing = queryOne('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [req.params.id, user_id]);
    if (existing) return res.status(409).json({ error: 'User already in project' });
    run('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), req.params.id, user_id, role || 'member']);
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(enrichProject(project));
  } catch (e) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member
router.delete('/:id/members/:userId', authenticate, (req, res) => {
  try {
    run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [req.params.id, req.params.userId]);
    res.json({ message: 'Member removed' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Get project tasks
router.get('/:id/tasks', authenticate, (req, res) => {
  try {
    const tasks = query(`
      SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color,
             c.name as creator_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.project_id = ? ORDER BY t.order_index ASC, t.created_at DESC`, [req.params.id]);
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

module.exports = router;
