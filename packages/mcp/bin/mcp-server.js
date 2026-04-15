#!/usr/bin/env node
// Suppress dotenv v17+ logging from Stagehand and other deps that call dotenv.config()
process.env.DOTENV_CONFIG_QUIET = 'true';
await import('../dist/server.js');
