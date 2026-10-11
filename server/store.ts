import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { TextSet, SetDraft } from '../shared/types.js';

export const draftSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาใส่ชื่อชุด').max(100, 'ชื่อยาวได้ไม่เกิน 100 ตัวอักษร'),
  kind: z.enum(['passage', 'words']),
  content: z.string().trim().min(1, 'กรุณาใส่ข้อความ').max(50000, 'ข้อความยาวได้ไม่เกิน 50,000 ตัวอักษร'),
}).strict().refine((draft) => draft.kind !== 'words' || draft.content.split(/[\s,]+/u).some(Boolean), {
  message: 'กรุณาใส่อย่างน้อยหนึ่งคำ', path: ['content'],
});

const documentSchema = z.object({
  version: z.literal(1),
  sets: z.array(draftSchema.safeExtend({
    id: z.string(), createdAt: z.string(), updatedAt: z.string(),
  })),
});

const examples: SetDraft[] = [
  { name: 'A quiet morning', kind: 'passage', content: 'Take a moment to slow down. Open the window and let the morning light in. There is no need to hurry. Small steps, taken every day, can carry you a long way.' },
  { name: 'Everyday words', kind: 'words', content: 'quiet morning light window coffee garden simple gentle little space cloud river book dream green slow warm clear home calm learn make day open time kind soft' },
  { name: 'วันสบาย ๆ', kind: 'passage', content: 'เช้าวันนี้อากาศดี ลองเปิดหน้าต่างรับลม แล้วค่อย ๆ เริ่มทำสิ่งที่ตั้งใจไว้ ไม่จำเป็นต้องรีบร้อน การฝึกฝนวันละนิดช่วยให้เราเก่งขึ้นได้' },
  { name: 'คำภาษาไทย', kind: 'words', content: 'ท้องฟ้า สายลม แสงแดด ต้นไม้ ดอกไม้ หนังสือ บ้าน กาแฟ ความสุข เรียนรู้ พักผ่อน เดินทาง วันนี้ พรุ่งนี้ อบอุ่น สงบ เรียบง่าย' },
];

/** Single-process write queue plus atomic rename keeps parallel CRUD requests safe. */
export class JsonStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly file: string) {}

  private async read(): Promise<TextSet[]> {
    return documentSchema.parse(JSON.parse(await readFile(this.file, 'utf8'))).sets;
  }

  private async write(sets: TextSet[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify({ version: 1, sets }, null, 2) + '\n', { mode: 0o600 });
    await rename(temporary, this.file);
  }

  async initialize(): Promise<void> {
    try { await this.read(); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const now = new Date().toISOString();
      await this.write(examples.map((draft) => ({ ...draft, id: randomUUID(), createdAt: now, updatedAt: now })));
    }
  }

  async list(): Promise<TextSet[]> { await this.queue; return this.read(); }

  private mutate<T>(operation: (sets: TextSet[]) => T): Promise<T> {
    const pending = this.queue.then(async () => {
      const sets = await this.read();
      const result = operation(sets);
      await this.write(sets);
      return result;
    });
    this.queue = pending.catch(() => {});
    return pending;
  }

  create(draft: SetDraft): Promise<TextSet> {
    return this.mutate((sets) => {
      const now = new Date().toISOString();
      const set = { ...draft, id: randomUUID(), createdAt: now, updatedAt: now };
      sets.push(set);
      return set;
    });
  }

  update(id: string, draft: SetDraft): Promise<TextSet | undefined> {
    return this.mutate((sets) => {
      const index = sets.findIndex((set) => set.id === id);
      if (index < 0) return undefined;
      sets[index] = { ...sets[index], ...draft, updatedAt: new Date().toISOString() };
      return sets[index];
    });
  }

  delete(id: string): Promise<boolean> {
    return this.mutate((sets) => {
      const index = sets.findIndex((set) => set.id === id);
      if (index < 0) return false;
      sets.splice(index, 1);
      return true;
    });
  }
}
