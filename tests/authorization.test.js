'use strict';
/**
 * Authorization tests.
 *
 * These specifically cover the access-control bugs found during a security
 * review: any authenticated user could previously read or modify teams,
 * projects, and tasks they were not a member of (IDOR), and could add
 * themselves to any project/team without permission.
 *
 * Run with: npm test
 */
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.DB_PATH = ':memory:'; // overridden below via a temp file, see beforeAll

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');

let app;
let initDb;
let tmpDbPath;

async function registerUser(name, email) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123' });
  return res.body; // { token, user }
}

beforeAll(async () => {
  // Use a fresh temp SQLite file per test run so tests don't collide with
  // your real dev database or each other.
  tmpDbPath = path.join(os.tmpdir(), `ttm-test-${Date.now()}.db`);
  process.env.DB_PATH = tmpDbPath;

  // Require after env vars are set, since database.js and middleware/auth.js
  // read them at module-load time.
  app = require('../app');
 ({ initDb } = require('../database'));
  await initDb();
});

afterAll(() => {
  if (tmpDbPath && fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
});

describe('Project authorization', () => {
  let bob, carol, projectId;

  beforeAll(async () => {
    bob = await registerUser('Bob', 'bob@ttm-test.com');
    carol = await registerUser('Carol', 'carol@ttm-test.com');

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ name: "Bob's Private Project" });
    projectId = res.body.id;
  });

  test('owner can view their own project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Bob's Private Project");
  });

  test('non-member cannot view another user\'s project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${carol.token}`);
    expect(res.status).toBe(403);
  });

  test('non-member cannot update another user\'s project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${carol.token}`)
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  test('non-admin member cannot add themselves to a project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${carol.token}`)
      .send({ user_id: carol.user.id });
    expect(res.status).toBe(403);
  });

  test('request with no token is rejected', async () => {
    const res = await request(app).get(`/api/projects/${projectId}`);
    expect(res.status).toBe(401);
  });
});

describe('Team authorization', () => {
  let dave, erin, teamId;

  beforeAll(async () => {
    dave = await registerUser('Dave', 'dave@ttm-test.com');
    erin = await registerUser('Erin', 'erin@ttm-test.com');

    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${dave.token}`)
      .send({ name: "Dave's Team" });
    teamId = res.body.id;
  });

  test('non-member cannot view another user\'s team', async () => {
    const res = await request(app)
      .get(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${erin.token}`);
    expect(res.status).toBe(403);
  });

  test('non-admin member cannot add members to a team they don\'t admin', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${erin.token}`)
      .send({ user_id: erin.user.id });
    expect(res.status).toBe(403);
  });
});

describe('Task authorization', () => {
  let frank, grace, taskId;

  beforeAll(async () => {
    frank = await registerUser('Frank', 'frank@ttm-test.com');
    grace = await registerUser('Grace', 'grace@ttm-test.com');

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${frank.token}`)
      .send({ title: "Frank's private task" });
    taskId = res.body.id;
  });

  test('creator can view their own task', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${frank.token}`);
    expect(res.status).toBe(200);
  });

  test('unrelated user cannot view someone else\'s task', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${grace.token}`);
    expect(res.status).toBe(403);
  });

  test('unrelated user cannot update someone else\'s task', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${grace.token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(403);
  });

  test('unrelated user cannot comment on a task they can\'t access', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${grace.token}`)
      .send({ content: 'spying' });
    expect(res.status).toBe(403);
  });
});

describe('Auth basics', () => {
  test('cannot register with a password under 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short', email: 'short@ttm-test.com', password: '123' });
    expect(res.status).toBe(400);
  });

  test('login fails with wrong password', async () => {
    await registerUser('Henry', 'henry@ttm-test.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'henry@ttm-test.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });
});
