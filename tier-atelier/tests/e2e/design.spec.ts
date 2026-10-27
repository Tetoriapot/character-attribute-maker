import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import type { Project } from '../../src/data/types';

const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; issues.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
});
test.afterEach(({ page }) => { expect(issues.get(page)).toEqual([]); });
const pane = (page: Page, mobile: boolean) => page.getByRole(mobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
async function design(page: Page, mobile: boolean) {
  await page.locator(mobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click();
  return pane(page, mobile);
}
async function close(page: Page, mobile: boolean) { if (mobile) await pane(page, mobile).getByRole('button', { name: '閉じる', exact: true }).click(); }
async function photo(page: Page, name = '背景 日本語.png') {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e77766'; ctx.fillRect(0, 0, 100, 120);
    ctx.fillStyle = '#558fc2'; ctx.fillRect(100, 0, 100, 120);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('A', 40, 70); ctx.fillText('B', 140, 70);
    return canvas.toDataURL().split(',')[1]!;
  });
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}
async function upload(page: Page, count: number) {
  const file = await photo(page);
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '画像を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '画像を追加', exact: true });
  await dialog.getByLabel('画像ファイルを選択').setInputFiles(Array.from({ length: count }, (_, index) => ({ ...file, name: `画像${index + 1}.png` })));
  await expect(dialog.getByRole('status')).toContainText(`${count}枚の画像を登録しました`);
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
}
type Backup = { project: Project; blobs: { key: string; dataBase64: string }[] };
async function backup(page: Page): Promise<Backup> {
  const wait = page.waitForEvent('download');
  await page.locator('.canvas-footer button').click();
  return JSON.parse(await readFile((await (await wait).path())!, 'utf8')) as Backup;
}
async function section(page: Page, mobile: boolean, name: string) { await pane(page, mobile).locator('summary').filter({ hasText: name }).click(); }

test('custom appearance, individual dimensions and visibility survive autosave and reload', async ({ page, isMobile }) => {
  await upload(page, 1);
  const properties = await design(page, isMobile);
  await properties.getByLabel('背景の種類', { exact: true }).selectOption('gradient');
  await properties.getByLabel('背景色のカラーコード', { exact: true }).fill('#f8ead5');
  await properties.getByLabel('補助色のカラーコード').fill('#d5eafa');
  await properties.getByLabel('角度（度）').fill('90');
  await section(page, isMobile, '文字・見出し');
  await properties.getByLabel('フォント', { exact: true }).selectOption('serif');
  await properties.getByLabel('見出しの配置').selectOption('center');
  await properties.getByLabel('見出しの装飾').selectOption('line');
  await properties.getByLabel('見出し文字サイズ（px）').fill('36');
  await section(page, isMobile, 'サイズ・余白');
  for (const [label, value] of [['ラベル幅（px）', '120'], ['画像サイズ（px）', '100'], ['アイテム間隔（px）', '16'], ['内側の余白（px）', '16'], ['Tier間隔（px）', '8']]) await properties.getByLabel(label!, { exact: true }).fill(value!);
  await section(page, isMobile, 'カード・枠');
  await properties.getByLabel('画像の表示方法').selectOption('cover');
  await properties.getByLabel('角丸（px）').fill('20');
  await properties.getByLabel('枠線の太さ（px）').fill('3');
  await properties.getByLabel('影', { exact: true }).selectOption('hard');
  await properties.getByRole('button', { name: 'デザインを保存' }).click();
  await expect(properties.getByRole('status')).toHaveText('デザインを保存しました。');
  await close(page, isMobile);
  await expect(page.locator('.design-surface')).toHaveCSS('background-image', 'linear-gradient(90deg, rgb(248, 234, 213), rgb(213, 234, 250))');
  await expect(page.locator('.item-card')).toHaveCSS('border-radius', '20px');
  await expect(page.locator('.item-thumbnail')).toHaveCSS('object-fit', 'cover');
  await page.getByLabel('ランク「S」を編集', { exact: true }).click();
  await properties.getByLabel('Tierの最小高さ（px）').fill('200');
  await properties.getByLabel('個別ラベル幅（px）').fill('110');
  await properties.getByRole('button', { name: '変更を適用', exact: true }).click();
  await close(page, isMobile);
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await page.reload();
  await expect(page.locator('.tier-row').first()).toHaveCSS('min-height', '200px');
  const saved = await backup(page);
  expect(saved.project.style).toMatchObject({ itemSize: 100, fontFamily: 'serif', padding: 16, titleDecoration: 'line', imageFit: 'cover', radius: 20 });
  expect(saved.project.tiers[0]).toMatchObject({ minHeight: 200, labelWidth: 110 });
  await design(page, isMobile); await section(page, isMobile, '文字・見出し');
  await properties.getByLabel('タイトルを表示').uncheck();
  await section(page, isMobile, 'カード・枠'); await properties.getByLabel('アイテム名を表示').uncheck();
  await properties.getByRole('button', { name: 'デザインを保存' }).click(); await close(page, isMobile);
  await expect(page.locator('#board-heading').locator('..')).toHaveClass('visually-hidden');
  await expect(page.locator('.item-name')).toHaveClass(/visually-hidden/);
  await expect(page.getByLabel('アイテム「画像1」を編集', { exact: true })).toBeVisible();
});

test('all templates and scoped palettes retain user ranks and remain accessible', async ({ page, isMobile }, info) => {
  test.setTimeout(60000);
  await upload(page, 1);
  const before = await backup(page);
  const properties = await design(page, isMobile);
  for (const name of ['クラシック', 'ミニマル', 'ゲームUI', 'レトロ', 'ポップ', 'サイバー', 'ゴシック', '和風']) {
    await properties.getByRole('button', { name, exact: true }).click();
    await properties.getByRole('button', { name: 'テーマを適用', exact: true }).click();
    await close(page, isMobile);
    await expect(page.locator('.tier-row')).toHaveCount(5); await expect(page.locator('.item-card')).toHaveCount(1);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations, name).toEqual([]);
    if (name === 'サイバー') await page.screenshot({ path: `.qa/${info.project.name}-phase3-cyber.png`, fullPage: true });
    await design(page, isMobile);
  }
  await properties.getByLabel('適用範囲').selectOption('cards');
  await properties.getByRole('button', { name: 'ポップ', exact: true }).click();
  await properties.getByRole('button', { name: 'テーマを適用', exact: true }).click();
  await properties.getByLabel('ランク配色', { exact: true }).selectOption('ocean');
  await properties.getByRole('button', { name: 'ランク配色を適用', exact: true }).click();
  await close(page, isMobile);
  const after = await backup(page);
  expect(after.project.items).toEqual(before.project.items);
  expect(after.project.tiers.map((tier) => [tier.id, tier.name, tier.itemIds])).toEqual(before.project.tiers.map((tier) => [tier.id, tier.name, tier.itemIds]));
  expect(after.project.style).toMatchObject({ background: '#f4efdf', radius: 20 });
  expect(after.project.tiers[0]!.background).toBe('#a4c4df');
  await design(page, isMobile);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `.qa/${info.project.name}-phase3-settings.png`, fullPage: true });
});

test('24 images, non-destructive crop and background restore from JSON with original bytes', async ({ page, isMobile }, info) => {
  await upload(page, 24);
  const properties = await design(page, isMobile);
  const file = await photo(page);
  await properties.getByLabel('背景画像を登録', { exact: true }).setInputFiles(file);
  await expect(properties.getByRole('status')).toHaveText('背景画像を登録しました。');
  await expect(properties.getByLabel('背景画像を登録', { exact: true })).toBeEnabled();
  await close(page, isMobile);
  await page.getByLabel('アイテム「画像1」を編集', { exact: true }).click();
  await properties.getByLabel('左端（%）').fill('50'); await properties.getByLabel('幅（%）').fill('50');
  await properties.getByRole('button', { name: 'トリミングを適用', exact: true }).click();
  await properties.getByLabel('移動先').selectOption({ label: 'S' });
  await properties.getByRole('button', { name: '移動する', exact: true }).click();
  await close(page, isMobile);
  const cropped = page.locator('.item-card canvas.item-thumbnail');
  await expect(cropped).toHaveAttribute('data-crop', JSON.stringify({ x: .5, y: 0, width: .5, height: 1 }));
  // Cropping must exclude A's red half, including the transparent margins in contain mode.
  await expect.poll(() => cropped.evaluate((element) => {
    const canvas = element as HTMLCanvasElement, ctx = canvas.getContext('2d')!;
    return { margin: ctx.getImageData(0, 256, 1, 1).data[3], blue: Array.from(ctx.getImageData(64, 64, 1, 1).data) };
  })).toEqual({ margin: 0, blue: [85, 143, 194, 255] });
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(24);
  const before = await backup(page); expect(before.blobs).toHaveLength(25);
  expect(before.blobs.at(-1)!.dataBase64).toBe(file.buffer.toString('base64'));
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: '背景・切り抜き.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
  await expect(manager).not.toBeVisible(); await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(24);
  const after = await backup(page);
  expect(after.project.id).not.toBe(before.project.id); expect(after.project.style).toEqual(before.project.style);
  expect(after.project.items).toEqual(before.project.items); expect(after.project.tiers).toEqual(before.project.tiers);
  expect(after.blobs.map((blob) => blob.dataBase64)).toEqual(before.blobs.map((blob) => blob.dataBase64));
  await expect(page.locator('.design-surface')).toHaveCSS('background-image', /blob:/);
  await page.locator('.tier-row').first().screenshot({ path: `.qa/${info.project.name}-phase3-crop.png` });
  await design(page, isMobile);
  await properties.getByRole('button', { name: '背景画像を削除', exact: true }).click(); await close(page, isMobile);
  const removed = await backup(page); expect(removed.blobs).toHaveLength(24); expect(removed.project.style.backgroundAssetId).toBeNull();
  await page.getByLabel('アイテム「画像1」を編集', { exact: true }).click();
  await properties.getByRole('button', { name: 'トリミングを解除', exact: true }).click(); await close(page, isMobile);
  await expect(page.locator('.item-card canvas.item-thumbnail')).toHaveCount(0);
});

test('invalid backgrounds, crops and design inputs preserve saved data and draft cancellation', async ({ page, isMobile }) => {
  await upload(page, 1);
  const properties = await design(page, isMobile);
  for (const buffer of [Buffer.alloc(0), Buffer.from('broken')]) {
    await properties.getByLabel('背景画像を登録', { exact: true }).setInputFiles({ name: '不正.png', mimeType: 'image/png', buffer });
    await expect(properties.getByRole('alert')).toBeVisible();
  }
  await section(page, isMobile, 'サイズ・余白'); await properties.getByLabel('画像サイズ（px）').fill('201');
  await properties.getByRole('button', { name: 'デザインを保存' }).click();
  expect(await properties.getByLabel('画像サイズ（px）').evaluate((input) => (input as HTMLInputElement).validity.rangeOverflow)).toBe(true);
  page.once('dialog', (dialog) => void dialog.dismiss());
  await properties.getByRole('button', { name: 'テーマを適用', exact: true }).click();
  await expect(properties.getByLabel('画像サイズ（px）')).toHaveValue('201');
  await properties.getByLabel('画像サイズ（px）').fill('76'); await close(page, isMobile);
  const saved = await backup(page); expect(saved.project.style.backgroundAssetId).toBeUndefined();
  expect(saved.project.style.itemSize).toBe(76); expect(saved.blobs).toHaveLength(1);
  await page.getByLabel('アイテム「画像1」を編集', { exact: true }).click();
  await properties.getByLabel('左端（%）').fill('80');
  await properties.getByRole('button', { name: 'トリミングを適用', exact: true }).click();
  await expect(properties.getByRole('alert')).toContainText('切り抜き範囲を画像内に');
  await properties.getByRole('button', { name: 'トリミングを解除', exact: true }).click(); await close(page, isMobile);
  expect(Object.values((await backup(page)).project.items)[0]!.crop).toBeNull();
});

test('maximum design values fit phone, tablet and desktop layouts', async ({ page, isMobile }, info) => {
  await upload(page, 3);
  const properties = await design(page, isMobile);
  await section(page, isMobile, 'サイズ・余白');
  for (const [label, value] of [['ラベル幅（px）', '240'], ['画像サイズ（px）', '200'], ['アイテム間隔（px）', '40'], ['内側の余白（px）', '48']]) await properties.getByLabel(label!, { exact: true }).fill(value!);
  await properties.getByRole('button', { name: 'デザインを保存' }).click(); await close(page, isMobile);
  for (const width of [320, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), String(width)).toBe(true);
    expect(await page.locator('.item-card').first().evaluate((card) => card.getBoundingClientRect().right <= window.innerWidth), String(width)).toBe(true);
  }
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 1080 });
  await page.screenshot({ path: `.qa/${info.project.name}-phase3-max-sizes.png`, fullPage: true });
});

test('JPEG crop follows EXIF orientation and keeps original bytes', async ({ page, isMobile }) => {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ee0000'; ctx.fillRect(0, 0, 100, 120); ctx.fillStyle = '#0000ee'; ctx.fillRect(100, 0, 100, 120);
    return canvas.toDataURL('image/jpeg', 1).split(',')[1]!;
  });
  const jpeg = Buffer.from(encoded, 'base64');
  const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex');
  const buffer = Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '画像を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '画像を追加', exact: true });
  await dialog.getByLabel('画像ファイルを選択').setInputFiles({ name: '回転写真.jpg', mimeType: 'image/jpeg', buffer });
  await expect(dialog.getByRole('status')).toContainText('1枚の画像を登録しました');
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('アイテム「回転写真」を編集', { exact: true }).click();
  const properties = pane(page, isMobile);
  await properties.getByLabel('高さ（%）').fill('50');
  await properties.getByRole('button', { name: 'トリミングを適用', exact: true }).click(); await close(page, isMobile);
  await expect.poll(() => page.locator('.item-card canvas').evaluate((node) => {
    const data = (node as HTMLCanvasElement).getContext('2d')!.getImageData(50, 100, 1, 1).data;
    return data[0]! > 220 && data[2]! < 10;
  })).toBe(true);
  expect((await backup(page)).blobs[0]!.dataBase64).toBe(buffer.toString('base64'));
});
