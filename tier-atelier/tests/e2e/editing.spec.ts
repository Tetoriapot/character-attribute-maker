import { test, expect, type Page } from '@playwright/test';
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
const row = (page: Page, name: string) => page.getByRole('region', { name: `ランク「${name}」`, exact: true });
const properties = (page: Page, mobile: boolean) => page.getByRole(mobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
async function closeProperties(page: Page, mobile: boolean) { if (mobile) await properties(page, mobile).getByRole('button', { name: '閉じる', exact: true }).click(); }
async function fixture(page: Page, count = 6, style: Partial<Project['style']> = {}) {
  const project = createProject(); project.title = '操作検証';
  Object.assign(project.style, style);
  for (let index = 0; index < count; index++) {
    const id = crypto.randomUUID();
    project.items[id] = { id, name: `項目${String(index).padStart(4, '0')}`, assetId: null, description: index % 2 ? 'ＢＥＴＡ 説明' : 'ＡＬＰＨＡ 説明', tags: index % 3 ? ['赤'] : ['赤', '青'], createdAt: project.createdAt };
    project.unrankedItemIds.push(id);
  }
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: '操作 検証.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'tier-atelier', backupVersion: 1, project, blobs: [] })) });
  await expect(manager).not.toBeVisible();
  if (!await page.locator('.editing-tools').evaluate((element) => (element as HTMLDetailsElement).open)) await page.getByText('検索・選択・表示設定', { exact: true }).click();
  return project;
}
async function backup(page: Page) {
  const waiting = page.waitForEvent('download');
  await page.locator('.canvas-footer').getByRole('button', { name: 'JSONバックアップ', exact: true }).click();
  const file = await waiting; return JSON.parse(await readFile((await file.path())!, 'utf8'));
}
async function image(page: Page) {
  await page.getByRole('button', { name: '出力・共有', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '画像出力・印刷・共有', exact: true });
  await dialog.getByLabel('未分類を含める').check();
  await dialog.getByRole('button', { name: 'プレビューを作成', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '画像を保存', exact: true })).toBeEnabled({ timeout: 15000 });
  const waiting = page.waitForEvent('download'); await dialog.getByRole('button', { name: '画像を保存', exact: true }).click();
  const file = await waiting, bytes = await readFile((await file.path())!);
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click(); return bytes;
}

test('filters, touch selection, hidden selections and bulk moves round-trip as one edit', async ({ page, isMobile }) => {
  await fixture(page); await expect(undo(page)).toBeDisabled();
  const search = page.getByRole('searchbox', { name: 'アイテムを検索' });
  await search.fill('alpha 説明'); await expect(page.locator('.item-card')).toHaveCount(3);
  await page.getByText('タグで絞り込む', { exact: true }).click();
  await page.locator('.tag-options').getByLabel('青', { exact: true }).check();
  await expect(page.locator('.item-card')).toHaveCount(1);
  await page.getByRole('button', { name: '複数選択', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: '「項目0000」を選択', exact: true });
  if (isMobile) await checkbox.tap(); else await checkbox.check();
  await search.fill('beta'); await page.locator('.tag-options').getByLabel('青', { exact: true }).uncheck();
  await page.getByRole('button', { name: '表示中を選択', exact: true }).click();
  await expect(page.getByText('4件選択中（非表示1件）', { exact: true })).toBeVisible();
  await page.getByLabel('一括移動先', { exact: true }).selectOption({ label: 'S' });
  await page.getByRole('button', { name: '選択項目を移動', exact: true }).click();
  await page.getByRole('button', { name: '検索・タグを解除', exact: true }).click();
  await expect(row(page, 'S').locator('.item-name')).toHaveText(['項目0000', '項目0001', '項目0003', '項目0005']);
  await undo(page).click(); await expect(row(page, 'S').locator('.item-card')).toHaveCount(0); await expect(undo(page)).toBeDisabled();
  await redo(page).click(); await expect(row(page, 'S').locator('.item-card')).toHaveCount(4);
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await page.reload();
  await expect(row(page, 'S').locator('.item-card')).toHaveCount(4); await expect(undo(page)).toBeDisabled();
});

test('keyboard shortcuts preserve native input undo, confirm drafts and reset history on project switch', async ({ page, isMobile }) => {
  await fixture(page);
  await page.getByLabel('ランク「S」を編集', { exact: true }).click();
  const pane = properties(page, isMobile), name = pane.getByLabel('ランク名', { exact: true });
  await name.fill('最上位'); await pane.getByRole('button', { name: '変更を適用', exact: true }).click();
  await name.fill('未適用'); await name.press('Control+z');
  await expect(row(page, '最上位')).toBeAttached();
  await name.fill('未適用');
  if (isMobile) { page.once('dialog', (dialog) => dialog.accept()); await closeProperties(page, true); }
  else {
    page.once('dialog', (dialog) => dialog.dismiss()); await undo(page).click();
    await expect(name).toHaveValue('未適用');
    page.once('dialog', (dialog) => dialog.accept());
  }
  await undo(page).click(); await expect(row(page, 'S')).toBeVisible();
  await page.keyboard.press('Control+Shift+z'); await expect(row(page, '最上位')).toBeVisible();
  await page.keyboard.press('Control+z'); await expect(row(page, 'S')).toBeVisible();
  await page.keyboard.press('Control+y'); await expect(row(page, '最上位')).toBeVisible();
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByLabel('新しいプロジェクト名', { exact: true }).fill('履歴を分離');
  await manager.getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(manager).not.toBeVisible(); await expect(undo(page)).toBeDisabled(); await expect(redo(page)).toBeDisabled();
});

test('selection, search, grid and zoom do not change JSON or any output pixel', async ({ page, isMobile }, info) => {
  await fixture(page); const before = await backup(page), pixels = await image(page);
  await page.getByRole('searchbox', { name: 'アイテムを検索' }).fill('alpha');
  await page.getByRole('button', { name: '複数選択', exact: true }).click(); await page.getByRole('button', { name: '表示中を選択', exact: true }).click();
  await page.getByLabel('表示倍率', { exact: true }).selectOption('200'); await page.getByLabel('グリッドを表示', { exact: true }).check();
  expect((await backup(page)).project).toEqual(before.project);
  expect((await image(page)).equals(pixels)).toBe(true);
  for (const zoom of ['50', '100', '200']) {
    await page.getByLabel('表示倍率', { exact: true }).selectOption(zoom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByLabel('表示倍率', { exact: true }).selectOption('100');
  await page.screenshot({ path: `.qa/${info.project.name}-phase5-selection.png`, fullPage: !isMobile });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('1000-item tray bounds DOM, retains keyboard focus, filters, resizes and selects beyond viewport', async ({ page, isMobile }, info) => {
  await fixture(page, 1000); const tray = page.getByRole('region', { name: '未分類のスクロール領域', exact: true });
  await tray.scrollIntoViewIfNeeded(); await expect(tray).toBeVisible();
  expect(await tray.locator('.item-card').count()).toBeLessThan(100);
  await tray.locator('.item-select').first().focus(); await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'アイテム「項目0999」を編集', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('button', { name: 'アイテム「項目0998」を編集', exact: true })).toBeFocused();
  await page.keyboard.press('PageUp');
  expect(await tray.locator('.item-card').count()).toBeLessThan(100);
  await page.keyboard.press('Home'); await expect(page.getByRole('button', { name: 'アイテム「項目0000」を編集', exact: true })).toBeFocused();
  await tray.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(tray.locator('[aria-posinset="1000"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'アイテム「項目0000」を編集', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '複数選択', exact: true }).click();
  await page.getByRole('checkbox', { name: '「項目0999」を選択', exact: true }).check();
  await page.getByLabel('一括移動先', { exact: true }).selectOption({ label: 'A' }); await page.getByRole('button', { name: '選択項目を移動', exact: true }).click();
  await expect(row(page, 'A').locator('.item-name')).toHaveText(['項目0999']); await undo(page).click();
  await page.getByRole('searchbox', { name: 'アイテムを検索' }).fill('項目0999'); await expect(page.locator('.item-card')).toHaveCount(1);
  await page.getByRole('button', { name: '検索・タグを解除', exact: true }).click();
  for (const zoom of ['200', '50', '100']) { await page.getByLabel('表示倍率', { exact: true }).selectOption(zoom); expect(await tray.locator('.item-card').count()).toBeLessThan(100); }
  if (!isMobile) for (const width of [320, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => tray.locator('.item-card').count()).toBeLessThan(140);
  }
  await tray.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `.qa/${info.project.name}-phase5-virtual.png`, fullPage: false });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('Ctrl/Shift range selection and grouped drag preserve order and can be undone', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Modifier and mouse interaction uses desktop; touch selection has separate coverage.');
  await fixture(page);
  await page.getByRole('button', { name: 'アイテム「項目0001」を編集', exact: true }).click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: '「項目0004」を選択', exact: true }).click({ modifiers: ['Shift'] });
  await expect(page.getByText('4件選択中', { exact: true })).toBeVisible();
  const grip = page.getByRole('button', { name: 'アイテム「項目0001」をドラッグ', exact: true });
  await grip.scrollIntoViewIfNeeded(); const from = (await grip.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 8, { steps: 4 });
  const target = row(page, 'S').getByTestId('tier-items'); await target.scrollIntoViewIfNeeded(); const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 }); await page.mouse.up();
  await expect(row(page, 'S').locator('.item-name')).toHaveText(['項目0001', '項目0002', '項目0003', '項目0004']);
  await undo(page).click(); await expect(page.getByTestId('unranked-items').locator('.item-name')).toHaveText(['項目0000', '項目0001', '項目0002', '項目0003', '項目0004', '項目0005']);
});

test('24-image batch, deleted original, theme and background support undo, autosave and JSON restoration', async ({ page, isMobile }) => {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#118866'; ctx.fillRect(0, 0, 100, 80);
    return canvas.toDataURL().split(',')[1]!;
  });
  const upload = (index: number) => ({ name: `画像 ${index}.png`, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '画像を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '画像を追加', exact: true });
  await dialog.getByLabel('画像ファイルを選択').setInputFiles(Array.from({ length: 24 }, (_, index) => upload(index)));
  await expect(dialog.getByRole('status')).toContainText('24枚の画像を登録しました');
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(24);
  await undo(page).click(); await expect(page.locator('.item-card')).toHaveCount(0); await expect(undo(page)).toBeDisabled();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await redo(page).click(); await expect(page.locator('.item-thumbnail')).toHaveCount(24);
  const original = await backup(page);
  await page.getByRole('button', { name: 'アイテム「画像 0」を編集', exact: true }).click();
  await properties(page, isMobile).getByRole('button', { name: 'アイテムを削除', exact: true }).click();
  await page.getByRole('dialog', { name: 'このアイテムを削除しますか？', exact: true }).getByRole('button', { name: '削除する', exact: true }).click();
  await closeProperties(page, isMobile); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  expect((await backup(page)).blobs).toHaveLength(23);
  await undo(page).click(); await expect(page.locator('.item-thumbnail')).toHaveCount(24);
  const byKey = (blobs: { key: string; dataBase64: string; mimeType: string }[]) => Object.fromEntries(blobs.map((blob) => [blob.key, blob]));
  expect(byKey((await backup(page)).blobs)).toEqual(byKey(original.blobs));
  await page.locator(isMobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click();
  let pane = properties(page, isMobile);
  await pane.getByRole('button', { name: 'サイバー', exact: true }).click(); await pane.getByRole('button', { name: 'テーマを適用', exact: true }).click();
  await closeProperties(page, isMobile); const theme = (await backup(page)).project.style;
  await undo(page).click(); expect((await backup(page)).project.style).toEqual(original.project.style);
  await redo(page).click(); expect((await backup(page)).project.style).toEqual(theme);
  await page.locator(isMobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click(); pane = properties(page, isMobile);
  await pane.getByLabel('背景画像を登録', { exact: true }).setInputFiles(upload(99));
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await closeProperties(page, isMobile);
  expect((await backup(page)).blobs).toHaveLength(25);
  await undo(page).click(); expect((await backup(page)).blobs).toHaveLength(24);
  await redo(page).click(); const full = await backup(page); expect(full.blobs).toHaveLength(25);
  await page.reload(); await expect(page.locator('.item-thumbnail')).toHaveCount(24); await expect(undo(page)).toBeDisabled();
  expect((await backup(page)).blobs).toEqual(full.blobs);
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click(); const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: '履歴復元後.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(full)) });
  await expect(manager).not.toBeVisible(); await expect(page.locator('.item-thumbnail')).toHaveCount(24);
  expect((await backup(page)).blobs.map((blob: { dataBase64: string }) => blob.dataBase64)).toEqual(full.blobs.map((blob: { dataBase64: string }) => blob.dataBase64));
});

test('virtualized last item stays mounted while dragging at 125 percent zoom and Escape cancels', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse drag coverage; touch scrolling is tested separately.');
  await fixture(page, 1000); await page.getByLabel('表示倍率', { exact: true }).selectOption('125');
  const tray = page.getByRole('region', { name: '未分類のスクロール領域', exact: true });
  await tray.scrollIntoViewIfNeeded(); await tray.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const grip = page.getByRole('button', { name: 'アイテム「項目0999」をドラッグ', exact: true });
  async function drag(cancel: boolean) {
    await grip.scrollIntoViewIfNeeded(); const from = (await grip.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.mouse.move(from.x + 12, from.y + 8, { steps: 4 });
    await expect(undo(page)).toBeDisabled();
    await tray.evaluate((element) => { element.scrollTop = 0; });
    await expect(grip).toBeAttached();
    const target = row(page, 'D').getByTestId('tier-items'); await target.scrollIntoViewIfNeeded(); const to = (await target.boundingBox())!;
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    if (cancel) await page.keyboard.press('Escape'); await page.mouse.up();
  }
  await drag(true); await expect(row(page, 'D').locator('.item-card')).toHaveCount(0);
  await tray.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await drag(false); await expect(row(page, 'D').locator('.item-name')).toHaveText(['項目0999']);
  await undo(page).click(); await expect(row(page, 'D').locator('.item-card')).toHaveCount(0);
});

test('touch scroll in the virtual tray changes visible rows without dragging or editing', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch emulation uses the mobile project.');
  await fixture(page, 1000); const tray = page.getByRole('region', { name: '未分類のスクロール領域', exact: true });
  await tray.scrollIntoViewIfNeeded(); const box = (await tray.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + 350 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (let step = 1; step <= 15; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - step * 20 }] });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => tray.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  await expect(undo(page)).toBeDisabled(); await expect(page.locator('[aria-grabbed="true"]')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'プロパティ', exact: true })).not.toBeVisible(); await session.detach();
});

test('virtual rows remain separate with maximum text and borders and minimum cards', async ({ page, isMobile }) => {
  await fixture(page, 120, { itemSize: 40, fontSize: 32, gap: 0, borderWidth: 8, showItemNames: true });
  const tray = page.getByRole('region', { name: '未分類のスクロール領域', exact: true }); await tray.scrollIntoViewIfNeeded();
  const geometry = await tray.locator('.virtual-cell').evaluateAll((cells) => cells.map((cell) => {
    const rect = cell.getBoundingClientRect(), card = cell.querySelector('.item-card')!.getBoundingClientRect(), name = cell.querySelector('.item-name')!.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, cardBottom: card.bottom, nameBottom: name.bottom };
  }));
  for (const cell of geometry) { expect(cell.cardBottom).toBeLessThanOrEqual(cell.bottom + 1); expect(cell.nameBottom).toBeLessThanOrEqual(cell.bottom + 1); }
  const rows = [...new Set(geometry.map((cell) => cell.top))].sort((a, b) => a - b);
  expect(rows[1]! - rows[0]!).toBeGreaterThanOrEqual(140);
  await page.locator(isMobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click();
  const pane = properties(page, isMobile); await pane.locator('summary').filter({ hasText: 'カード・枠' }).click();
  await pane.getByLabel('アイテム名を表示', { exact: true }).uncheck(); await pane.getByRole('button', { name: 'デザインを保存', exact: true }).click();
  await closeProperties(page, isMobile); await expect(tray.locator('.item-name:not(.visually-hidden)')).toHaveCount(0);
  await undo(page).click(); await expect(tray.locator('.item-name:not(.visually-hidden)').first()).toBeVisible();
});
