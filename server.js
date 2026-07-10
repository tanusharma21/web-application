'use strict';
const app = require('./app');
const { initDb } = require('./database');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Team Task Manager running on port ${PORT}`);
      console.log(`   Local: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
