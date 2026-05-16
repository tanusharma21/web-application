// ===================== API =====================
const API = {
  base: '/api',
  token: localStorage.getItem('token'),

  async req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(this.base + path, opts);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get: (p) => API.req('GET', p),
  post: (p, b) => API.req('POST', p, b),
  put: (p, b) => API.req('PUT', p, b),
  delete: (p) => API.req('DELETE', p),
};

// ===================== STATE =====================
const State = {
  user: null,
  currentPage: 'dashboard',
  notifPollInterval: null,
};

// ===================== TOAST =====================
function toast(msg, type = 'default') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastIn 0.25s ease reverse';
    setTimeout(() => el.remove(), 250);
  }, 3000);
}

// ===================== MODAL =====================
const Modal = {
  open(title, bodyHtml, opts = {}) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    if (opts.large) document.getElementById('modal-container').classList.add('modal-lg');
    else document.getElementById('modal-container').classList.remove('modal-lg');
    document.getElementById('modal-overlay').classList.remove('hidden');
    if (opts.onOpen) opts.onOpen();
  },
  close() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
};

// ===================== UTILITIES =====================
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dueDateLabel(d) {
  if (!d) return '';
  const diff = new Date(d) - new Date();
  const days = Math.floor(diff / 86400000);
  if (days < 0) return `<span class="task-due overdue">Overdue ${Math.abs(days)}d</span>`;
  if (days === 0) return `<span class="task-due overdue">Due today</span>`;
  if (days <= 3) return `<span class="task-due overdue">Due in ${days}d</span>`;
  return `<span class="task-due">${formatDate(d)}</span>`;
}

function avatarHtml(name, color, cls = '') {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<div class="avatar ${cls}" style="background:${color || '#6366f1'}">${initials}</div>`;
}

function badgeHtml(val, type) {
  const labels = {
    todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review',
    completed: 'Completed', cancelled: 'Cancelled',
    low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
    active: 'Active', on_hold: 'On Hold', archived: 'Archived'
  };
  return `<span class="badge badge-${val}">${labels[val] || val}</span>`;
}

function priorityColor(p) {
  return { low: '#10b981', medium: '#f59e0b', high: '#ea580c', critical: '#dc2626' }[p] || '#64748b';
}

function statusColor(s) {
  return { todo: '#64748b', in_progress: '#3b82f6', in_review: '#8b5cf6', completed: '#10b981', cancelled: '#ef4444' }[s] || '#64748b';
}

// ===================== AUTH =====================
async function initAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    API.token = token;
    try {
      State.user = await API.get('/auth/me');
      showApp();
    } catch {
      localStorage.removeItem('token');
      showAuth();
    }
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initAppUI();
  navigateTo(location.hash.slice(1) || 'dashboard');
  startNotifPolling();
}

function logout() {
  localStorage.removeItem('token');
  API.token = null;
  State.user = null;
  clearInterval(State.notifPollInterval);
  showAuth();
}

// ===================== APP UI =====================
function initAppUI() {
  const u = State.user;
  // Sidebar user
  document.getElementById('sidebar-avatar').style.background = u.avatar_color || '#6366f1';
  document.getElementById('sidebar-avatar').textContent = u.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('sidebar-name').textContent = u.name;
  document.getElementById('sidebar-role').textContent = u.role;
  // Topbar avatar
  const ta = document.getElementById('topbar-avatar');
  ta.style.background = u.avatar_color || '#6366f1';
  ta.textContent = u.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  // Admin-only items
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', u.role !== 'admin');
  });
}

// ===================== NAVIGATION =====================
function navigateTo(page) {
  page = page || 'dashboard';
  State.currentPage = page;
  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  // Render
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading"><div class="spin"></div> Loading...</div>`;
  window.renderPage(page, content);
}

// ===================== SEARCH =====================
function initSearch() {
  const input = document.getElementById('global-search');
  const dropdown = document.getElementById('search-results');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.classList.add('hidden'); return; }
    debounce = setTimeout(async () => {
      try {
        const results = await API.get(`/dashboard/search?q=${encodeURIComponent(q)}`);
        renderSearchResults(results, dropdown);
      } catch {}
    }, 300);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) dropdown.classList.add('hidden');
  });
}

function renderSearchResults(results, el) {
  const sections = [];
  if (results.tasks?.length) {
    sections.push(`<div class="search-section">
      <div class="search-section-title">Tasks</div>
      ${results.tasks.map(t => `<div class="search-item" onclick="openTaskModal('${t.id}');document.getElementById('global-search').value='';document.getElementById('search-results').classList.add('hidden')">
        <span class="badge badge-${t.status}" style="font-size:10px">${t.status.replace('_',' ')}</span>
        <span>${t.title}</span>
      </div>`).join('')}
    </div>`);
  }
  if (results.projects?.length) {
    sections.push(`<div class="search-section">
      <div class="search-section-title">Projects</div>
      ${results.projects.map(p => `<div class="search-item" onclick="navigateTo('projects');document.getElementById('global-search').value='';document.getElementById('search-results').classList.add('hidden')">
        <div style="width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0"></div>
        <span>${p.name}</span>
      </div>`).join('')}
    </div>`);
  }
  if (results.teams?.length) {
    sections.push(`<div class="search-section">
      <div class="search-section-title">Teams</div>
      ${results.teams.map(t => `<div class="search-item" onclick="navigateTo('teams');document.getElementById('global-search').value='';document.getElementById('search-results').classList.add('hidden')">
        <div style="width:10px;height:10px;border-radius:50%;background:${t.color};flex-shrink:0"></div>
        <span>${t.name}</span>
      </div>`).join('')}
    </div>`);
  }
  el.innerHTML = sections.join('') || '<div style="padding:16px;color:var(--text-muted);text-align:center;font-size:13px">No results found</div>';
  el.classList.remove('hidden');
}

// ===================== NOTIFICATIONS =====================
async function fetchNotifCount() {
  try {
    const data = await API.get('/dashboard/notifications');
    const count = data.unread_count || 0;
    const badge = document.getElementById('notif-count');
    const sideBadge = document.getElementById('sidebar-notif-badge');
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
      sideBadge.textContent = count;
      sideBadge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
      sideBadge.classList.add('hidden');
    }
  } catch {}
}

function startNotifPolling() {
  fetchNotifCount();
  State.notifPollInterval = setInterval(fetchNotifCount, 30000);
}

// ===================== TASK MODAL =====================
async function openTaskModal(taskId) {
  Modal.open('Task Details', `<div class="loading"><div class="spin"></div></div>`, { large: true });
  try {
    const [task, comments] = await Promise.all([
      API.get(`/tasks/${taskId}`),
      API.get(`/tasks/${taskId}/comments`)
    ]);
    renderTaskModal(task, comments);
  } catch (e) {
    document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
  }
}

function renderTaskModal(task, comments) {
  document.getElementById('modal-title').textContent = task.title;
  document.getElementById('modal-container').classList.add('modal-lg');

  const commentsHtml = comments.length
    ? comments.map(c => `
        <div class="comment-item">
          ${avatarHtml(c.user_name, c.avatar_color, 'sm')}
          <div class="comment-body">
            <div class="comment-author">${c.user_name} <span class="comment-time">${timeAgo(c.created_at)}</span></div>
            <div class="comment-text">${c.content}</div>
            ${c.user_id === State.user.id ? `<button class="btn btn-ghost btn-sm" style="margin-top:4px;padding:2px 6px;font-size:11px;color:var(--danger)" onclick="deleteComment('${task.id}','${c.id}')">Delete</button>` : ''}
          </div>
        </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:13px">No comments yet</p>';

  document.getElementById('modal-body').innerHTML = `
    <div class="task-detail-grid">
      <div>
        ${task.description ? `<p style="color:var(--text-muted);margin-bottom:16px;font-size:14px;line-height:1.6">${task.description}</p>` : ''}
        <div class="task-meta-grid">
          <div class="task-meta-item"><label>Status</label>
            <select onchange="updateTask('${task.id}','status',this.value)">
              ${['todo','in_progress','in_review','completed','cancelled'].map(s => `<option value="${s}" ${task.status===s?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
            </select>
          </div>
          <div class="task-meta-item"><label>Priority</label>
            <select onchange="updateTask('${task.id}','priority',this.value)">
              ${['low','medium','high','critical'].map(p => `<option value="${p}" ${task.priority===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="task-meta-item"><label>Due Date</label><div>${formatDate(task.due_date)}</div></div>
          <div class="task-meta-item"><label>Project</label><div>${task.project?.name || '—'}</div></div>
        </div>
        <div class="comments-section">
          <h4>Comments (${comments.length})</h4>
          <div id="comments-list">${commentsHtml}</div>
          <div class="comment-input-row">
            ${avatarHtml(State.user.name, State.user.avatar_color, 'sm')}
            <div style="flex:1">
              <textarea id="comment-input" placeholder="Add a comment..." rows="2"></textarea>
              <button class="btn btn-primary btn-sm mt-4" onclick="addComment('${task.id}')">Post Comment</button>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="card" style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">Assignee</div>
          ${task.assignee ? `<div style="display:flex;align-items:center;gap:8px">${avatarHtml(task.assignee.name, task.assignee.avatar_color)}<span>${task.assignee.name}</span></div>` : '<span style="color:var(--text-muted);font-size:13px">Unassigned</span>'}
        </div>
        <div class="card">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">Created by</div>
          ${task.creator ? `<div style="display:flex;align-items:center;gap:8px">${avatarHtml(task.creator.name, task.creator.avatar_color)}<span>${task.creator.name}</span></div>` : '—'}
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px">${timeAgo(task.created_at)}</div>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')">Delete Task</button>
        </div>
      </div>
    </div>`;
}

async function updateTask(id, field, value) {
  try {
    await API.put(`/tasks/${id}`, { [field]: value });
    toast('Task updated', 'success');
    if (State.currentPage === 'tasks' || State.currentPage === 'dashboard') {
      navigateTo(State.currentPage);
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await API.delete(`/tasks/${id}`);
    Modal.close();
    toast('Task deleted', 'success');
    navigateTo(State.currentPage);
  } catch (e) { toast(e.message, 'error'); }
}

async function addComment(taskId) {
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;
  try {
    const comment = await API.post(`/tasks/${taskId}/comments`, { content });
    input.value = '';
    const list = document.getElementById('comments-list');
    const el = document.createElement('div');
    el.className = 'comment-item';
    el.innerHTML = `
      ${avatarHtml(comment.user_name, comment.avatar_color, 'sm')}
      <div class="comment-body">
        <div class="comment-author">${comment.user_name} <span class="comment-time">just now</span></div>
        <div class="comment-text">${comment.content}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:4px;padding:2px 6px;font-size:11px;color:var(--danger)" onclick="deleteComment('${taskId}','${comment.id}')">Delete</button>
      </div>`;
    if (list.querySelector('p')) list.innerHTML = '';
    list.appendChild(el);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteComment(taskId, commentId) {
  try {
    await API.delete(`/tasks/${taskId}/comments/${commentId}`);
    navigateTo(State.currentPage); // refresh
    openTaskModal(taskId);
  } catch (e) { toast(e.message, 'error'); }
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  // Auth forms
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      loginForm.classList.toggle('hidden', !isLogin);
      registerForm.classList.toggle('hidden', isLogin);
    });
  });

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    try {
      const data = await API.post('/auth/login', {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      });
      localStorage.setItem('token', data.token);
      API.token = data.token;
      State.user = data.user;
      showApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  });

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('register-error');
    errEl.classList.add('hidden');
    try {
      const data = await API.post('/auth/register', {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value
      });
      localStorage.setItem('token', data.token);
      API.token = data.token;
      State.user = data.user;
      showApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  });

  // Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
      document.getElementById('sidebar')?.classList.remove('open');
    });
  });

  // Mobile sidebar
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Modal close
  document.getElementById('modal-close').addEventListener('click', Modal.close);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) Modal.close();
  });

  // Notif button
  document.getElementById('notif-btn').addEventListener('click', () => navigateTo('notifications'));

  // Search
  initSearch();

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') Modal.close();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('global-search').focus();
    }
  });

  initAuth();
});
