'use strict';
const jwt = require('jsonwebtoken');
const { queryOne } = require('../database');

// Fail loudly instead of silently falling back to a known secret.
// A hardcoded fallback here means anyone reading the source (e.g. on a
// public GitHub repo) could forge valid tokens if the env var is unset.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Set it in your .env file ' +
    '(see .env.example) before starting the server.'
  );
}

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

/**
 * Requires the authenticated user to be a member of the team in
 * req.params.id (or req.params.teamId), OR a global admin.
 * Attaches req.teamMembership = { role } when found.
 */
function requireTeamMember(req, res, next) {
  if (req.user.role === 'admin') return next();
  const teamId = req.params.id || req.params.teamId;
  const membership = queryOne(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?',
    [teamId, req.user.id]
  );
  if (!membership) return res.status(403).json({ error: 'You are not a member of this team' });
  req.teamMembership = membership;
  next();
}

/**
 * Requires the authenticated user to be an admin of the team
 * (team_members.role === 'admin'), OR a global admin.
 */
function requireTeamAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  const teamId = req.params.id || req.params.teamId;
  const membership = queryOne(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?',
    [teamId, req.user.id]
  );
  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }
  next();
}

/**
 * Requires the authenticated user to be a member of the project in
 * req.params.id (or req.params.projectId), OR a global admin.
 */
function requireProjectMember(req, res, next) {
  if (req.user.role === 'admin') return next();
  const projectId = req.params.id || req.params.projectId;
  const membership = queryOne(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, req.user.id]
  );
  if (!membership) return res.status(403).json({ error: 'You are not a member of this project' });
  req.projectMembership = membership;
  next();
}

/**
 * Requires the authenticated user to be an admin of the project, OR a
 * global admin.
 */
function requireProjectAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  const projectId = req.params.id || req.params.projectId;
  const membership = queryOne(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, req.user.id]
  );
  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Project admin access required' });
  }
  next();
}

/**
 * Requires the authenticated user to be able to see/act on a specific
 * task: assignee, creator, a member of the task's project, or a global
 * admin. Attaches req.task so route handlers don't need to re-fetch it.
 */
function requireTaskAccess(req, res, next) {
  const taskId = req.params.id || req.params.taskId;
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.user.role === 'admin' || task.assigned_to === req.user.id || task.created_by === req.user.id) {
    req.task = task;
    return next();
  }
  if (task.project_id) {
    const membership = queryOne(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [task.project_id, req.user.id]
    );
    if (membership) {
      req.task = task;
      return next();
    }
  }
  return res.status(403).json({ error: 'You do not have access to this task' });
}

module.exports = {
  generateToken,
  authenticate,
  requireAdmin,
  requireTeamMember,
  requireTeamAdmin,
  requireProjectMember,
  requireProjectAdmin,
  requireTaskAccess,
};
