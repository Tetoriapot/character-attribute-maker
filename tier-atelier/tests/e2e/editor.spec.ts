import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  issues.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
});
test.afterEach(async ({ page }) => { expect(issues.get(page)).toEqual([]); });

const row = (page: Page, name: string) => page.getByRole('region', { name: `ランク「${name}」`, exact: true });
const pane = (page: Page, mobile: boolean) => page.getByRole(mobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
const tap = async (target: Locator, mobile: boolean) => mobile ? target.tap() : target.click();
async function closePane(page: Page, mobile: boolean) {
  if (mobile) await pane(page, mobile).getByRole('button', { name: '閉じる', exact: true }).click();
}
async function addItem(page: Page, mobile: boolean, name: string) {
  await tap(page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '文字を追加', exact: true }), mobile);
  const dialog = page.getByRole('dialog', { name: '文字アイテムを追加', exact: true });
  await dialog.getByLabel('アイテム名', { exact: true }).fill(name);
  await dialog.getByLabel('説明', { exact: true }).fill('テスト用の説明');
  await dialog.getByLabel('タグ', { exact: true }).fill('創作, テスト');
  await tap(dialog.getByRole('button', { name: '追加する', exact: true }), mobile);
  await expect(dialog).not.toBeVisible();
}

test('initial editor is accessible and shows autosave status', async ({ page, isMobile }, testInfo) => {
  await expect(page.getByRole('heading', { name: '新しいTier表', exact: true })).toBeVisible();
  await expect(page.locator('.tier-row')).toHaveCount(5);
  await expect(page.locator('.save-notice')).toContainText('IndexedDBに自動保存');
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  if (isMobile) await expect(page.locator('.mobile-toolbar')).toBeVisible();
  else await expect(page.getByRole('complementary', { name: 'プロパティ' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: `.qa/${testInfo.project.name}-initial.png`, fullPage: true });
});

test('tier names, colors, order, duplicate and deletion work', async ({ page, isMobile }) => {
  await tap(page.getByLabel('ランク「S」を編集', { exact: true }), isMobile);
  const properties = pane(page, isMobile);
  await properties.getByLabel('ランク名', { exact: true }).fill('お気に入り');
  await properties.getByLabel('背景色のカラーコード').fill('#336699');
  await properties.getByLabel('文字色のカラーコード').fill('#ffffff');
  await properties.getByRole('button', { name: '変更を適用', exact: true }).click();
  if (!isMobile) await expect(properties.getByRole('button', { name: '変更を適用', exact: true })).toBeFocused();
  await expect(properties.getByLabel('ランク名', { exact: true })).toHaveValue('お気に入り');
  await properties.getByRole('button', { name: '下へ', exact: true }).click();
  await expect(page.locator('.tier-row').nth(1)).toHaveAttribute('aria-label', 'ランク「お気に入り」');
  await properties.getByRole('button', { name: 'ランクを複製', exact: true }).click();
  await expect(properties.getByLabel('ランク名', { exact: true })).toHaveValue('お気に入りのコピー');
  await properties.getByRole('button', { name: 'ランクを削除', exact: true }).click();
  let confirmation = page.getByRole('dialog', { name: 'このランクを削除しますか？' });
  await confirmation.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.locator('.tier-row')).toHaveCount(6);
  await properties.getByRole('button', { name: 'ランクを削除', exact: true }).click();
  confirmation = page.getByRole('dialog', { name: 'このランクを削除しますか？' });
  await confirmation.getByRole('button', { name: '削除する', exact: true }).click();
  await closePane(page, isMobile);
  await expect(page.locator('.tier-row')).toHaveCount(5);
  await expect(row(page, 'お気に入り').locator('.tier-label')).toHaveCSS('background-color', 'rgb(51, 102, 153)');
  await expect(row(page, 'お気に入り').locator('.tier-label')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await row(page, 'お気に入り').getByRole('button', { name: '折りたたむ' }).click();
  await expect(row(page, 'お気に入り').getByText('折りたたみ中')).toBeVisible();
  await row(page, 'お気に入り').getByRole('button', { name: '展開する' }).click();
  await expect(row(page, 'お気に入り').getByTestId('tier-items')).toBeVisible();
});

test('items move by tap/select and survive deleting their tier', async ({ page, isMobile }) => {
  await addItem(page, isMobile, 'キャラクター');
  await tap(page.getByLabel('アイテム「キャラクター」を編集', { exact: true }), isMobile);
  let properties = pane(page, isMobile);
  await properties.getByLabel('移動先', { exact: true }).selectOption({ label: 'S' });
  await tap(properties.getByRole('button', { name: '移動する', exact: true }), isMobile);
  await expect(properties.getByLabel('説明', { exact: true })).toHaveValue('テスト用の説明');
  await closePane(page, isMobile);
  await expect(row(page, 'S').getByLabel('アイテム「キャラクター」を編集')).toBeVisible();
  await tap(page.getByLabel('ランク「S」を編集'), isMobile);
  properties = pane(page, isMobile);
  await properties.getByRole('button', { name: 'ランクを削除', exact: true }).click();
  await page.getByRole('dialog', { name: 'このランクを削除しますか？' }).getByRole('button', { name: '削除する' }).click();
  await closePane(page, isMobile);
  await expect(page.getByTestId('unranked-items').getByLabel('アイテム「キャラクター」を編集')).toBeVisible();
  await expect(page.locator('.item-card')).toHaveCount(1);
});

test('locked tiers reject edits and item moves, and can be unlocked', async ({ page, isMobile }) => {
  await tap(page.getByLabel('ランク「S」を編集'), isMobile);
  let properties = pane(page, isMobile);
  await properties.getByLabel('ランクをロック', { exact: true }).check();
  await expect(properties.getByLabel('ランク名', { exact: true })).toBeDisabled();
  await expect(properties.getByRole('button', { name: 'ランクを削除', exact: true })).toBeDisabled();
  await closePane(page, isMobile);
  await addItem(page, isMobile, 'ロック確認');
  await tap(page.getByLabel('アイテム「ロック確認」を編集'), isMobile);
  properties = pane(page, isMobile);
  await expect(properties.getByLabel('移動先', { exact: true }).locator('option').filter({ hasText: 'S (ロック中)' })).toBeDisabled();
  await closePane(page, isMobile);
  await tap(page.getByLabel('ランク「S」を編集'), isMobile);
  properties = pane(page, isMobile);
  await properties.getByLabel('ランクをロック', { exact: true }).uncheck();
  await expect(properties.getByLabel('ランク名', { exact: true })).toBeEnabled();
});

test('blank names are rejected and HTML is rendered as text', async ({ page, isMobile }) => {
  await tap(page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '文字を追加' }), isMobile);
  const dialog = page.getByRole('dialog', { name: '文字アイテムを追加', exact: true });
  await dialog.getByLabel('アイテム名', { exact: true }).fill('   ');
  await dialog.getByRole('button', { name: '追加する', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('名前を1〜80文字');
  await dialog.getByLabel('アイテム名', { exact: true }).fill('<img src=x onerror=alert(1)>');
  await dialog.getByRole('button', { name: '追加する', exact: true }).click();
  await expect(page.getByTestId('unranked-items').locator('img')).toHaveCount(0);
  await expect(page.getByTestId('unranked-items')).toContainText('<img src=x onerror=alert(1)>');
});

test('keyboard form interaction, focus trap and focus restoration work', async ({ page }) => {
  const help = page.getByRole('button', { name: '使い方', exact: true });
  await help.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '基本操作' });
  await expect(dialog.getByRole('button', { name: '閉じる' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '閉じる' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
});

test('all tiers can be removed and a new tier can be added', async ({ page, isMobile }) => {
  for (const name of ['S', 'A', 'B', 'C', 'D']) {
    await tap(page.getByLabel(`ランク「${name}」を編集`), isMobile);
    await pane(page, isMobile).getByRole('button', { name: 'ランクを削除', exact: true }).click();
    await page.getByRole('dialog', { name: 'このランクを削除しますか？' }).getByRole('button', { name: '削除する' }).click();
    await closePane(page, isMobile);
  }
  await expect(page.getByRole('heading', { name: 'ランクがありません' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'ランクを追加', exact: true }).click();
  await expect(pane(page, isMobile).getByLabel('ランク名', { exact: true })).toHaveValue('新しいランク');
  await expect(page.locator('.tier-row')).toHaveCount(1);
});

test('item metadata, ordering and confirmed deletion work', async ({ page, isMobile }) => {
  await addItem(page, isMobile, '一');
  await addItem(page, isMobile, '二');
  await tap(page.getByLabel('アイテム「二」を編集'), isMobile);
  const properties = pane(page, isMobile);
  await properties.getByLabel('アイテム名', { exact: true }).fill('二番');
  await properties.getByLabel('説明', { exact: true }).fill('更新した説明');
  await properties.getByLabel('タグ', { exact: true }).fill('日本語, 重複, 重複');
  await properties.getByRole('button', { name: '変更を適用', exact: true }).click();
  await properties.getByRole('button', { name: '前へ', exact: true }).click();
  await expect(page.getByTestId('unranked-items').locator('.item-name').first()).toHaveText('二番');
  await properties.getByRole('button', { name: 'アイテムを削除', exact: true }).click();
  await page.getByRole('dialog', { name: 'このアイテムを削除しますか？' }).getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.locator('.item-card')).toHaveCount(2);
  await properties.getByRole('button', { name: 'アイテムを削除', exact: true }).click();
  await page.getByRole('dialog', { name: 'このアイテムを削除しますか？' }).getByRole('button', { name: '削除する' }).click();
  await closePane(page, isMobile);
  await expect(page.locator('.item-card')).toHaveCount(1);
  await expect(page.getByTestId('unranked-items')).toContainText('一');
});

test('unapplied form input warns before closing and cancellation retains the data', async ({ page, isMobile }) => {
  await addItem(page, isMobile, '再読込前の内容');
  await page.getByLabel('アイテム「再読込前の内容」を編集').click();
  await pane(page, isMobile).getByLabel('説明', { exact: true }).fill('未適用の変更');
  const dismissed = page.waitForEvent('dialog').then(async (dialog) => { expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss(); });
  await page.close({ runBeforeUnload: true });
  await dismissed;
  await expect(page.getByTestId('unranked-items')).toContainText('再読込前の内容');
});

test('mouse drag moves items and tiers; Escape leaves positions unchanged', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse-specific input; touch alternatives have separate coverage.');
  await addItem(page, false, 'ドラッグ対象');
  async function drag(source: Locator, target: Locator, cancel = false) {
    await source.scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 12, from.y + 8, { steps: 4 });
    await target.scrollIntoViewIfNeeded();
    const to = (await target.boundingBox())!;
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.app [data-dragging="true"]')).toHaveCount(0);
  }
  await drag(page.getByRole('button', { name: 'アイテム「ドラッグ対象」をドラッグ', exact: true }), row(page, 'S').getByTestId('tier-items'));
  await expect(row(page, 'S')).toContainText('ドラッグ対象');
  await drag(page.getByRole('button', { name: 'アイテム「ドラッグ対象」をドラッグ', exact: true }), row(page, 'A').getByTestId('tier-items'), true);
  await expect(row(page, 'S')).toContainText('ドラッグ対象');
  await drag(page.getByRole('button', { name: 'ランク「S」をドラッグ', exact: true }), row(page, 'B'));
  await expect(page.locator('.tier-row').nth(2)).toHaveAttribute('aria-label', 'ランク「S」');
});

test('keyboard drag reorders tiers and Escape cancels a move', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hardware keyboard coverage uses the desktop project.');
  const handle = page.getByRole('button', { name: 'ランク「S」をドラッグ', exact: true });
  await handle.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(page.locator('.app [data-dragging="true"]')).toHaveCount(0);
  await expect(page.locator('.tier-row').first()).toHaveAttribute('aria-label', 'ランク「A」');
  await page.getByRole('button', { name: 'ランク「A」をドラッグ', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.locator('.app [data-dragging="true"]')).toHaveCount(0);
  await expect(page.locator('.tier-row').first()).toHaveAttribute('aria-label', 'ランク「A」');
});

test('touch long press reorders a tier', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch input coverage uses the mobile project.');
  const handle = page.getByRole('button', { name: 'ランク「S」をドラッグ', exact: true });
  const start = (await handle.boundingBox())!;
  const end = (await row(page, 'A').boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const point = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await expect(handle).toHaveAttribute('aria-grabbed', 'true');
  for (let step = 1; step <= 10; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + (end.x + end.width / 2 - point.x) * step / 10, y: point.y + (end.y + end.height / 2 - point.y) * step / 10 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.app [data-dragging="true"]')).toHaveCount(0);
  await expect(page.locator('.tier-row').first()).toHaveAttribute('aria-label', 'ランク「A」');
  await session.detach();
});

test('properties and forms remain accessible, and panel controls stay available', async ({ page, isMobile }, testInfo) => {
  if (!isMobile) {
    await page.getByRole('button', { name: 'ランクパネルの表示切替' }).click();
    await expect(page.getByRole('complementary', { name: 'ランク一覧', exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'ランクパネルの表示切替' }).click();
    await page.getByRole('button', { name: '設定パネルの表示切替' }).click();
    await expect(pane(page, false)).not.toBeVisible();
  }
  await tap(page.getByLabel('ランク「S」を編集'), isMobile);
  await expect(pane(page, isMobile).getByLabel('ランク名', { exact: true })).toBeVisible();
  const tierA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(tierA11y.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([]);
  await page.screenshot({ path: `.qa/${testInfo.project.name}-properties.png`, fullPage: !isMobile });
  await closePane(page, isMobile);
  await tap(page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '文字を追加' }), isMobile);
  const formA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(formA11y.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([]);
});

test('responsive layout fits phone, tablet and desktop widths with long text', async ({ page, isMobile }) => {
  test.skip(isMobile, 'This test varies desktop viewport widths; mobile taps are covered elsewhere.');
  await page.getByRole('complementary', { name: 'プロパティ' }).getByLabel('プロジェクト名', { exact: true }).fill('長いタイトル'.repeat(18));
  await page.getByRole('complementary', { name: 'プロパティ' }).getByRole('button', { name: '変更を適用' }).click();
  for (const width of [320, 390, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
  }
});
