import { resolve } from 'node:path';
import { createApp } from './app.js';
import { JsonStore } from './store.js';

const store = new JsonStore(resolve(process.env.DATA_DIR ?? 'data', 'sets.json'));
await store.initialize();
const port = Number(process.env.PORT ?? 3000);
const server = createApp(store).listen(port, '0.0.0.0', () => {
  console.log(`softtype: http://localhost:${port}`);
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
