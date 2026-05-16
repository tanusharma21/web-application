# Team Task Manager

A full-stack **Team Task Manager** web application built with **Node.js, Express, vanilla JavaScript, HTML, CSS, and SQL.js**.

The app includes authentication, teams, projects, tasks, dashboard views, and a responsive UI/UX.

---

## Features

- User registration and login
- Role-based access support
- Team management
- Project management
- Task creation and tracking
- Dashboard overview
- Responsive modern UI
- Local SQL.js database storage
- Railway-ready Node.js deployment

---

## Tech Stack

**Frontend**

- HTML
- CSS
- JavaScript

**Backend**

- Node.js
- Express.js

**Database**

- SQL.js
- Local database file stored inside the `data/` folder

---

## Project Structure

```text
team-task-manager/
├── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js
│       └── pages.js
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── teams.js
│   ├── projects.js
│   ├── tasks.js
│   └── dashboard.js
├── middleware/
│   └── auth.js
├── database.js
├── server.js
├── package.json
└── package-lock.json
```

---

## Requirements

Install these before running the project:

- Node.js version 18 or above
- npm
- VS Code

Check Node.js version:

```bash
node -v
```

Check npm version:

```bash
npm -v
```

---

## How to Run Locally in VS Code

### 1. Open the project folder

Open VS Code, then go to:

```text
File → Open Folder
```

Select the main project folder:

```text
team-task-manager
```

Make sure the folder contains:

```text
package.json
server.js
public
routes
database.js
```

---

### 2. Open VS Code terminal

Use:

```text
Terminal → New Terminal
```

Or press:

```text
Ctrl + `
```

---

### 3. Install dependencies

Run:

```bash
npm install
```

---

### 4. Start the project

Run:

```bash
npm start
```

The project will start on port `3000`.

Open this in your browser:

```text
http://localhost:3000
```

---

## Alternative Run Command

If `npm start` does not work, run:

```bash
node server.js
```

---

## Available Scripts

From `package.json`:

```json
"scripts": {
  "start": "node server.js",
  "dev": "node server.js"
}
```

Run development mode:

```bash
npm run dev
```

Run production/start mode:

```bash
npm start
```

---

## Environment Variables

The app uses these environment variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `DB_PATH` | Custom database file path | `data/taskmanager.db` |

Example:

```bash
PORT=3000 npm start
```

On Windows PowerShell:

```powershell
$env:PORT=3000
npm start
```

---

## Upload Project to GitHub

Run these commands inside the project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

Create a new repository on GitHub.

Then connect your local project to GitHub:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Example:

```bash
git remote add origin https://github.com/tanvi4365/team-task-manager.git
git push -u origin main
```

If remote already exists, use:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

---

## Deploy on Railway

### 1. Push project to GitHub

Railway works best when your project is already uploaded to GitHub.

---

### 2. Create a Railway project

Go to Railway and choose:

```text
New Project → Deploy from GitHub Repo
```

Select your GitHub repository.

---

### 3. Railway build settings

Railway should detect this as a Node.js project automatically.

Use this start command if Railway asks:

```bash
npm start
```

Or:

```bash
node server.js
```

---

### 4. Generate public domain

After deployment:

```text
Service → Settings → Networking → Generate Domain
```

Railway will give you a public URL like:

```text
https://your-project-name.up.railway.app
```

---

## Important Notes for Railway

- Deploy the main folder where `package.json` exists.
- Do not deploy only the `public` folder.
- Do not deploy only the `routes` folder.
- Railway needs `package.json` and `server.js` in the deployed root.
- The app uses `process.env.PORT`, so Railway can assign the correct port automatically.

---

## Common Errors and Fixes

### Error: Missing script: start

Check `package.json`.

It should contain:

```json
"scripts": {
  "start": "node server.js"
}
```

Then run:

```bash
npm start
```

---

### Error: Cannot find module

Run:

```bash
npm install
```

Then start again:

```bash
npm start
```

---

### Error: Port already in use

Use another port:

Windows PowerShell:

```powershell
$env:PORT=4000
npm start
```

Then open:

```text
http://localhost:4000
```

---

### Railway deploy failed

Check these things:

1. `package.json` is present in the root folder.
2. `server.js` is present in the root folder.
3. `package.json` has `"start": "node server.js"`.
4. Your GitHub repo contains all required files.
5. You deployed the correct repo on Railway.

---

## Health Check

The app has a health check route:

```text
/health
```

Local URL:

```text
http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "..."
}
```

---

## Author

Created by Tanu Sharma.

---

## License

This project is for learning and deployment practice.
