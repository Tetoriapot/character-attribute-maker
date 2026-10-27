import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; issues.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
});
test.afterEach(async ({ page }) => { expect(issues.get(page)).toEqual([]); });

type Upload = { name: string; mimeType: string; buffer: Buffer };
const manager = (page: Page) => page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
const imageDialog = (page: Page) => page.getByRole('dialog', { name: '画像を追加', exact: true });
async function pictures(page: Page, count: number): Promise<Upload[]> {
  const data = await page.evaluate((count) => Array.from({ length: count }, (_, index) => {
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 72;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `hsl(${index * 37}, 45%, 72%)`; ctx.fillRect(0, 0, 96, 72);
    ctx.fillStyle = '#294735'; ctx.font = 'bold 28px sans-serif'; ctx.fillText(String(index + 1).padStart(2, '0'), 28, 45);
    return canvas.toDataURL('image/png').split(',')[1]!;
  }), count);
  return data.map((encoded, index) => ({ name: `日本語 画像${String(index + 1).padStart(2, '0')}.png`, mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') }));
}
async function openImages(page: Page) {
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '画像を追加', exact: true }).click();
}
async function upload(page: Page, files: Upload[]) {
  await openImages(page);
  await imageDialog(page).getByLabel('画像ファイルを選択').setInputFiles(files);
  await expect(imageDialog(page).getByRole('status')).toContainText(`${files.length}枚の画像を登録しました`);
  await expect(imageDialog(page).getByLabel('画像ファイルを選択')).toBeEnabled();
  await imageDialog(page).getByRole('button', { name: '閉じる', exact: true }).click();
}
async function openManager(page: Page) { await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click(); }
async function backup(page: Page) {
  const waiting = page.waitForEvent('download');
  await page.locator('.canvas-footer').getByRole('button', { name: 'JSONバックアップ', exact: true }).click();
  const download = await waiting;
  const data = await readFile((await download.path())!, 'utf8');
  return { filename: download.suggestedFilename(), text: data, data: JSON.parse(data) };
}
async function restore(page: Page, text: string) {
  await openManager(page);
  await manager(page).getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: '画像を含む バックアップ.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

test('24 images, metadata, movement and shared item duplication persist after reload', async ({ page, isMobile }, testInfo) => {
  await upload(page, await pictures(page, 24));
  await expect(page.locator('.item-card')).toHaveCount(24);
  await expect(page.locator('.item-thumbnail')).toHaveCount(24);
  await page.getByLabel('アイテム「日本語 画像01」を編集', { exact: true }).click();
  const pane = page.getByRole(isMobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
  await pane.getByLabel('説明', { exact: true }).fill('画像の説明');
  await pane.getByLabel('タグ', { exact: true }).fill('画像, 日本語');
  await pane.getByRole('button', { name: '変更を適用', exact: true }).click();
  await pane.getByLabel('移動先').selectOption({ label: 'S' });
  await pane.getByRole('button', { name: '移動する', exact: true }).click();
  await pane.getByRole('button', { name: 'アイテムを複製', exact: true }).click();
  if (isMobile) await pane.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(25);
  await expect(page.getByRole('region', { name: 'ランク「S」', exact: true }).locator('.item-card')).toHaveCount(2);
  await page.locator('.item-thumbnail').last().scrollIntoViewIfNeeded();
  expect(await page.locator('.item-thumbnail').evaluateAll((images) => images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  const saved = await backup(page);
  expect(saved.data.blobs).toHaveLength(24);
  expect(Object.values(saved.data.project.items).filter((item) => (item as { description: string }).description === '画像の説明')).toHaveLength(2);
  await page.screenshot({ path: `.qa/${testInfo.project.name}-images.png`, fullPage: true });
});

test('project creation, switching, duplication and deletion keep shared images intact', async ({ page }) => {
  await upload(page, await pictures(page, 2));
  await openManager(page);
  await manager(page).getByLabel('新しいプロジェクト名').fill('二つ目のプロジェクト');
  await manager(page).getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(manager(page)).not.toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('二つ目のプロジェクト');
  await expect(page.locator('.item-card')).toHaveCount(0);
  await openManager(page);
  const original = manager(page).getByTestId('project-entry').filter({ hasText: '新しいTier表' });
  await original.getByRole('button', { name: '開く', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(2);
  await openManager(page);
  await manager(page).getByTestId('project-entry').filter({ hasText: '新しいTier表' }).getByRole('button', { name: '複製', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('新しいTier表（複製）');
  await expect(page.locator('.item-card')).toHaveCount(2);
  await openManager(page);
  const entry = manager(page).getByTestId('project-entry').filter({ has: page.getByText('新しいTier表', { exact: true }) });
  await entry.getByRole('button', { name: '削除', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'プロジェクトを削除しますか？' });
  await confirm.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(manager(page).getByTestId('project-entry')).toHaveCount(3);
  await entry.getByRole('button', { name: '削除', exact: true }).click();
  await confirm.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(manager(page).getByTestId('project-entry')).toHaveCount(2);
  await manager(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(2);
  expect((await backup(page)).data.blobs).toHaveLength(2);
});

test('image JSON backup restores byte-for-byte into a new project and preserves unknown keys', async ({ page }) => {
  await upload(page, await pictures(page, 21));
  const before = await backup(page);
  expect(before.filename).toBe('新しいTier表.tier.json');
  before.data.project.extension = { preserved: '未知の項目' };
  before.data.project.style.extra = { v: 3 };
  await restore(page, JSON.stringify(before.data));
  await expect(manager(page)).not.toBeVisible();
  await expect(page.locator('.item-card')).toHaveCount(21);
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(21);
  const after = await backup(page);
  expect(after.data.project.id).not.toBe(before.data.project.id);
  expect(after.data.project.extension).toEqual(before.data.project.extension);
  expect(after.data.project.style.extra).toEqual({ v: 3 });
  expect(after.data.project.items).toEqual(before.data.project.items);
  expect(after.data.project.tiers).toEqual(before.data.project.tiers);
  expect(after.data.blobs.map((blob: { dataBase64: string }) => blob.dataBase64)).toEqual(before.data.blobs.map((blob: { dataBase64: string }) => blob.dataBase64));
  await openManager(page);
  await expect(manager(page).getByTestId('project-entry')).toHaveCount(2);
});

test('corrupt image and backup inputs report errors without replacing saved data', async ({ page }) => {
  await upload(page, await pictures(page, 1));
  const before = await backup(page);
  await openImages(page);
  const png = (await pictures(page, 1))[0]!;
  const oversized = Buffer.from(png.buffer); oversized.writeUInt32BE(9000, 16);
  await imageDialog(page).getByLabel('画像ファイルを選択').setInputFiles([
    { name: '空.png', mimeType: 'image/png', buffer: Buffer.alloc(0) },
    { name: '壊れた.png', mimeType: 'image/png', buffer: Buffer.from('broken') },
    { ...png, name: '誤った拡張子.svg' },
    { ...png, name: '大きな寸法.png', buffer: oversized },
  ]);
  await expect(imageDialog(page).locator('.import-errors li')).toHaveCount(4);
  await imageDialog(page).getByRole('button', { name: '閉じる', exact: true }).click();
  for (const content of ['{', JSON.stringify({ ...before.data, blobs: [] }), JSON.stringify({ ...before.data, project: { ...before.data.project, schemaVersion: 99 } })]) {
    await restore(page, content);
    await expect(manager(page).getByRole('alert')).toBeVisible();
    await expect(manager(page).getByTestId('project-entry')).toHaveCount(1);
    await manager(page).getByRole('button', { name: '閉じる', exact: true }).click();
  }
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(1);
  expect((await backup(page)).data.project).toEqual(before.data.project);
});

test('JPEG, WebP and GIF are decoded; file drop and image paste import images', async ({ page }) => {
  const formats = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
    canvas.getContext('2d')!.fillRect(0, 0, 32, 24);
    return ['image/jpeg', 'image/webp'].map((type) => canvas.toDataURL(type).split(',')[1]!);
  });
  await upload(page, [
    { name: '写真.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(formats[0]!, 'base64') },
    { name: '画像.webp', mimeType: 'image/webp', buffer: Buffer.from(formats[1]!, 'base64') },
    { name: '画像.gif', mimeType: 'image/gif', buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') },
  ]);
  const image = (await pictures(page, 1))[0]!;
  await page.evaluate(({ base64, name }) => {
    const data = new DataTransfer(); data.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], name, { type: 'image/png' }));
    document.querySelector('.canvas')!.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
  }, { base64: image.buffer.toString('base64'), name: 'ドロップ.png' });
  await expect(imageDialog(page).getByRole('status')).toContainText('1枚の画像を登録しました');
  await imageDialog(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await page.evaluate((base64) => {
    const data = new DataTransfer(); data.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], '貼り付け.png', { type: 'image/png' }));
    document.querySelector('.canvas')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, image.buffer.toString('base64'));
  await expect(imageDialog(page).getByRole('status')).toContainText('1枚の画像を登録しました');
  await expect(page.locator('.item-card')).toHaveCount(5);
});

test('quota failure retains images, supports emergency backup and retries successfully', async ({ page }) => {
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'projects') { IDBObjectStore.prototype.put = put; throw new DOMException('Simulated quota failure', 'QuotaExceededError'); }
      return put.call(this, value, key);
    };
  });
  await upload(page, await pictures(page, 2));
  await expect(page.locator('.storage-error')).toContainText('編集内容は画面に残っています');
  expect((await backup(page)).data.blobs).toHaveLength(2);
  await page.getByRole('button', { name: '保存を再試行', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(2);
});

test('a stale tab cannot overwrite another tab; unsaved content can be backed up', async ({ page, context }) => {
  const other = await context.newPage(); await other.goto('/');
  await expect(other.getByTestId('save-status')).toHaveText('保存済み');
  await page.getByRole('main').getByRole('button', { name: 'ランクを追加', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await other.getByRole('main').getByRole('button', { name: 'ランクを追加', exact: true }).click();
  await expect(other.locator('.storage-error')).toContainText('別のタブ');
  // The mobile add action opens a drawer; close it before accessing the export control.
  const properties = other.getByRole('dialog', { name: 'プロパティ', exact: true });
  if (await properties.isVisible()) await properties.getByRole('button', { name: '閉じる', exact: true }).click();
  expect((await backup(other)).data.project.tiers).toHaveLength(6);
  await other.close();
  await page.reload();
  await expect(page.locator('.tier-row')).toHaveCount(6);
});

test('project and image dialogs are accessible and fit small screens', async ({ page }, testInfo) => {
  await openManager(page);
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  await page.screenshot({ path: `.qa/${testInfo.project.name}-projects.png`, fullPage: true });
  await manager(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await openImages(page);
  const imagesA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(imagesA11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('deleting the last project starts an empty saved project and removes its images', async ({ page }) => {
  await upload(page, await pictures(page, 1));
  await openManager(page);
  await manager(page).getByTestId('project-entry').getByRole('button', { name: '削除', exact: true }).click();
  await page.getByRole('dialog', { name: 'プロジェクトを削除しますか？' }).getByRole('button', { name: '削除する', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'プロジェクトを削除しますか？' })).not.toBeVisible();
  await expect(manager(page).getByTestId('project-entry')).toHaveCount(1);
  await manager(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await expect(page.locator('.item-card')).toHaveCount(0);
  expect((await backup(page)).data.blobs).toEqual([]);
});

test('an IndexedDB startup error offers retry and retains the existing project', async ({ page }) => {
  await page.getByRole('main').getByRole('button', { name: 'ランクを追加', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, version) {
      IDBFactory.prototype.open = open;
      if (name === 'tier-atelier') throw new DOMException('Simulated denied access', 'SecurityError');
      return open.call(this, name, version);
    };
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('保存済みのデータは削除していません');
  await page.getByRole('button', { name: '読み込みを再試行', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await expect(page.locator('.tier-row')).toHaveCount(6);
});
