// ===================== PAGE ROUTER =====================
window.renderPage = async function(page, container) {
  const pages = {
    dashboard: renderDashboard,
    projects: renderProjects,
    tasks: renderTasks,
    teams: renderTeams,
    calendar: renderCalendar,
    notifications: renderNotifications,
    activity: renderActivity,
    profile: renderProfile,
    users: renderUsers,
  };
  const fn = pages[page];
  if (fn) await fn(container);
  else container.innerHTML = `<div class="empty-state"><div class="empty-title">Page not found</div></div>`;
};

// ===================== DASHBOARD =====================
async function renderDashboard(el) {
  try {
    const stats = await API.get('/dashboard/stats');
    const ts = stats.task_stats;
    const isAdmin = State.user.role === 'admin';

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Good ${greeting()}, ${State.user.name.split(' ')[0]} 👋</div>
          <div class="page-subtitle">${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</div>
        </div>
        <button class="btn btn-primary" onclick="openCreateTaskModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Task
        </button>
      </div>
      <div class="stats-grid">
        <div class="stat-card" style="--stat-color:#4f46e5;--stat-bg:#eef2ff">
          <div class="stat-icon">${svgFolder()}</div>
          <div class="stat-value">${stats.total_projects}</div>
          <div class="stat-label">Projects</div>
        </div>
        <div class="stat-card" style="--stat-color:#3b82f6;--stat-bg:#eff6ff">
          <div class="stat-icon">${svgCheck()}</div>
          <div class="stat-value">${ts.total || 0}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card" style="--stat-color:#10b981;--stat-bg:#f0fdf4">
          <div class="stat-icon">${svgCheck()}</div>
          <div class="stat-value">${ts.completed || 0}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card" style="--stat-color:#f59e0b;--stat-bg:#fffbeb">
          <div class="stat-icon">${svgClock()}</div>
          <div class="stat-value">${ts.in_progress || 0}</div>
          <div class="stat-label">In Progress</div>
        </div>
        ${ts.overdue > 0 ? `<div class="stat-card" style="--stat-color:#ef4444;--stat-bg:#fef2f2">
          <div class="stat-icon">${svgAlert()}</div>
          <div class="stat-value">${ts.overdue}</div>
          <div class="stat-label">Overdue</div>
        </div>` : ''}
        ${isAdmin && stats.total_users !== null ? `<div class="stat-card" style="--stat-color:#8b5cf6;--stat-bg:#f5f3ff">
          <div class="stat-icon">${svgUsers()}</div>
          <div class="stat-value">${stats.total_users}</div>
          <div class="stat-label">Team Members</div>
        </div>` : ''}
      </div>
      <div class="charts-grid">
        <div class="chart-card">
          <h3>Task Status</h3>
          <p>Current distribution</p>
          <div class="chart-wrap"><canvas id="statusChart"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>Priority Breakdown</h3>
          <p>Open tasks by priority</p>
          <div class="chart-wrap"><canvas id="priorityChart"></canvas></div>
        </div>
      </div>
      <div class="two-col">
        <div class="card">
          <div class="card-header"><div class="card-title">My Upcoming Tasks</div><button class="btn btn-ghost btn-sm" onclick="navigateTo('tasks')">View all</button></div>
          ${renderUpcoming(stats.upcoming_tasks)}
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Recent Activity</div><button class="btn btn-ghost btn-sm" onclick="navigateTo('activity')">View all</button></div>
          ${renderRecentActivity(stats.recent_activity)}
        </div>
      </div>`;

    // Charts
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx && ts.total > 0) {
      new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: ['To Do', 'In Progress', 'In Review', 'Completed', 'Cancelled'],
          datasets: [{ data: [ts.todo||0, ts.in_progress||0, ts.in_review||0, ts.completed||0, 0], backgroundColor: ['#64748b','#3b82f6','#8b5cf6','#10b981','#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } } } }
      });
    }

    const priorityCtx = document.getElementById('priorityChart');
    if (priorityCtx) {
      const ps = stats.priority_stats || [];
      const labels = ['low','medium','high','critical'];
      const dataMap = Object.fromEntries(ps.map(p => [p.priority, p.count]));
      new Chart(priorityCtx, {
        type: 'bar',
        data: {
          labels: ['Low','Medium','High','Critical'],
          datasets: [{ data: labels.map(l => dataMap[l] || 0), backgroundColor: ['#10b981','#f59e0b','#ea580c','#dc2626'], borderRadius: 6, borderSkipped: false }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
      });
    }
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load dashboard</div><div class="empty-desc">${e.message}</div></div>`;
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function renderUpcoming(tasks) {
  if (!tasks?.length) return '<div style="color:var(--text-muted);font-size:13px;padding:10px 0">No upcoming tasks</div>';
  return tasks.map(t => `
    <div class="upcoming-task-item">
      <div class="task-priority-dot" style="background:${priorityColor(t.priority)}"></div>
      <div class="upcoming-task-name" onclick="openTaskModal('${t.id}')">${t.title}</div>
      ${dueDateLabel(t.due_date)}
    </div>`).join('');
}

function renderRecentActivity(items) {
  if (!items?.length) return '<div style="color:var(--text-muted);font-size:13px;padding:10px 0">No recent activity</div>';
  return `<div class="activity-list">${items.slice(0, 6).map(a => `
    <div class="activity-item">
      ${avatarHtml(a.user_name, a.avatar_color, 'sm')}
      <div class="activity-content">
        <div class="activity-text"><strong>${a.user_name}</strong> ${a.action} ${a.entity_type} <em>${a.entity_name || ''}</em></div>
        <div class="activity-time">${timeAgo(a.created_at)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ===================== PROJECTS =====================
let projectsFilter = { status: '', search: '' };

async function renderProjects(el) {
  try {
    const projects = await API.get('/projects');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Projects</div>
          <div class="page-subtitle">${projects.length} project${projects.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn btn-primary" onclick="openCreateProjectModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>
      <div class="filters-bar">
        <input type="text" class="filter-select" placeholder="Search projects..." style="width:220px" oninput="filterProjects(this.value,'search')" />
        <select class="filter-select" onchange="filterProjects(this.value,'status')">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div class="projects-grid" id="projects-grid">
        ${projects.length ? projects.map(renderProjectCard).join('') : emptyState('No projects yet', 'Create your first project to get started', 'openCreateProjectModal()')}
      </div>`;
    window._allProjects = projects;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load projects</div></div>`;
  }
}

function filterProjects(val, key) {
  projectsFilter[key] = val;
  let projects = window._allProjects || [];
  if (projectsFilter.status) projects = projects.filter(p => p.status === projectsFilter.status);
  if (projectsFilter.search) projects = projects.filter(p => p.name.toLowerCase().includes(projectsFilter.search.toLowerCase()));
  document.getElementById('projects-grid').innerHTML = projects.map(renderProjectCard).join('') || emptyState('No projects match', 'Try adjusting your filters');
}

function renderProjectCard(p) {
  const memberAvatars = (p.members || []).slice(0, 4).map(m => avatarHtml(m.name, m.avatar_color, 'sm')).join('');
  return `
    <div class="project-card" onclick="openProjectDetail('${p.id}')">
      <div class="project-card-accent" style="background:${p.color}"></div>
      <div class="project-card-header">
        <div>
          <div class="project-name">${p.name}</div>
          ${badgeHtml(p.status, 'status')}
        </div>
        ${badgeHtml(p.priority, 'priority')}
      </div>
      <div class="project-desc">${p.description || 'No description'}</div>
      <div class="project-progress-bar">
        <div class="project-progress-fill" style="width:${p.progress}%;background:${p.color}"></div>
      </div>
      <div class="project-meta">
        <div class="avatar-stack">${memberAvatars}</div>
        <span>${p.progress}% · ${p.task_stats?.total || 0} tasks</span>
      </div>
    </div>`;
}

async function openProjectDetail(projectId) {
  Modal.open('Project Details', `<div class="loading"><div class="spin"></div></div>`, { large: true });
  try {
    const [project, tasks] = await Promise.all([
      API.get(`/projects/${projectId}`),
      API.get(`/projects/${projectId}/tasks`)
    ]);
    renderProjectDetailModal(project, tasks);
  } catch (e) {
    document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
  }
}

function renderProjectDetailModal(p, tasks) {
  document.getElementById('modal-title').textContent = p.name;
  const memberAvatars = (p.members || []).map(m => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      ${avatarHtml(m.name, m.avatar_color, 'sm')}
      <div><div style="font-size:13px;font-weight:500">${m.name}</div><div style="font-size:11px;color:var(--text-muted)">${m.role}</div></div>
    </div>`).join('');

  // Group tasks by status
  const cols = { todo: [], in_progress: [], in_review: [], completed: [] };
  tasks.forEach(t => { if (cols[t.status]) cols[t.status].push(t); else cols.todo.push(t); });

  const kanbanHtml = Object.entries({ 'To Do': cols.todo, 'In Progress': cols.in_progress, 'In Review': cols.in_review, 'Completed': cols.completed }).map(([label, list]) => `
    <div class="kanban-col">
      <div class="kanban-col-header">
        <div class="kanban-col-title">${label} <span class="kanban-count">${list.length}</span></div>
      </div>
      <div class="kanban-cards">
        ${list.map(t => `<div class="task-card" onclick="openTaskModal('${t.id}')">
          <div class="task-card-title">${t.title}</div>
          <div class="task-card-meta">
            ${badgeHtml(t.priority, 'priority')}
            ${t.assignee_name ? avatarHtml(t.assignee_name, t.assignee_color, 'sm') : ''}
          </div>
        </div>`).join('') || '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px">Empty</div>'}
      </div>
    </div>`).join('');

  document.getElementById('modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 220px;gap:20px">
      <div>
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px">${p.description || ''}</p>
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
          ${badgeHtml(p.status, 'status')} ${badgeHtml(p.priority, 'priority')}
          ${p.due_date ? `<span style="font-size:13px;color:var(--text-muted)">Due: ${formatDate(p.due_date)}</span>` : ''}
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:12px">Tasks (${tasks.length})</div>
        <div class="kanban-board" style="grid-template-columns:repeat(4,minmax(160px,1fr))">${kanbanHtml}</div>
      </div>
      <div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title" style="margin-bottom:12px">Members (${p.members?.length || 0})</div>
          ${memberAvatars || '<p style="color:var(--text-muted);font-size:13px">No members</p>'}
          <button class="btn btn-secondary btn-sm" style="margin-top:8px;width:100%" onclick="openAddMemberModal('${p.id}','project')">Add Member</button>
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">Progress</div>
          <div style="font-size:28px;font-weight:800;color:var(--accent)">${p.progress}%</div>
          <div class="project-progress-bar" style="margin-top:8px">
            <div class="project-progress-fill" style="width:${p.progress}%;background:${p.color}"></div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px">${p.task_stats?.completed||0} of ${p.task_stats?.total||0} tasks done</div>
        </div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="openCreateTaskModal('${p.id}')">Add Task</button>
          <button class="btn btn-secondary btn-sm" onclick="openEditProjectModal(${JSON.stringify(p).replace(/"/g,'&quot;')})">Edit Project</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProject('${p.id}')">Delete Project</button>
        </div>
      </div>
    </div>`;
}

function openCreateProjectModal() {
  Modal.open('Create Project', `
    <div class="form-group"><label>Project Name *</label><input id="pname" placeholder="e.g. Website Redesign" /></div>
    <div class="form-group"><label>Description</label><textarea id="pdesc" placeholder="What is this project about?"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Status</label><select id="pstatus"><option value="active">Active</option><option value="on_hold">On Hold</option></select></div>
      <div class="form-group"><label>Priority</label><select id="ppriority"><option value="medium">Medium</option><option value="low">Low</option><option value="high">High</option><option value="critical">Critical</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Start Date</label><input type="date" id="pstart" /></div>
      <div class="form-group"><label>Due Date</label><input type="date" id="pdue" /></div>
    </div>
    <div class="form-group"><label>Color</label><input type="color" id="pcolor" value="#4f46e5" style="width:60px;height:36px;padding:2px;cursor:pointer" /></div>
    <div class="modal-footer" style="padding:0;margin-top:20px">
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="createProject()">Create Project</button>
    </div>`);
}

async function createProject() {
  const name = document.getElementById('pname').value.trim();
  if (!name) { toast('Project name required', 'error'); return; }
  try {
    await API.post('/projects', {
      name,
      description: document.getElementById('pdesc').value,
      status: document.getElementById('pstatus').value,
      priority: document.getElementById('ppriority').value,
      start_date: document.getElementById('pstart').value,
      due_date: document.getElementById('pdue').value,
      color: document.getElementById('pcolor').value,
    });
    Modal.close();
    toast('Project created!', 'success');
    navigateTo('projects');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteProject(id) {
  if (!confirm('Delete this project and all its tasks?')) return;
  try {
    await API.delete(`/projects/${id}`);
    Modal.close();
    toast('Project deleted', 'success');
    navigateTo('projects');
  } catch (e) { toast(e.message, 'error'); }
}

// ===================== TASKS =====================
let tasksView = 'kanban';
let tasksFilter = { status: '', priority: '', project_id: '', search: '' };

async function renderTasks(el) {
  try {
    const [tasks, projects] = await Promise.all([API.get('/tasks'), API.get('/projects')]);
    window._allTasks = tasks;
    window._allProjects = projects;

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Tasks</div>
          <div class="page-subtitle">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn btn-primary" onclick="openCreateTaskModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Task
        </button>
      </div>
      <div class="filters-bar">
        <input type="text" class="filter-select" placeholder="Search tasks..." style="width:200px" oninput="filterTasks('search',this.value)" />
        <select class="filter-select" onchange="filterTasks('status',this.value)">
          <option value="">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="completed">Completed</option>
        </select>
        <select class="filter-select" onchange="filterTasks('priority',this.value)">
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select class="filter-select" onchange="filterTasks('project_id',this.value)">
          <option value="">All Projects</option>
          ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <div class="view-toggle" style="margin-left:auto">
          <button class="view-btn ${tasksView==='kanban'?'active':''}" onclick="switchTasksView('kanban')">Kanban</button>
          <button class="view-btn ${tasksView==='list'?'active':''}" onclick="switchTasksView('list')">List</button>
        </div>
      </div>
      <div id="tasks-view-container">${renderTasksView(tasks)}</div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load tasks</div></div>`;
  }
}

function filterTasks(key, val) {
  tasksFilter[key] = val;
  let tasks = window._allTasks || [];
  if (tasksFilter.status) tasks = tasks.filter(t => t.status === tasksFilter.status);
  if (tasksFilter.priority) tasks = tasks.filter(t => t.priority === tasksFilter.priority);
  if (tasksFilter.project_id) tasks = tasks.filter(t => t.project_id === tasksFilter.project_id);
  if (tasksFilter.search) tasks = tasks.filter(t => t.title.toLowerCase().includes(tasksFilter.search.toLowerCase()));
  document.getElementById('tasks-view-container').innerHTML = renderTasksView(tasks);
}

function switchTasksView(view) {
  tasksView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === view));
  document.getElementById('tasks-view-container').innerHTML = renderTasksView(window._allTasks || []);
}

function renderTasksView(tasks) {
  if (tasksView === 'list') return renderTasksList(tasks);
  return renderKanban(tasks);
}

function renderKanban(tasks) {
  const cols = [
    { key: 'todo', label: 'To Do', color: '#64748b' },
    { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
    { key: 'in_review', label: 'In Review', color: '#8b5cf6' },
    { key: 'completed', label: 'Completed', color: '#10b981' },
  ];
  return `<div class="kanban-board">${cols.map(col => {
    const colTasks = tasks.filter(t => t.status === col.key);
    return `<div class="kanban-col">
      <div class="kanban-col-header">
        <div class="kanban-col-title">
          <span style="width:8px;height:8px;border-radius:50%;background:${col.color};display:inline-block"></span>
          ${col.label}
          <span class="kanban-count">${colTasks.length}</span>
        </div>
      </div>
      <div class="kanban-cards">
        ${colTasks.map(t => `
          <div class="task-card" onclick="openTaskModal('${t.id}')">
            ${t.project?.name ? `<div class="task-card-project" style="margin-bottom:6px">${t.project.name}</div>` : ''}
            <div class="task-card-title">${t.title}</div>
            <div class="task-card-meta">
              ${badgeHtml(t.priority, 'priority')}
              <div style="display:flex;align-items:center;gap:6px">
                ${dueDateLabel(t.due_date)}
                ${t.assignee ? avatarHtml(t.assignee.name, t.assignee.avatar_color, 'sm') : ''}
              </div>
            </div>
          </div>`).join('') || '<div style="color:var(--text-muted);font-size:12px;padding:8px;text-align:center">No tasks</div>'}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderTasksList(tasks) {
  if (!tasks.length) return emptyState('No tasks found', 'Create a task or adjust your filters');
  return `<div class="card" style="padding:0;overflow:hidden"><div class="tasks-table-wrap">
    <table class="tasks-table">
      <thead><tr>
        <th>Task</th><th>Status</th><th>Priority</th><th>Project</th><th>Assignee</th><th>Due Date</th>
      </tr></thead>
      <tbody>
        ${tasks.map(t => `<tr>
          <td class="task-title-cell" onclick="openTaskModal('${t.id}')">${t.title}</td>
          <td>${badgeHtml(t.status, 'status')}</td>
          <td>${badgeHtml(t.priority, 'priority')}</td>
          <td>${t.project?.name || '—'}</td>
          <td>${t.assignee ? `<div style="display:flex;align-items:center;gap:6px">${avatarHtml(t.assignee.name, t.assignee.avatar_color, 'sm')}<span>${t.assignee.name}</span></div>` : '—'}</td>
          <td>${dueDateLabel(t.due_date) || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div></div>`;
}

async function openCreateTaskModal(projectId) {
  Modal.close();
  const projects = window._allProjects || await API.get('/projects');
  let users = [];
  try { users = await API.get('/users'); } catch {}
  Modal.open('Create Task', `
    <div class="form-group"><label>Task Title *</label><input id="ttitle" placeholder="What needs to be done?" /></div>
    <div class="form-group"><label>Description</label><textarea id="tdesc" placeholder="Optional details..."></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Status</label><select id="tstatus"><option value="todo">To Do</option><option value="in_progress">In Progress</option></select></div>
      <div class="form-group"><label>Priority</label><select id="tpriority"><option value="medium">Medium</option><option value="low">Low</option><option value="high">High</option><option value="critical">Critical</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Project</label><select id="tproject"><option value="">None</option>${projects.map(p => `<option value="${p.id}" ${p.id===projectId?'selected':''}>${p.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Assign To</label><select id="tassign"><option value="">Unassigned</option>${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Due Date</label><input type="date" id="tdue" /></div>
      <div class="form-group"><label>Estimated Hours</label><input type="number" id="testimate" placeholder="0" min="0" step="0.5" /></div>
    </div>
    <div class="modal-footer" style="padding:0;margin-top:20px">
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="createTask()">Create Task</button>
    </div>`);
}

async function createTask() {
  const title = document.getElementById('ttitle').value.trim();
  if (!title) { toast('Task title required', 'error'); return; }
  try {
    await API.post('/tasks', {
      title,
      description: document.getElementById('tdesc').value,
      status: document.getElementById('tstatus').value,
      priority: document.getElementById('tpriority').value,
      project_id: document.getElementById('tproject').value || null,
      assigned_to: document.getElementById('tassign').value || null,
      due_date: document.getElementById('tdue').value || null,
      estimated_hours: parseFloat(document.getElementById('testimate').value) || 0,
    });
    Modal.close();
    toast('Task created!', 'success');
    navigateTo(State.currentPage);
  } catch (e) { toast(e.message, 'error'); }
}

// ===================== TEAMS =====================
async function renderTeams(el) {
  try {
    const teams = await API.get('/teams');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Teams</div>
          <div class="page-subtitle">${teams.length} team${teams.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn btn-primary" onclick="openCreateTeamModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Team
        </button>
      </div>
      <div class="teams-grid">
        ${teams.length ? teams.map(renderTeamCard).join('') : emptyState('No teams yet', 'Create a team to organize your work')}
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load teams</div></div>`;
  }
}

function renderTeamCard(t) {
  const memberAvatars = (t.members || []).slice(0, 5).map(m => avatarHtml(m.name, m.avatar_color, 'sm')).join('');
  return `<div class="team-card" onclick="openTeamDetail('${t.id}')">
    <div class="team-card-header">
      <div class="team-icon" style="background:${t.color}">${t.name[0].toUpperCase()}</div>
      <div><div class="team-name">${t.name}</div><div class="team-desc">${t.description || 'No description'}</div></div>
    </div>
    <div class="avatar-stack">${memberAvatars}</div>
    <div class="team-stats">
      <div>Members: <span>${t.members?.length || 0}</span></div>
      <div>Projects: <span>${t.project_count || 0}</span></div>
    </div>
  </div>`;
}

async function openTeamDetail(teamId) {
  Modal.open('Team Details', `<div class="loading"><div class="spin"></div></div>`, { large: true });
  try {
    const team = await API.get(`/teams/${teamId}`);
    document.getElementById('modal-title').textContent = team.name;
    const memberRows = (team.members || []).map(m => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        ${avatarHtml(m.name, m.avatar_color)}
        <div style="flex:1"><div style="font-weight:500">${m.name}</div><div style="font-size:12px;color:var(--text-muted)">${m.email}</div></div>
        <span class="badge badge-${m.role}">${m.role}</span>
        ${(team.created_by === State.user.id || State.user.role === 'admin') && m.id !== State.user.id
          ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="removeMember('${teamId}','${m.id}','team')">Remove</button>` : ''}
      </div>`).join('');
    document.getElementById('modal-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 250px;gap:20px">
        <div>
          <p style="color:var(--text-muted);margin-bottom:16px">${team.description || 'No description'}</p>
          <div class="section-header"><div class="section-title">Members (${team.members?.length || 0})</div>
            <button class="btn btn-secondary btn-sm" onclick="openAddMemberModal('${teamId}','team')">Add Member</button>
          </div>
          ${memberRows || '<p style="color:var(--text-muted);font-size:13px">No members</p>'}
        </div>
        <div>
          <div class="card">
            <div style="font-size:24px;font-weight:800;color:${team.color};margin-bottom:8px">${team.name[0]}</div>
            <div style="font-size:14px;color:var(--text-muted)">Created by ${team.creator?.name || 'Unknown'}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${team.project_count} project${team.project_count!==1?'s':''}</div>
          </div>
          ${(team.created_by === State.user.id || State.user.role === 'admin') ? `
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
              <button class="btn btn-danger btn-sm" onclick="deleteTeam('${teamId}')">Delete Team</button>
            </div>` : ''}
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
  }
}

function openCreateTeamModal() {
  Modal.open('Create Team', `
    <div class="form-group"><label>Team Name *</label><input id="tname" placeholder="e.g. Design Team" /></div>
    <div class="form-group"><label>Description</label><textarea id="tdescription" placeholder="What does this team work on?"></textarea></div>
    <div class="form-group"><label>Color</label><input type="color" id="tcolor" value="#4f46e5" style="width:60px;height:36px;padding:2px;cursor:pointer" /></div>
    <div class="modal-footer" style="padding:0;margin-top:20px">
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="createTeam()">Create Team</button>
    </div>`);
}

async function createTeam() {
  const name = document.getElementById('tname').value.trim();
  if (!name) { toast('Team name required', 'error'); return; }
  try {
    await API.post('/teams', { name, description: document.getElementById('tdescription').value, color: document.getElementById('tcolor').value });
    Modal.close();
    toast('Team created!', 'success');
    navigateTo('teams');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteTeam(id) {
  if (!confirm('Delete this team?')) return;
  try {
    await API.delete(`/teams/${id}`);
    Modal.close();
    toast('Team deleted', 'success');
    navigateTo('teams');
  } catch (e) { toast(e.message, 'error'); }
}

async function openAddMemberModal(entityId, type) {
  let users = [];
  try { users = await API.get('/users'); } catch { toast('Could not load users. You may need admin access.', 'warning'); return; }
  Modal.open(`Add Member`, `
    <div class="form-group"><label>Select User</label><select id="add-user-id">
      ${users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}
    </select></div>
    <div class="form-group"><label>Role</label><select id="add-user-role"><option value="member">Member</option><option value="admin">Admin</option></select></div>
    <div class="modal-footer" style="padding:0;margin-top:20px">
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="addMember('${entityId}','${type}')">Add Member</button>
    </div>`);
}

async function addMember(entityId, type) {
  const userId = document.getElementById('add-user-id').value;
  const role = document.getElementById('add-user-role').value;
  try {
    const endpoint = type === 'team' ? `/teams/${entityId}/members` : `/projects/${entityId}/members`;
    await API.post(endpoint, { user_id: userId, role });
    Modal.close();
    toast('Member added!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function removeMember(entityId, userId, type) {
  if (!confirm('Remove this member?')) return;
  try {
    const endpoint = type === 'team' ? `/teams/${entityId}/members/${userId}` : `/projects/${entityId}/members/${userId}`;
    await API.delete(endpoint);
    toast('Member removed', 'success');
    if (type === 'team') openTeamDetail(entityId);
  } catch (e) { toast(e.message, 'error'); }
}

// ===================== CALENDAR =====================
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;

async function renderCalendar(el) {
  el.innerHTML = `
    <div class="page-header"><div class="page-title">Calendar</div></div>
    <div class="calendar-wrap">
      <div class="calendar-header">
        <button class="btn btn-secondary btn-sm" onclick="changeMonth(-1)">← Prev</button>
        <div class="calendar-month" id="cal-month-title"></div>
        <button class="btn btn-secondary btn-sm" onclick="changeMonth(1)">Next →</button>
      </div>
      <div id="calendar-body"></div>
    </div>`;
  await loadCalendar();
}

async function loadCalendar() {
  const title = document.getElementById('cal-month-title');
  const body = document.getElementById('calendar-body');
  if (!title || !body) return;
  title.textContent = new Date(calYear, calMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  body.innerHTML = `<div class="loading"><div class="spin"></div></div>`;

  try {
    const tasks = await API.get(`/dashboard/calendar?year=${calYear}&month=${calMonth}`);
    const taskMap = {};
    tasks.forEach(t => {
      const day = t.due_date?.split('T')[0]?.split('-')[2];
      if (day) { if (!taskMap[parseInt(day)]) taskMap[parseInt(day)] = []; taskMap[parseInt(day)].push(t); }
    });

    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const prevDays = new Date(calYear, calMonth - 1, 0).getDate();
    const today = new Date();

    const headers = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-day-header">${d}</div>`).join('');
    const cells = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) cells.push(`<div class="cal-day other-month"><div class="cal-date">${prevDays - i}</div></div>`);

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && calMonth === today.getMonth() + 1 && calYear === today.getFullYear();
      const dayTasks = taskMap[d] || [];
      cells.push(`<div class="cal-day ${isToday ? 'today' : ''}">
        <div class="cal-date">${d}</div>
        ${dayTasks.slice(0, 3).map(t => `<div class="cal-task-dot" style="background:${statusColor(t.status)}" onclick="openTaskModal('${t.id}')" title="${t.title}">${t.title}</div>`).join('')}
        ${dayTasks.length > 3 ? `<div style="font-size:10px;color:var(--text-muted)">+${dayTasks.length - 3} more</div>` : ''}
      </div>`);
    }

    // Next month padding
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) cells.push(`<div class="cal-day other-month"><div class="cal-date">${d}</div></div>`);

    body.innerHTML = `<div class="calendar-grid">${headers}${cells.join('')}</div>`;
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load calendar</div></div>`;
  }
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 12) { calMonth = 1; calYear++; }
  if (calMonth < 1) { calMonth = 12; calYear--; }
  loadCalendar();
}

// ===================== NOTIFICATIONS =====================
async function renderNotifications(el) {
  try {
    const data = await API.get('/dashboard/notifications');
    el.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Notifications</div><div class="page-subtitle">${data.unread_count} unread</div></div>
        ${data.unread_count > 0 ? `<button class="btn btn-secondary" onclick="markAllRead()">Mark all read</button>` : ''}
      </div>
      <div class="card">
        <div class="notif-list">
          ${data.notifications.length ? data.notifications.map(n => `
            <div class="notif-item ${!n.is_read ? 'unread' : ''}" onclick="markRead('${n.id}')">
              <div class="notif-icon">${svgBell()}</div>
              <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-message">${n.message}</div>
                <div class="notif-time">${timeAgo(n.created_at)}</div>
              </div>
              ${!n.is_read ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0"></div>' : ''}
            </div>`).join('') : '<div class="empty-state" style="padding:40px"><div class="empty-title">No notifications</div></div>'}
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load notifications</div></div>`;
  }
}

async function markRead(id) {
  try {
    await API.put(`/dashboard/notifications/${id}/read`);
    fetchNotifCount();
    navigateTo('notifications');
  } catch {}
}

async function markAllRead() {
  try {
    await API.put('/dashboard/notifications/read-all');
    fetchNotifCount();
    navigateTo('notifications');
  } catch (e) { toast(e.message, 'error'); }
}

// ===================== ACTIVITY =====================
async function renderActivity(el) {
  try {
    const activity = await API.get('/dashboard/activity');
    el.innerHTML = `
      <div class="page-header"><div class="page-title">Activity Feed</div></div>
      <div class="card">
        <div class="activity-list">
          ${activity.length ? activity.map(a => `
            <div class="activity-item">
              ${avatarHtml(a.user_name, a.avatar_color)}
              <div class="activity-content">
                <div class="activity-text"><strong>${a.user_name}</strong> ${a.action} ${a.entity_type} "${a.entity_name || ''}"</div>
                <div class="activity-time">${timeAgo(a.created_at)}</div>
              </div>
            </div>`).join('') : '<div class="empty-state" style="padding:40px"><div class="empty-title">No activity yet</div></div>'}
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load activity</div></div>`;
  }
}

// ===================== PROFILE =====================
async function renderProfile(el) {
  try {
    const user = await API.get('/auth/me');
    const colors = ['#4f46e5','#7c3aed','#db2777','#dc2626','#ea580c','#d97706','#16a34a','#0891b2','#0284c7'];
    el.innerHTML = `
      <div class="page-header"><div class="page-title">Profile</div></div>
      <div class="profile-layout">
        <div>
          <div class="profile-card">
            <div class="profile-avatar" id="profile-avatar-display" style="background:${user.avatar_color}">${user.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div>
            <div class="profile-name">${user.name}</div>
            <div class="profile-email">${user.email}</div>
            <div class="profile-role">${user.role === 'admin' ? '⚡ Admin' : '👤 Member'}</div>
            <div class="color-picker" id="color-picker">
              ${colors.map(c => `<div class="color-swatch ${c===user.avatar_color?'active':''}" style="background:${c}" onclick="selectColor('${c}')"></div>`).join('')}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:12px">Member since ${formatDate(user.created_at)}</div>
          </div>
        </div>
        <div>
          <div class="card" style="margin-bottom:20px">
            <div class="card-header"><div class="card-title">Edit Profile</div></div>
            <div class="form-group"><label>Full Name</label><input id="prof-name" value="${user.name}" /></div>
            <div class="form-group"><label>Bio</label><textarea id="prof-bio" placeholder="Tell your team about yourself...">${user.bio || ''}</textarea></div>
            <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Change Password</div></div>
            <div class="form-group"><label>Current Password</label><input type="password" id="cur-pass" placeholder="••••••••" /></div>
            <div class="form-group"><label>New Password</label><input type="password" id="new-pass" placeholder="Min. 6 characters" /></div>
            <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
          </div>
        </div>
      </div>`;
    window._selectedColor = user.avatar_color;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load profile</div></div>`;
  }
}

function selectColor(color) {
  window._selectedColor = color;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.style.background === color));
  document.getElementById('profile-avatar-display').style.background = color;
}

async function saveProfile() {
  const name = document.getElementById('prof-name').value.trim();
  if (!name) { toast('Name required', 'error'); return; }
  try {
    const user = await API.put('/auth/profile', { name, bio: document.getElementById('prof-bio').value, avatar_color: window._selectedColor || State.user.avatar_color });
    State.user = { ...State.user, ...user };
    initAppUI();
    toast('Profile saved!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function changePassword() {
  const cur = document.getElementById('cur-pass').value;
  const nw = document.getElementById('new-pass').value;
  if (!cur || !nw) { toast('Both passwords required', 'error'); return; }
  try {
    await API.put('/auth/password', { current_password: cur, new_password: nw });
    document.getElementById('cur-pass').value = '';
    document.getElementById('new-pass').value = '';
    toast('Password updated!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ===================== USERS (Admin) =====================
async function renderUsers(el) {
  if (State.user.role !== 'admin') {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Admin access required</div></div>`;
    return;
  }
  try {
    const users = await API.get('/users');
    el.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">User Management</div><div class="page-subtitle">${users.length} users</div></div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="users-table">
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map(u => `<tr>
              <td><div style="display:flex;align-items:center;gap:10px">${avatarHtml(u.name, u.avatar_color)}<span style="font-weight:500">${u.name}</span></div></td>
              <td style="color:var(--text-muted)">${u.email}</td>
              <td>
                <select onchange="changeUserRole('${u.id}',this.value)" ${u.id === State.user.id ? 'disabled' : ''} style="width:auto;padding:5px 10px">
                  <option value="member" ${u.role==='member'?'selected':''}>Member</option>
                  <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                </select>
              </td>
              <td style="color:var(--text-muted);font-size:13px">${timeAgo(u.last_login) || 'Never'}</td>
              <td>${u.id !== State.user.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}','${u.name}')">Delete</button>` : '<span style="color:var(--text-muted);font-size:12px">You</span>'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load users</div></div>`;
  }
}

async function changeUserRole(userId, role) {
  try {
    await API.put(`/users/${userId}/role`, { role });
    toast(`Role updated to ${role}`, 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteUser(userId, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    await API.delete(`/users/${userId}`);
    toast('User deleted', 'success');
    navigateTo('users');
  } catch (e) { toast(e.message, 'error'); }
}

// ===================== HELPERS =====================
function emptyState(title, desc, onclick) {
  return `<div class="empty-state">
    <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div>
    <div class="empty-title">${title}</div>
    <div class="empty-desc">${desc}</div>
    ${onclick ? `<button class="btn btn-primary" onclick="${onclick}">Get Started</button>` : ''}
  </div>`;
}

// SVG icons
function svgFolder() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M2 7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2z"/></svg>`; }
function svgCheck() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`; }
function svgClock() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`; }
function svgAlert() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`; }
function svgUsers() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`; }
function svgBell() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`; }
