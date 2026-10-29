import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { createProject } from '../../src/data/defaults';
import type { Project } from '../../src/data/types';

const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; issues.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
});
test.afterEach(({ page }) => expect(issues.get(page)).toEqual([]));
const undo = (page: Page) => page.getByRole('button', { name: '元に戻す', exact: true });
const redo = (page: Page) => page.getByRole('button', { name: 'やり直す', exact: true });
const area = (page: Page) => page.getByRole('region', { name: 'アイテムの削除エリア', exact: true });
const bulk = (page: Page) => page.getByRole('button', { name: '選択項目を削除', exact: true });
const content = (project: Project) => ({ ...project, updatedAt: '' });
async function importData(page: Page, data: unknown) {
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: '一括 削除.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(manager).not.toBeVisible();
}
async function fixture(page: Page, count = 6) {
  const project = createProject();
  for (let index = 0; index < count; index++) {
    const id = `item-${index}`;
    project.items[id] = { id, name: `項目${index}`, description: '説明', tags: ['タグ'], assetId: null, createdAt: project.createdAt };
    if (index === 0) project.tiers[0]!.itemIds.push(id); else project.unrankedItemIds.push(id);
  }
  await importData(page, { format: 'tier-atelier', backupVersion: 1, project, blobs: [] });
  await selectAll(page);
}
async function selectAll(page: Page) {
  const tools = page.locator('.editing-tools');
  if (!(await tools.evaluate((node) => (node as HTMLDetailsElement).open))) await tools.locator('summary').first().click();
  if ((await page.getByRole('button', { name: '複数選択', exact: true }).getAttribute('aria-pressed')) !== 'true') await page.getByRole('button', { name: '複数選択', exact: true }).click();
  await page.getByRole('button', { name: '表示中を選択', exact: true }).click();
}
async function backup(page: Page) {
  const waiting = page.waitForEvent('download'); await page.locator('.canvas-footer button').click();
  const download = await waiting;
  return JSON.parse(await readFile((await download.path())!, 'utf8')) as { project: Project; blobs: { key: string; mimeType: string; dataBase64: string }[] };
}
async function dragDelete(page: Page, grip: Locator, mobile: boolean, cancel = false, screenshot?: string) {
  await grip.scrollIntoViewIfNeeded(); const from = (await grip.boundingBox())!;
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const touch = mobile ? await page.context().newCDPSession(page) : undefined;
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 10, start.y - 8, { steps: 4 }); }
  await expect(grip).toHaveAttribute('aria-grabbed', 'true'); await expect(area(page)).toBeVisible();
  const to = (await area(page).boundingBox())!, end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  if (touch) for (let step = 1; step <= 12; step++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 12, y: start.y + (end.y - start.y) * step / 12 }] });
  } else await page.mouse.move(end.x, end.y, { steps: 15 });
  await expect(area(page)).toHaveClass(/delete-over/);
  if (screenshot) {
    await page.screenshot({ path: screenshot });
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
  if (cancel) await page.keyboard.press('Escape');
  if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
  else await page.mouse.up();
  await expect(area(page)).not.toBeVisible();
  if (!cancel) await expect(page.locator('#board-heading')).toBeFocused();
}

test('mouse and long-press bulk delete include hidden selections, cancel safely and undo as one edit', async ({ page, isMobile }, info) => {
  await fixture(page); const original = (await backup(page)).project;
  await page.getByRole('searchbox', { name: 'アイテムを検索' }).fill('項目1');
  const grip = page.getByRole('button', { name: 'アイテム「項目1」をドラッグ', exact: true });
  await dragDelete(page, grip, isMobile, true);
  expect(content((await backup(page)).project)).toEqual(content(original)); await expect(undo(page)).toBeDisabled();
  await dragDelete(page, grip, isMobile, false, `.qa/${info.project.name}-bulk-delete.png`);
  await expect(page.locator('.item-card')).toHaveCount(0);
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  expect(Object.keys((await backup(page)).project.items)).toHaveLength(0);
  await undo(page).click(); expect(content((await backup(page)).project)).toEqual(content(original)); await expect(undo(page)).toBeDisabled();
  await redo(page).click(); await expect(page.locator('.item-card')).toHaveCount(0);
  await undo(page).click(); await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(6);
  expect(content((await backup(page)).project)).toEqual(content(original));
});

test('21-image bulk delete preserves blobs through undo, autosave, JSON restoration and output', async ({ page }) => {
  test.setTimeout(60000);
  const data = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#007755'; ctx.fillRect(0, 0, 40, 30); return canvas.toDataURL().split(',')[1]!; });
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '画像を追加', exact: true }).click();
  const images = page.getByRole('dialog', { name: '画像を追加', exact: true });
  await images.getByLabel('画像ファイルを選択').setInputFiles(Array.from({ length: 21 }, (_, index) => ({ name: `画像 ${index}.png`, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') })));
  await expect(images.getByRole('status')).toContainText('21枚の画像を登録しました');
  await images.getByRole('button', { name: '閉じる', exact: true }).click();
  const original = await backup(page);
  await selectAll(page); await bulk(page).focus(); await page.keyboard.press('Enter');
  const confirm = page.getByRole('dialog', { name: '21件のアイテムを削除しますか？', exact: true });
  await expect(confirm).toBeVisible(); await page.keyboard.press('Escape'); await expect(bulk(page)).toBeFocused();
  await expect(page.locator('.item-card')).toHaveCount(21);
  await bulk(page).click(); await confirm.getByRole('button', { name: '削除する', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.item-card')).toHaveCount(0); await expect(bulk(page)).toBeDisabled();
  await expect(page.locator('#board-heading')).toBeFocused();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); expect((await backup(page)).blobs).toEqual([]);
  await undo(page).click(); await expect(page.locator('.item-thumbnail')).toHaveCount(21);
  const byKey = (blobs: typeof original.blobs) => Object.fromEntries(blobs.map((blob) => [blob.key, blob]));
  expect(byKey((await backup(page)).blobs)).toEqual(byKey(original.blobs));
  await redo(page).click(); await expect(page.locator('.item-card')).toHaveCount(0);
  await undo(page).click(); const restored = await backup(page);
  await importData(page, restored); await page.reload(); await expect(page.locator('.item-thumbnail')).toHaveCount(21);
  expect((await backup(page)).blobs.map((blob) => blob.dataBase64)).toEqual(original.blobs.map((blob) => blob.dataBase64));
  await page.getByRole('button', { name: '出力・共有', exact: true }).click();
  const output = page.getByRole('dialog', { name: '画像出力・印刷・共有', exact: true });
  await output.getByLabel('未分類を含める').check(); await output.getByRole('button', { name: 'プレビューを作成', exact: true }).click();
  await expect(output.getByRole('button', { name: '画像を保存', exact: true })).toBeEnabled({ timeout: 15000 });
});

test('locked members reject the whole batch and confirmation is accessible', async ({ page, isMobile }) => {
  await fixture(page);
  await page.getByRole('button', { name: 'ランク「S」を編集', exact: true }).click();
  const pane = page.getByRole(isMobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
  await pane.getByLabel('ランクをロック').check();
  if (isMobile) await pane.getByRole('button', { name: '閉じる', exact: true }).click();
  const original = (await backup(page)).project;
  await bulk(page).click(); const confirm = page.getByRole('dialog', { name: '6件のアイテムを削除しますか？', exact: true });
  await confirm.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(confirm.getByRole('alert')).toContainText('ロック');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await confirm.getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect(content((await backup(page)).project)).toEqual(content(original));
  await expect(page.locator('.item-card')).toHaveCount(6);
});

test('virtual selections delete beyond the viewport with zoom and dark mode without overflow', async ({ page, isMobile }, info) => {
  await fixture(page, 121); await page.getByLabel('表示倍率', { exact: true }).selectOption('125');
  await page.getByRole('button', { name: 'ライトモード：ダークモードに切り替え', exact: true }).click();
  const tray = page.getByRole('region', { name: '未分類のスクロール領域', exact: true });
  await tray.scrollIntoViewIfNeeded(); await tray.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await dragDelete(page, page.getByRole('button', { name: 'アイテム「項目120」をドラッグ', exact: true }), isMobile, false, `.qa/${info.project.name}-bulk-delete-dark.png`);
  await expect(page.locator('.item-card')).toHaveCount(0); await undo(page).click();
  expect(Object.keys((await backup(page)).project.items)).toHaveLength(121);
  expect(await page.locator('.item-card').count()).toBeLessThan(100);
  for (const width of [320, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('dragging an unselected item only deletes that item and unapplied edits can cancel deletion', async ({ page, isMobile }) => {
  await fixture(page); await page.getByRole('checkbox', { name: '「項目1」を選択', exact: true }).uncheck();
  await dragDelete(page, page.getByRole('button', { name: 'アイテム「項目1」をドラッグ', exact: true }), isMobile);
  const remaining = (await backup(page)).project; expect(Object.keys(remaining.items)).toHaveLength(5); expect(remaining.items['item-1']).toBeUndefined();
  await expect(page.getByRole('checkbox', { name: '「項目2」を選択', exact: true })).toBeChecked();
  if (isMobile) return;
  await page.getByRole('button', { name: 'ランク「S」を編集', exact: true }).click();
  const name = page.getByRole('complementary', { name: 'プロパティ', exact: true }).getByLabel('ランク名', { exact: true });
  await name.fill('未適用'); await bulk(page).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  const confirm = page.getByRole('dialog', { name: '5件のアイテムを削除しますか？', exact: true });
  await confirm.getByRole('button', { name: '削除する', exact: true }).click(); await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(name).toHaveValue('未適用'); expect(content((await backup(page)).project)).toEqual(content(remaining));
});

test('a drop outside the delete area does not delete and tier drags never show it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse boundary and hardware keyboard coverage.');
  await fixture(page); const original = (await backup(page)).project;
  const grip = page.getByRole('button', { name: 'アイテム「項目1」をドラッグ', exact: true });
  await grip.scrollIntoViewIfNeeded(); const from = (await grip.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + 15, from.y - 8, { steps: 4 }); await expect(area(page)).toBeVisible();
  const target = (await area(page).boundingBox())!;
  await page.mouse.move(target.x + target.width + 3, target.y + target.height / 2, { steps: 15 }); await page.mouse.up();
  expect(content((await backup(page)).project)).toEqual(content(original)); await expect(undo(page)).toBeDisabled();
  const tier = page.getByRole('button', { name: 'ランク「S」をドラッグ', exact: true });
  await tier.focus(); await page.keyboard.press('Space'); await expect(tier).toHaveAttribute('aria-grabbed', 'true');
  await expect(area(page)).not.toBeVisible(); await page.keyboard.press('Escape');
});
