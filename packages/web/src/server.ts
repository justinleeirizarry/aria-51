import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { relative, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scanHandler } from './routes/scan.js';
import { promptHandler } from './routes/prompt.js';
import { wcagCriteriaHandler } from './routes/wcag-criteria.js';
import { ScannerPage } from './templates/page.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Hono();
app.use('*', cors());

// Serve static files from public/
const publicRoot = relative(process.cwd(), join(__dirname, 'public'));
app.use('/*', serveStatic({ root: publicRoot }));

app.get('/', (c) => {
    return c.html(ScannerPage());
});

app.post('/api/scan', scanHandler);
app.post('/api/prompt', promptHandler);
app.get('/api/wcag-criteria', wcagCriteriaHandler);

const port = 3847;
console.log(`Accessibility Scanner running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
