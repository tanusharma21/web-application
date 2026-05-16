'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Dashboard stats
router.get('/stats', authenticate, (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const uid = req.user.id;

    const totalProjects = isAdmin
      ? queryOne('SELECT COUNT(*) as count FROM projects', [])
      : queryOne('SELECT COUNT(*) as count FROM project_members WHERE user_id = ?', [uid]);

    const totalTeams = isAdmin
      ? queryOne('SELECT COUNT(*) as count FROM teams', [])
      : queryOne('SELECT COUNT(*) as count FROM team_members WHERE user_id = ?', [uid]);

    const taskStats = isAdmin
      ? queryOne(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo,
          SUM(CASE WHEN status='in_review' THEN 1 ELSE 0 END) as in_review,
          SUM(CASE WHEN due_date < date('now') AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as overdue
          FROM tasks`, [])
      : queryOne(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo,
          SUM(CASE WHEN status='in_review' THEN 1 ELSE 0 END) as in_review,
          SUM(CASE WHEN due_date < date('now') AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as overdue
          FROM tasks WHERE assigned_to = ? OR created_by = ?`, [uid, uid]);

    const totalUsers = isAdmin ? queryOne('SELECT COUNT(*) as count FROM users', []) : null;

    const recentActivity = query(`
      SELECT al.*, u.name as user_name, u.avatar_color
      FROM activity_log al JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC LIMIT 10`, []);

    // Task by priority breakdown
    const priorityStats = isAdmin
      ? query(`SELECT priority, COUNT(*) as count FROM tasks WHERE status != 'completed' GROUP BY priority`, [])
      : query(`SELECT priority, COUNT(*) as count FROM tasks WHERE status != 'completed' AND (assigned_to = ? OR created_by = ?) GROUP BY priority`, [uid, uid]);

    // My upcoming tasks
    const upcomingTasks = query(`
      SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color, p.name as project_name, p.color as project_color
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.assigned_to = ? AND t.status NOT IN ('completed','cancelled')
      ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC LIMIT 5`, [uid]);

    res.json({
      total_projects: totalProjects?.count || 0,
      total_teams: totalTeams?.count || 0,
      total_users: totalUsers?.count || null,
      task_stats: taskStats || { total:0, completed:0, in_progress:0, todo:0, in_review:0, overdue:0 },
      priority_stats: priorityStats,
      recent_activity: recentActivity,
      upcoming_tasks: upcomingTasks
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Notifications
router.get('/notifications', authenticate, (req, res) => {
  try {
    const notifications = query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    const unread = queryOne('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ notifications, unread_count: unread?.count || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/notifications/:id/read', authenticate, (req, res) => {
  try {
    run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Marked as read' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

router.put('/notifications/read-all', authenticate, (req, res) => {
  try {
    run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All marked as read' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark notifications' });
  }
});

// Activity feed
router.get('/activity', authenticate, (req, res) => {
  try {
    const activity = query(`
      SELECT al.*, u.name as user_name, u.avatar_color
      FROM activity_log al JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC LIMIT 30`, []);
    res.json(activity);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Search
router.get('/search', authenticate, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ tasks: [], projects: [], teams: [] });
    const like = `%${q}%`;
    const tasks = query(`SELECT id, title, status, priority FROM tasks WHERE title LIKE ? LIMIT 5`, [like]);
    const projects = query(`SELECT id, name, status, color FROM projects WHERE name LIKE ? LIMIT 5`, [like]);
    const teams = query(`SELECT id, name, color FROM teams WHERE name LIKE ? LIMIT 5`, [like]);
    res.json({ tasks, projects, teams });
  } catch (e) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Calendar tasks
router.get('/calendar', authenticate, (req, res) => {
  try {
    const { year, month } = req.query;
    const uid = req.user.id;
    const tasks = query(`
      SELECT t.*, p.name as project_name, p.color as project_color, u.name as assignee_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.due_date LIKE ?
      AND (t.assigned_to = ? OR t.created_by = ?)
      ORDER BY t.due_date ASC`,
      [`${year}-${String(month).padStart(2,'0')}%`, uid, uid]);
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch calendar tasks' });
  }
});

module.exports = router;
