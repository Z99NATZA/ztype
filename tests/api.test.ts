import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app';
import { JsonStore } from '../server/store';

let directory: string;
let store: JsonStore;
const draft = { name: 'My words', kind: 'words', content: 'hello world สวัสดี' };
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'softtype-test-')); store = new JsonStore(join(directory, 'sets.json')); await store.initialize(); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

describe('JSON API', () => {
  it('creates, edits, reloads and deletes a set in persistent JSON', async () => {
    const app = createApp(store);
    const created = await request(app).post('/api/sets').send(draft).expect(201);
    expect(created.body).toMatchObject(draft);
    await request(app).put(`/api/sets/${created.body.id}`).send({ ...draft, name: 'Updated' }).expect(200);
    const reloaded = new JsonStore(store.file);
    await reloaded.initialize();
    expect((await reloaded.list()).find((set) => set.id === created.body.id)?.name).toBe('Updated');
    await request(app).delete(`/api/sets/${created.body.id}`).expect(204);
    expect((await store.list()).some((set) => set.id === created.body.id)).toBe(false);
  });
  it('serializes parallel writes without losing sets', async () => {
    const initial = (await store.list()).length;
    await Promise.all(Array.from({ length: 20 }, (_, i) => request(createApp(store)).post('/api/sets').send({ ...draft, name: `set ${i}` }).expect(201)));
    expect(await store.list()).toHaveLength(initial + 20);
    const json = JSON.parse(await readFile(store.file, 'utf8'));
    expect(json.version).toBe(1);
    expect(new Set(json.sets.map((set: { id: string }) => set.id)).size).toBe(initial + 20);
  });
  it('validates content and does not persist invalid input', async () => {
    const app = createApp(store);
    await request(app).post('/api/sets').send({ ...draft, name: '  ' }).expect(400);
    await request(app).post('/api/sets').send({ ...draft, kind: 'invalid' }).expect(400);
    await request(app).post('/api/sets').send({ ...draft, content: ' , , ' }).expect(400);
    await request(app).post('/api/sets').send({ ...draft, content: 'a'.repeat(50001) }).expect(400);
    await request(app).post('/api/sets').set('Content-Type', 'application/json').send('{bad').expect(400);
    expect(await store.list()).toHaveLength(4);
  });
  it('returns clear not-found responses', async () => {
    const app = createApp(store);
    await request(app).put('/api/sets/missing').send(draft).expect(404);
    await request(app).delete('/api/sets/missing').expect(404);
    await request(app).get('/api/missing').expect(404);
    await request(app).get('/api/health').expect(200);
  });
  it('preserves corrupt data instead of replacing it with examples', async () => {
    await writeFile(store.file, 'invalid json');
    await expect(new JsonStore(store.file).initialize()).rejects.toThrow();
    expect(await readFile(store.file, 'utf8')).toBe('invalid json');
  });
});
