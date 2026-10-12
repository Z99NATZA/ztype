import { expect, test, type Page } from '@playwright/test';

async function selectSet(page: Page, name: string) {
  await page.getByLabel('เลือกชุดข้อความ').click();
  await page.getByRole('combobox', { name: 'ค้นหาชุดฝึก' }).fill(name);
  await page.getByRole('option', { name, exact: true }).click();
}

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

const pickerSets = [
  ['A quiet morning', 'passage', 'one two'],
  ['วันสบาย ๆ', 'passage', 'ที่ ดี'],
  ['convention-commit', 'passage', 'hello world'],
  ['request', 'passage', 'small steps'],
  ['Everyday words', 'words', 'quiet morning'],
  ['คำภาษาไทย', 'words', 'วันนี้ พรุ่งนี้'],
] as const;
async function mockPicker(page: Page) {
  await page.route('**/api/sets', route => route.fulfill({ json: pickerSets.map(([name, kind, content], index) => ({
    id: `picker-${index}`, name, kind, content, createdAt: '', updatedAt: '',
  })) }));
  await page.goto('/');
}

test('set picker groups sets, searches names and remembers the selected set', async ({ page }) => {
  await mockPicker(page);
  const trigger = page.getByLabel('เลือกชุดข้อความ');
  await trigger.click();
  const search = page.getByRole('combobox', { name: 'ค้นหาชุดฝึก' });
  await expect(search).toBeFocused();
  await expect(page.getByRole('group', { name: 'ข้อความ', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'คลังคำสุ่ม', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { selected: true })).toHaveAccessibleName('A quiet morning');
  await search.fill('CONVENTION');
  await expect(page.getByRole('option')).toHaveCount(1);
  await search.press('Enter');
  await expect(trigger).toHaveText('convention-commit');
  await expect(page.getByLabel('พื้นที่ฝึกพิมพ์')).toBeFocused();
  await page.reload();
  await expect(trigger).toHaveText('convention-commit');
  await trigger.click();
  await expect(page.getByRole('option', { selected: true })).toHaveAccessibleName('convention-commit');
  await page.screenshot({ path: '.artifacts/set-picker-desktop.png', fullPage: true });
  await search.fill('ไม่ตรงกับชื่อใด');
  await expect(page.getByRole('status')).toHaveText('ไม่พบชุดข้อความ');
  await expect(page.getByRole('option')).toHaveCount(0);
  await search.press('Enter');
  await expect(trigger).toHaveText('convention-commit');
  await expect(search).toBeVisible();
});

test('picker keyboard navigation and dismissal leave the current typing draft intact', async ({ page }) => {
  await mockPicker(page);
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.pressSequentially('o');
  const trigger = page.getByLabel('เลือกชุดข้อความ');
  await trigger.focus();
  await trigger.press('ArrowDown');
  const search = page.getByRole('combobox', { name: 'ค้นหาชุดฝึก' });
  await search.fill('request');
  await search.press('Space');
  await expect(search).toHaveValue('request ');
  await expect(input).toHaveValue('o');
  await search.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('A quiet morning');
  await expect(input).toHaveValue('o');
  await trigger.click();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await expect(search).toHaveCount(0);
  await expect(input).toHaveValue('o');
  await trigger.click();
  await search.press('Tab');
  await expect(search).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'เวลา', exact: true })).toBeFocused();
  await trigger.focus();
  await trigger.press('ArrowDown');
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(trigger).toHaveText('วันสบาย ๆ');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
});

test('mobile picker wraps long names and scrolls keyboard choices into view', async ({ page }) => {
  const longName = 'long-name-'.repeat(10);
  const sets = Array.from({ length: 30 }, (_, index) => ({
    id: `mobile-picker-${index}`, name: index === 29 ? longName : `Practice ${index + 1}`, kind: 'passage', content: 'one two', createdAt: '', updatedAt: '',
  }));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route('**/api/sets', route => route.fulfill({ json: sets }));
  await page.goto('/');
  const trigger = page.getByLabel('เลือกชุดข้อความ');
  await trigger.click();
  const search = page.getByRole('combobox', { name: 'ค้นหาชุดฝึก' });
  await search.press('ArrowUp');
  await expect.poll(async () => page.getByRole('listbox').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const menu = await page.locator('.set-picker-popover').boundingBox();
  expect(menu).not.toBeNull();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: '.artifacts/set-picker-mobile.png', fullPage: true });
  await search.press('Enter');
  await expect(trigger).toHaveText(longName);
  await expect(page.getByLabel('พื้นที่ฝึกพิมพ์')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const viewport of [{ width: 1440, height: 500 }, { width: 390, height: 480 }]) {
  test(`changing practice settings preserves page scroll at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockPicker(page);
    const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
    await expect(input).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const name of ['15', 'จำนวนคำ', '10', 'ต้นฉบับ', 'เวลา', '60']) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(input).toBeFocused();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
    await page.getByRole('button', { name: 'กำหนดเอง', exact: true }).click();
    await expect(page.getByLabel('เวลา (1–3,600 วิ)')).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByLabel('เวลา (1–3,600 วิ)').fill('45');
    await page.getByRole('button', { name: 'ใช้ค่านี้' }).click();
    await expect(input).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await input.pressSequentially('o');
    await expect(input).toHaveValue('o');
  });
}

test('picker navigation scrolls its list without moving the page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.route('**/api/sets', route => route.fulfill({ json: Array.from({ length: 30 }, (_, index) => ({
    id: `scroll-picker-${index}`, name: `Practice ${index + 1}`, kind: 'passage', content: 'one two', createdAt: '', updatedAt: '',
  })) }));
  await page.goto('/');
  await expect(page.getByLabel('พื้นที่ฝึกพิมพ์')).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByLabel('เลือกชุดข้อความ').click();
  const search = page.getByRole('combobox', { name: 'ค้นหาชุดฝึก' });
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await search.press('ArrowUp');
  await expect.poll(async () => page.getByRole('listbox').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await search.press('Enter');
  await expect(page.getByLabel('พื้นที่ฝึกพิมพ์')).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('optional settings keep the page width stable when vertical overflow changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockPicker(page);
  const before = await page.locator('.practice-settings').boundingBox();
  expect(before).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { overflowY: style.overflowY, gutter: style.scrollbarGutter };
  })).toEqual({ overflowY: 'scroll', gutter: 'stable' });
  await page.getByRole('button', { name: 'จำนวนคำ', exact: true }).click();
  await page.getByRole('button', { name: 'กำหนดเอง', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
  const after = await page.locator('.practice-settings').boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBe(before!.x);
  expect(after!.width).toBe(before!.width);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

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
    await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveText(`${unique}-edited`);
    await page.reload();
    await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveText(`${unique}-edited`);
    await page.getByRole('button', { name: 'ชุดข้อความ', exact: true }).click();
    await page.getByRole('button', { name: `ลบ ${unique}-edited` }).click();
    await page.getByRole('button', { name: 'ลบชุด', exact: true }).click();
    await expect(page.getByRole('heading', { name: `${unique}-edited`, exact: true })).toHaveCount(0);
  } finally { if (id) await request.delete(`/api/sets/${id}`); }
});

test('word mode scores corrections and supports restart', async ({ page }) => {
  await page.goto('/');
  await selectSet(page, `${unique}-passage`);
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

for (const [content, kind, typed, remainder, skipped] of [
  ['alpha beta', 'passage', 'al', 'beta', 3],
  ['ที่', 'words', 'ท', 'ที่', 1],
  ['👩‍💻', 'words', '', '👩‍💻', 1],
] as const) {
  test(`Spacebar skips unfinished ${content} and aligns the next word`, async ({ page }) => {
    await page.route('**/api/sets', route => route.fulfill({ json: [{ id: 'space-test', name: 'Space test', kind, content, createdAt: '', updatedAt: '' }] }));
    await page.goto('/');
    if (kind === 'passage') await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
    else {
      await page.getByRole('button', { name: 'จำนวนคำ', exact: true }).click();
      await page.getByRole('button', { name: 'กำหนดเอง', exact: true }).click();
      await page.getByLabel('จำนวนคำ (1–1,000)').fill('2');
      await page.getByRole('button', { name: 'ใช้ค่านี้' }).click();
    }
    const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
    await input.focus();
    await input.pressSequentially(typed);
    await input.press('Space');
    const first = kind === 'passage' ? content.split(' ')[0] : content;
    expect((await input.inputValue()).length).toBe(first.length + 1);
    await expect(page.locator('.character.caret')).toHaveText(kind === 'passage' ? 'b' : remainder);
    await expect(page.locator('.character.incorrect')).not.toHaveCount(0);
    await input.pressSequentially(remainder);
    await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toBeVisible();
    await expect(page.getByText(`คงเหลือผิด ${skipped}`, { exact: false })).toBeVisible();
    await expect(page.getByText(`พิมพ์ผิด ${skipped} ครั้ง`, { exact: false })).toBeVisible();
  });
}

test('Spacebar advances from outside the input and can finish by skipping the last word', async ({ page }) => {
  await page.route('**/api/sets', route => route.fulfill({ json: [{ id: 'space-test', name: 'Space test', kind: 'passage', content: 'one two', createdAt: '', updatedAt: '' }] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.pressSequentially('o');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Space');
  await expect(input).toBeFocused();
  expect((await input.inputValue()).length).toBe(4);
  await expect(page.locator('.character.caret')).toHaveText('t');
  await input.pressSequentially('t');
  await input.press('Space');
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toBeVisible();
  await expect(page.getByText('คงเหลือผิด 4', { exact: false })).toBeVisible();
  await expect(page.getByText('พิมพ์ผิด 4 ครั้ง', { exact: false })).toBeVisible();
});

test('Spacebar does not advance during IME composition', async ({ page }) => {
  await page.goto('/');
  await selectSet(page, `${unique}-thai`);
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.focus();
  await input.dispatchEvent('compositionstart');
  await input.fill('ท');
  await input.dispatchEvent('keydown', { key: ' ', code: 'Space', isComposing: true });
  await expect(input).toHaveValue('ท');
  await input.fill('ที่');
  await input.dispatchEvent('compositionend');
  await input.press('Space');
  await expect(input).toHaveValue('ที่ ');
});

test('timer starts on first input, extends the text and ends at selected time', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await selectSet(page, `${unique}-words`);
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
  await selectSet(page, `${unique}-thai`);
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
  await selectSet(page, `${unique}-words`);
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
  await selectSet(page, `${unique}-passage`);
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
  await selectSet(page, `${unique}-passage`);
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
  await selectSet(page, `${unique}-passage`);
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
  await selectSet(page, `${unique}-original`);
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
  await selectSet(page, `${unique}-passage`);
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  await selectSet(page, `${unique}-words`);
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
  await selectSet(page, `${unique}-passage`);
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
  await selectSet(page, `${unique}-passage`);
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

test('next set starts fresh, persists the selection and wraps after the last set', async ({ page }) => {
  const sets = [
    { id: 'next-first', name: 'First set', kind: 'passage', content: 'alpha' },
    { id: 'next-second', name: 'Second set', kind: 'passage', content: 'beta' },
  ].map((set) => ({ ...set, createdAt: '', updatedAt: '' }));
  await page.route('**/api/sets', route => route.fulfill({ json: sets }));
  await page.goto('/');
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  const next = page.getByRole('button', { name: 'ชุดต่อไป', exact: true });
  await expect(next).toHaveCount(0);
  await input.fill('alpha');
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(next).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await next.click();
  await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveText('Second set');
  await expect(page.getByRole('button', { name: 'ต้นฉบับ', exact: true })).toHaveClass(/active/);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(page.locator('.typing-text')).toHaveText('beta');
  await expect(page.locator('.practice-topline')).toContainText('0%');
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveText('Second set');
  await input.pressSequentially('beta');
  await expect(page.getByRole('heading', { name: 'Second set', exact: true })).toBeVisible();
  await next.click();
  await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveText('First set');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(page.locator('.typing-text')).toHaveText('alpha');
});

test('next set adapts original mode for a word bank and waits for input to start its timer', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/sets', route => route.fulfill({ json: [
    { id: 'next-passage', name: 'Passage', kind: 'passage', content: 'one', createdAt: '', updatedAt: '' },
    { id: 'next-bank', name: 'Word bank', kind: 'words', content: 'two', createdAt: '', updatedAt: '' },
  ] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.fill('one');
  await page.getByRole('button', { name: 'ชุดต่อไป', exact: true }).click();
  await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveText('Word bank');
  await expect(page.getByRole('button', { name: 'ต้นฉบับ', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'เวลา', exact: true })).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: '30', exact: true })).toHaveClass(/active/);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await page.clock.fastForward(31000);
  await expect(page.getByRole('region', { name: 'ผลการฝึก' })).toHaveCount(0);
  await expect(page.locator('.practice-topline')).toContainText('30 วิ');
  await input.pressSequentially('two ');
  await page.clock.fastForward(31000);
  await expect(page.getByRole('heading', { name: 'Word bank', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ชุดต่อไป', exact: true })).toBeEnabled();
});

test('a single saved set disables next set and remains available for another round', async ({ page }) => {
  await page.route('**/api/sets', route => route.fulfill({ json: [
    { id: 'only-set', name: 'Only set', kind: 'passage', content: 'one', createdAt: '', updatedAt: '' },
  ] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'ต้นฉบับ', exact: true }).click();
  const input = page.getByLabel('พื้นที่ฝึกพิมพ์');
  await input.fill('one');
  await expect(page.getByRole('button', { name: 'ชุดต่อไป', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'ฝึกอีกครั้ง' }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(page.getByLabel('เลือกชุดข้อความ')).toHaveText('Only set');
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
