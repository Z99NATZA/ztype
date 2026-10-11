import express, { type ErrorRequestHandler } from 'express';
import { resolve } from 'node:path';
import { JsonStore, draftSchema } from './store.js';

export function createApp(store: JsonStore, staticDir = resolve('dist')) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', async (_request, response) => {
    await store.list();
    response.json({ status: 'ok' });
  });
  app.get('/api/sets', async (_request, response) => {
    response.set('Cache-Control', 'no-store').json(await store.list());
  });
  app.post('/api/sets', async (request, response) => {
    const parsed = draftSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: parsed.error.issues[0].message }); return; }
    response.status(201).json(await store.create(parsed.data));
  });
  app.put('/api/sets/:id', async (request, response) => {
    const parsed = draftSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const set = await store.update(request.params.id, parsed.data);
    if (!set) { response.status(404).json({ error: 'ไม่พบชุดข้อความนี้' }); return; }
    response.json(set);
  });
  app.delete('/api/sets/:id', async (request, response) => {
    if (!await store.delete(request.params.id)) { response.status(404).json({ error: 'ไม่พบชุดข้อความนี้' }); return; }
    response.status(204).end();
  });
  app.use('/api', (_request, response) => { response.status(404).json({ error: 'ไม่พบ API นี้' }); });
  app.use(express.static(staticDir));
  app.get('/{*path}', (_request, response) => { response.sendFile(resolve(staticDir, 'index.html')); });
  const onError: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed') { response.status(400).json({ error: 'รูปแบบ JSON ไม่ถูกต้อง' }); return; }
    if (error.type === 'entity.too.large') { response.status(413).json({ error: 'ข้อมูลมีขนาดใหญ่เกินไป' }); return; }
    console.error(error);
    response.status(500).json({ error: 'ไม่สามารถอ่านหรือบันทึกข้อมูลได้ กรุณาลองอีกครั้ง' });
  };
  app.use(onError);
  return app;
}
