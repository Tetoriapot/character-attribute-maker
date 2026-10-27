import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import type { Project } from '../../src/data/types';

interface Backup { project: Project; blobs: { key: string; mimeType: string; dataBase64: string }[]; format: string; backupVersion: number }
type Upload = { name: string; mimeType: string; buffer: Buffer };
const issues = new WeakMap<Page, string[]>();
const names = (page: Page) => page.locator('.editing-tools').getByLabel('画像名を一括で非表示');
const manager = (page: Page) => page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; issues.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await expand(page);
});
test.afterEach(({ page }) => { expect(issues.get(page)).toEqual([]); });
async function expand(page: Page) {
  if (!await page.locator('.editing-tools').evaluate((element) => (element as HTMLDetailsElement).open)) await page.locator('.editing-tools > summary').click();
}
async function photo(page: Page, name = '拡張子が異なる 日本語.png', mimeType = 'image/png', contentType = 'image/jpeg'): Promise<Upload> {
  const base64 = await page.evaluate((type) => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#558fc2'; ctx.fillRect(0, 0, 240, 240);
    ctx.fillStyle = '#e77766'; ctx.fillRect(0, 0, 120, 120);
    return canvas.toDataURL(type).split(',')[1]!;
  }, contentType);
  return { name, mimeType, buffer: Buffer.from(base64, 'base64') };
}
async function upload(page: Page, files: Upload[]) {
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '画像を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '画像を追加', exact: true });
  await dialog.getByLabel('画像ファイルを選択').setInputFiles(files);
  await expect(dialog.getByRole('status')).toContainText(`${files.length}枚の画像を登録しました`);
  await expect(dialog.locator('.import-errors')).toHaveCount(0);
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
}
async function backup(page: Page): Promise<Backup> {
  const pending = page.waitForEvent('download');
  await page.locator('.canvas-footer').getByRole('button', { name: 'JSONバックアップ', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
async function restore(page: Page, data: Backup) {
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  await manager(page).getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: '画像 検証.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}
async function output(page: Page, format: string) {
  await page.getByRole('button', { name: '出力・共有', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '画像出力・印刷・共有', exact: true });
  await dialog.getByLabel('未分類を含める').check(); await dialog.getByLabel('画像形式').selectOption(format);
  await dialog.getByRole('button', { name: 'プレビューを作成', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '画像を保存', exact: true })).toBeEnabled({ timeout: 15000 });
  const pending = page.waitForEvent('download'); await dialog.getByRole('button', { name: '画像を保存', exact: true }).click();
  const bytes = await readFile((await (await pending).path())!);
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  return bytes;
}

test('mislabeled raster files normalize MIME, retain bytes and reject corrupt backups', async ({ page, isMobile }) => {
  const files = [await photo(page), await photo(page, '逆の形式.JPG', 'image/jpeg', 'image/png'), await photo(page, '不明な種類.webp', 'application/octet-stream', 'image/webp')];
  await upload(page, files);
  await expect(page.locator('.item-thumbnail')).toHaveCount(3);
  await expect.poll(() => page.locator('.item-thumbnail').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const data = await backup(page);
  for (const [index, mime] of ['image/jpeg', 'image/png', 'image/webp'].entries()) {
    const asset = Object.values(data.project.assets).find((asset) => asset.originalName === files[index]!.name)!;
    expect(asset).toMatchObject({ mimeType: mime, width: 240, height: 240 });
    const blob = data.blobs.find((blob) => blob.key === asset.blobKey)!;
    expect(blob.mimeType).toBe(mime); expect(Buffer.from(blob.dataBase64, 'base64')).toEqual(files[index]!.buffer);
  }
  await restore(page, data); await expect(manager(page)).not.toBeVisible();
  expect((await backup(page)).blobs.map((blob) => blob.dataBase64)).toEqual(data.blobs.map((blob) => blob.dataBase64));
  const invalid = structuredClone(data); invalid.blobs[0]!.mimeType = 'image/png';
  await restore(page, invalid); await expect(manager(page).getByRole('alert')).toBeVisible();
  await expect(manager(page).getByTestId('project-entry')).toHaveCount(2);
  await manager(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await page.locator(isMobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click();
  const pane = page.getByRole(isMobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
  await pane.getByLabel('背景画像を登録', { exact: true }).setInputFiles(files[0]!);
  await expect(pane.getByLabel('背景画像を登録', { exact: true })).toBeEnabled();
  if (isMobile) await pane.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await page.reload();
  const saved = await backup(page);
  expect(saved.project.assets[saved.project.style.backgroundAssetId!]!.mimeType).toBe('image/jpeg');
  expect(saved.blobs).toHaveLength(4);
});

test('bulk image caption setting preserves text, history, new uploads, backup and all export formats', async ({ page, isMobile }, info) => {
  test.setTimeout(90000);
  await upload(page, [await photo(page), await photo(page, '二枚目.png')]);
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '文字を追加', exact: true }).click();
  const add = page.getByRole('dialog');
  await add.getByLabel('アイテム名', { exact: true }).fill('表示する文字');
  await add.getByRole('button', { name: '追加する', exact: true }).click();
  await names(page).check();
  await expect(page.locator('.item-name:not(.visually-hidden)')).toHaveText(['表示する文字']);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.locator('.item-name:not(.visually-hidden)')).toHaveCount(3);
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await expect(names(page)).toBeChecked();
  await upload(page, [await photo(page, '追加画像.png')]);
  await expect(page.locator('.item-name:not(.visually-hidden)')).toHaveText(['表示する文字']);
  const hidden = await backup(page);
  expect(hidden.project.style.showImageNames).toBe(false);
  expect(Object.values(hidden.project.items).filter((item) => item.assetId).map((item) => item.name)).toEqual(['拡張子が異なる 日本語', '二枚目', '追加画像']);
  const before = new Map<string, Buffer>();
  for (const format of ['png', 'jpeg', 'webp']) before.set(format, await output(page, format));
  const renamed = structuredClone(hidden);
  Object.values(renamed.project.items).filter((item) => item.assetId).forEach((item) => { item.name = '出力に混入してはいけない名前'; });
  await restore(page, renamed); await expect(manager(page)).not.toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await page.reload(); await expand(page);
  await expect(names(page)).toBeChecked();
  await expect(page.locator('.item-name:not(.visually-hidden)')).toHaveText(['表示する文字']);
  for (const format of ['png', 'jpeg', 'webp']) expect((await output(page, format)).equals(before.get(format)!)).toBe(true);
  await names(page).focus(); await page.keyboard.press('Space');
  await expect(page.locator('.item-name:not(.visually-hidden)')).toHaveCount(4);
  if (isMobile) await names(page).tap(); else await names(page).check();
  await page.locator(isMobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click();
  const pane = page.getByRole(isMobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
  await pane.getByText('カード・枠', { exact: true }).click();
  await expect(pane.getByLabel('画像名を一括で非表示')).toBeChecked();
  await pane.getByLabel('画像名を一括で非表示').uncheck();
  await pane.getByRole('button', { name: 'デザインを保存', exact: true }).click();
  if (isMobile) await pane.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(names(page)).not.toBeChecked();
  await names(page).check();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `.qa/${info.project.name}-image-names.png`, fullPage: true });
});

test('image-only virtual tray shrinks captions, keeps keyboard navigation and handles mixed text', async ({ page }) => {
  await upload(page, [await photo(page)]);
  const source = await backup(page), sample = Object.values(source.project.items)[0]!;
  for (let index = 1; index < 120; index++) {
    const id = crypto.randomUUID(); source.project.items[id] = { ...sample, id, name: `画像${index}` }; source.project.unrankedItemIds.push(id);
  }
  await restore(page, source); await expect(manager(page)).not.toBeVisible();
  await expand(page);
  const cell = page.locator('.virtual-cell').first();
  const before = (await cell.boundingBox())!.height;
  await names(page).check();
  expect((await cell.boundingBox())!.height).toBeLessThan(before);
  await expect(page.locator('.item-name:not(.visually-hidden)')).toHaveCount(0);
  await cell.locator('.item-select').focus(); await page.keyboard.press('End');
  await expect(page.getByLabel('アイテム「画像119」を編集', { exact: true })).toBeFocused();
  await page.keyboard.press('Home'); await expect(page.getByLabel(`アイテム「${sample.name}」を編集`, { exact: true })).toBeFocused();
  const mixed = await backup(page), id = crypto.randomUUID();
  mixed.project.items[id] = { ...sample, id, assetId: null, name: '文字は表示' }; mixed.project.unrankedItemIds.push(id);
  await restore(page, mixed); await expect(manager(page)).not.toBeVisible();
  await cell.locator('.item-select').focus(); await page.keyboard.press('End');
  await expect(page.getByLabel('アイテム「文字は表示」を編集', { exact: true }).locator('.item-name')).not.toHaveClass(/visually-hidden/);
  expect((await page.locator('.virtual-cell').last().boundingBox())!.height).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('canceling a pending edit leaves names and the draft unchanged', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The mobile properties drawer prevents interaction with the underlying toolbar.');
  await upload(page, [await photo(page)]);
  const pane = page.getByRole('complementary', { name: 'プロパティ', exact: true });
  const title = pane.getByLabel('プロジェクト名', { exact: true });
  await title.fill('未適用のタイトル');
  page.once('dialog', (dialog) => dialog.dismiss());
  await names(page).click();
  await expect(names(page)).not.toBeChecked(); await expect(title).toHaveValue('未適用のタイトル');
  page.once('dialog', (dialog) => dialog.accept());
  await names(page).click();
  await expect(names(page)).toBeChecked(); await expect(title).toHaveValue('新しいTier表');
});
