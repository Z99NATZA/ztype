import { expect, test } from '@playwright/test';

let passageId: string;
let wordsId: string;
let thaiId: string;
let originalId: string;
const unique = `e2e-${Date.now()}`;
test.beforeAll(async ({ request }) => {
  for (const [name, kind, content] of [[`${unique}-passage`, 'passage', 'one two three four five six seven eight nine ten'], [`${unique}-words`, 'words', 'alpha beta gamma'], [`${unique}-thai`, 'passage', 'ที่ ดี มี ใจ'], [`${unique}-original`, 'passage', 'one  two\n\nthree\tfour.']] as const) {
    const response = await request.post('/api/sets', { data: { name, kind, content } });
    expect(response.ok()).toBeTruthy();
    const { id } = await response.json();
    if (kind === 'words') wordsId = id;
    else if (name.endsWith('thai')) thaiId = id;
    else if (name.endsWith('original')) originalId = id;
    else passageId = id;
  }
});
test.afterAll(async ({ request }) => { for (const id of [passageId, wordsId, thaiId, originalId]) if (id) await request.delete(`/api/sets/${id}`); });

test('named sets can be created, edited, selected, and deleted', async ({ page, request }) => {
  let id: string | undefined;
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'ชุดข้อความ', exact: true }).click();
    await page.getByRole('button', { name: 'เพิ่มชุด', exact: true }).click();
    await page.getByLabel('ชื่อชุด').fill(`${unique}-created`);
    await page.getByRole('button', { name: 'คลังคำสุ่ม' }).click();
    await page.getByLabel('คำที่ต้องการฝึก', { exact: true }).fill('sun moon stars');
    const saved = page.waitForResponse((response) => response.url().endsWith('/api/sets') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'บันทึกชุด' }).click();
    id = (await (await saved).json()).id;
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: `${unique}-created`, exact: true }) });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: `แก้ไข ${unique}-created` }).click();
    await page.getByLabel('ชื่อชุด').fill(`${unique}-edited`);
    await page.getByRole('button', { name: 'บันทึกชุด' }).click();
    const edited = page.getByRole('article').filter({ has: page.getByRole('heading', { name: `${unique}-edited`, exact: true }) });
    await edited.getByRole('button', { name: 'ฝึกชุดนี้' }).click();
    await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveValue(id!);
    await page.reload();
    await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveValue(id!);
    await page.getByRole('button', { name: 'ชุดข้อความ', exact: true }).click();
    await page.getByRole('button', { name: `ลบ ${unique}-edited` }).click();
    await page.getByRole('button', { name: 'ลบชุด', exact: true }).click();
    await expect(page.getByRole('heading', { name: `${unique}-edited`, exact: true })).toHaveCount(0);
  } finally { if (id) await request.delete(`/api/sets/${id}`); }
});

test('word mode scores corrections and supports restart', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(passageId);
  await page.getByRole('button', { name: 'จำนวนคำ', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByLabel('พื้นที่ฝึกพิมพ์').focus();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.pressSequentially('x');
  await input.press('Backspace');
  await input.pressSequentially('one two three four five six seven eight nine ten', { delay: 5 });
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toBeVisible();
  await expect(page.getByText('พิมพ์ผิด 1 ครั้ง', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'ฝึกอีกครั้ง' }).click();
  await expect(page.getByLabel('พื้นที่ฝึกพิมพ์')).toBeFocused();
});

test('timer starts on first input, extends the text and ends at selected time', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(wordsId);
  await page.getByRole('button', { name: 'เวลา', exact: true }).click();
  await page.getByRole('button', { name: 'กำหนดเอง', exact: true }).click();
  await page.getByLabel('เวลา (1–3,600 วิ)').fill('2');
  await page.getByRole('button', { name: 'ใช้ค่านี้' }).click();
  await page.clock.fastForward(5000);
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toHaveCount(0);
  await page.getByLabel('พื้นที่ฝึกพิมพ์').focus();
  const target = await page.locator('.typing-text').textContent();
  await page.getByLabel('พื้นที่ฝึกพิมพ์').fill(target!);
  await expect(page.locator('.typing-text')).not.toHaveText(target!);
  await page.clock.fastForward(2100);
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toBeVisible();
});

test('Thai combining marks and IME composition remain intact', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(thaiId);
  await page.getByRole('button', { name: 'จำนวนคำ', exact: true }).click();
  await page.getByRole('button', { name: 'กำหนดเอง', exact: true }).click();
  await page.getByLabel('จำนวนคำ (1–1,000)').fill('4');
  await page.getByRole('button', { name: 'ใช้ค่านี้' }).click();
  await page.getByLabel('พื้นที่ฝึกพิมพ์').focus();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.dispatchEvent('compositionstart');
  await input.fill('ที่');
  await expect(page.locator('.practice-topline')).toContainText('100%');
  await input.dispatchEvent('compositionend');
  await input.pressSequentially(' ดี มี ใจ', { delay: 20 });
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toBeVisible();
  await expect(page.getByText('พิมพ์ผิด 0 ครั้ง', { exact: false })).toBeVisible();
});

test('long sessions scroll to the caret and prevent pasted input', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(wordsId);
  await page.getByRole('button', { name: 'จำนวนคำ', exact: true }).click();
  await page.getByRole('button', { name: '100', exact: true }).click();
  await page.getByLabel('พื้นที่ฝึกพิมพ์').focus();
  const blocked = await page.getByLabel('พื้นที่ฝึกพิมพ์').evaluate((element) => !element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })));
  expect(blocked).toBe(true);
  const target = await page.locator('.typing-text').textContent();
  await page.getByLabel('พื้นที่ฝึกพิมพ์').fill(target!.slice(0, 350));
  await expect.poll(async () => {
    const area = await page.locator('.text-viewport').boundingBox();
    const caret = await page.locator('.character.caret').boundingBox();
    return !!area && !!caret && caret.y >= area.y && caret.y + caret.height <= area.y + area.height;
  }).toBe(true);
  await page.getByLabel('พื้นที่ฝึกพิมพ์').press('Escape');
  await expect(page.getByLabel('พื้นที่ฝึกพิมพ์')).toHaveValue('');
});

test('Enter resumes typing without a start gate or focus overlay', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(passageId);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Enter');
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(page.locator('.focus-prompt')).toHaveCount(0);
  await input.pressSequentially('one ');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await expect(input).not.toBeFocused();
  await expect(page.locator('.focus-prompt')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('one ');
});

test('correct completed words resist Backspace, word deletion and mobile-style deletion', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(passageId);
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  await page.getByLabel('พื้นที่ฝึกพิมพ์').focus();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.pressSequentially('one ');
  await input.press('Backspace');
  await expect(input).toHaveValue('one ');
  await input.pressSequentially('tw');
  await input.press('Control+Backspace');
  await expect(input).toHaveValue('one ');
  await input.press('Control+Backspace');
  await expect(input).toHaveValue('one ');
  await input.fill('');
  await expect(input).toHaveValue('one ');
  await input.pressSequentially('twy');
  await input.press('Backspace');
  await input.pressSequentially('o ');
  await expect(input).toHaveValue('one two ');
  await input.press('Backspace');
  await expect(input).toHaveValue('one two ');
  await input.press('Escape');
  await expect(input).toHaveValue('');
});

test('incorrect completed words remain editable until corrected', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(passageId);
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  await page.getByLabel('พื้นที่ฝึกพิมพ์').focus();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.pressSequentially('oxe ');
  await input.press('Control+Backspace');
  await input.press('Control+Backspace');
  await expect(input).toHaveValue('');
  await input.pressSequentially('one ');
  await input.press('Backspace');
  await expect(input).toHaveValue('one ');
});

test('original mode has no limits, preserves whitespace and completes only at the end', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(originalId);
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'กำหนดเอง', exact: true })).toHaveCount(0);
  await expect(page.locator('.typing-text')).toHaveText('one  two\n\nthree\tfour.', { useInnerText: false });
  await page.reload();
  await expect(page.getByRole('button', { name: 'ต้นฉบับ', exact: true })).toHaveClass(/active/);
  await page.getByLabel('พื้นที่ฝึกพิมพ์').focus();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.pressSequentially('one  two');
  await page.clock.fastForward(3601000);
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toHaveCount(0);
  await expect(input).toHaveValue('one  two');
  await input.press('Enter');
  await input.press('Enter');
  await input.pressSequentially('three');
  await input.press('Tab');
  await input.pressSequentially('four.');
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toBeVisible();
  await expect(page.getByText('พิมพ์ผิด 0 ครั้ง', { exact: false })).toBeVisible();
});

test('original mode is only available for passages and caret respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(passageId);
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  await page.getByLabel('เลือกชุดข้อความ').selectOption(wordsId);
  await expect(page.getByRole('button', { name: 'ต้นฉบับ', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'เวลา', exact: true })).toHaveClass(/active/);
  await page.getByLabel('พื้นที่ฝึกพิมพ์').focus();
  await expect(page.locator('.smooth-caret')).toHaveCSS('transition-duration', '0s');
});

test('typing starts immediately and continues after changing settings or losing focus', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.goto('/');
  await expect(page.getByLabel('พื้นที่ฝึกพิมพ์')).toBeFocused();
  await page.getByLabel('เลือกชุดข้อความ').selectOption(passageId);
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  await page.keyboard.type('one ');
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await expect(input).toHaveValue('one ');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.type('two ');
  await expect(input).toHaveValue('one two ');
  await expect(input).toBeFocused();
  await expect(page.locator('.focus-prompt, .toast')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('Enter on results starts a new round ready for immediate typing', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('เลือกชุดข้อความ').selectOption(passageId);
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.fill('one two three four five six seven eight nine ten');
  const restart = page.getByRole('button', { name: 'ฝึกอีกครั้ง' });
  await expect(restart).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await page.keyboard.type('one ');
  await expect(input).toHaveValue('one ');
  await input.fill('one two three four five six seven eight nine ten');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
});

test('long original passages stay compact and keep the actual animated caret visible', async ({ page }) => {
  const content = 'one two three four five six seven eight nine ten. '.repeat(600).trim();
  await page.route('**/api/sets', route => route.fulfill({ json: [{ id: 'long-test', name: 'Long passage', kind: 'passage', content, createdAt: '', updatedAt: '' }] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.fill(content.slice(0, 12000));
  await input.pressSequentially(content.slice(12000, 12100));
  await expect(input).toHaveValue(content.slice(0, 12100));
  await expect(page.locator('.typing-text')).toHaveText(content);
  expect(await page.locator('.typing-text').locator('*').count()).toBeLessThan(1000);
  await expect.poll(async () => {
    const area = await page.locator('.text-viewport').boundingBox();
    const caret = await page.locator('.smooth-caret').boundingBox();
    const anchor = await page.locator('.character.caret').boundingBox();
    return !!area && !!caret && !!anchor && caret.y >= area.y && caret.y + caret.height <= area.y + area.height && Math.abs(caret.x - anchor.x) <= 2 && Math.abs(caret.y - anchor.y) <= 2;
  }).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await input.pressSequentially(content.slice(12100, 12120));
  await expect(input).toHaveValue(content.slice(0, 12120));
  await expect.poll(async () => {
    const area = await page.locator('.text-viewport').boundingBox();
    const caret = await page.locator('.smooth-caret').boundingBox();
    return !!area && !!caret && caret.y >= area.y && caret.y + caret.height <= area.y + area.height;
  }).toBe(true);
});

test('desktop and mobile have no overflow or runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByLabel('พื้นที่ฝึกพิมพ์')).toBeFocused();
  await page.screenshot({ path: '.artifacts/practice-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'ชุดข้อความ', exact: true }).click();
  await page.screenshot({ path: '.artifacts/library-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'ฝึกพิมพ์', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/practice-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'ชุดข้อความ', exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่มชุด', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/editor-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
