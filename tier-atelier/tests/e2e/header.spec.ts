import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = []; errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') list.push(message.text()); });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
async function start(page: Page) { await page.goto('/'); await expect(page.getByTestId('save-status')).toHaveText('保存済み'); }
const dark = (page: Page) => page.getByRole('button', { name: 'ライトモード：ダークモードに切り替え', exact: true });
const light = (page: Page) => page.getByRole('button', { name: 'ダークモード：ライトモードに切り替え', exact: true });
async function accessible(page: Page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]); }

test('header controls, keyboard dialogs and narrow layouts work in both modes', async ({ page, isMobile }, info) => {
  await page.emulateMedia({ colorScheme: 'light' }); await start(page);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await dark(page).click();
    for (const width of isMobile ? [320, 390] : [768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByRole('button', { name: '更新情報', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator('.header-actions').evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(width);
    }
    await accessible(page);
    for (const [button, title] of [['更新情報', '更新情報'], ['Help（使い方）', '基本操作']]) {
      const opener = page.getByRole('button', { name: button, exact: true });
      await opener.focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      await expect(dialog).toBeVisible(); await accessible(page);
      await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: '閉じる', exact: true })).toBeFocused();
      await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
    }
    await page.screenshot({ path: `.qa/${info.project.name}-header-${theme}.png`, fullPage: true });
  }
});

test('system preference, explicit override, reload and other tabs preserve the selected mode', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); await start(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' }); await expect(dark(page)).toBeVisible();
  await dark(page).click(); await page.reload(); await expect(light(page)).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' }); await page.emulateMedia({ colorScheme: 'light' });
  await expect(light(page)).toBeVisible();
  const other = await context.newPage(); await start(other); await expect(light(other)).toBeVisible();
  await light(other).click(); await expect(dark(page)).toBeVisible();
  await other.close();
});

test('invalid or unavailable theme storage leaves the editor usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('tier-atelier.appearance.v1', '{invalid'));
  await start(page); await expect(dark(page)).toBeVisible();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tier-atelier.appearance.v1') throw new DOMException('Full', 'QuotaExceededError');
      set.call(this, key, value);
    };
  });
  await dark(page).click(); await expect(light(page)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '表示モードを保存できませんでした' })).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await page.getByRole('button', { name: 'Help（使い方）', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '基本操作', exact: true })).toBeVisible();
});

test('dark mode preserves JSON, project styling, PNG bytes and undo history', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await start(page);
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '文字を追加', exact: true }).click();
  const form = page.getByRole('dialog', { name: '文字アイテムを追加', exact: true });
  await form.getByLabel('アイテム名', { exact: true }).fill('表示モード検証');
  await form.getByRole('button', { name: '追加する', exact: true }).click();
  async function snapshot() {
    await page.getByRole('button', { name: '出力・共有', exact: true }).click();
    const panel = page.getByRole('dialog', { name: '画像出力・印刷・共有', exact: true });
    await panel.getByLabel('未分類を含める').check();
    await panel.getByRole('button', { name: 'プレビューを作成', exact: true }).click();
    await expect(panel.getByRole('button', { name: '画像を保存', exact: true })).toBeEnabled({ timeout: 15000 });
    const imageWait = page.waitForEvent('download'); await panel.getByRole('button', { name: '画像を保存', exact: true }).click();
    const png = await readFile((await (await imageWait).path())!);
    await panel.getByRole('button', { name: '閉じる', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText('保存済み');
    const backupWait = page.waitForEvent('download'); await page.locator('.canvas-footer').getByRole('button', { name: 'JSONバックアップ', exact: true }).click();
    const backup = JSON.parse(await readFile((await (await backupWait).path())!, 'utf8')) as { project: unknown; blobs: unknown };
    return { png, project: backup.project, blobs: backup.blobs, style: await page.locator('.design-surface').getAttribute('style') };
  }
  const before = await snapshot(); await dark(page).click(); const after = await snapshot();
  expect(after).toEqual(before);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeDisabled();
  await expect(page.locator('.item-card')).toHaveCount(0); await expect(light(page)).toBeVisible();
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(1);
});

test('dark dialogs and design properties retain accessible contrast', async ({ page, isMobile }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); await start(page);
  for (const [button, title] of [['プロジェクト一覧', 'プロジェクト一覧'], ['出力・共有', '画像出力・印刷・共有'], ['アプリ・オフライン', 'アプリとオフライン']]) {
    await page.getByRole('button', { name: button, exact: true }).click();
    const panel = page.getByRole('dialog', { name: title, exact: true }); await expect(panel).toBeVisible(); await accessible(page);
    await panel.getByRole('button', { name: '閉じる', exact: true }).click();
  }
  await page.locator(isMobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click();
  await accessible(page);
});

test('image processing disables dialog close and releases it after saving', async ({ page, isMobile }) => {
  await start(page);
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 40;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#118866'; ctx.fillRect(0, 0, 40, 40);
    return canvas.toDataURL().split(',')[1]!;
  });
  for (const background of isMobile ? [false, true] : [false]) {
    if (background) await page.locator('.mobile-toolbar').getByRole('button', { name: 'デザイン', exact: true }).click();
    else await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '画像を追加', exact: true }).click();
    const panel = page.getByRole('dialog', { name: background ? 'プロパティ' : '画像を追加', exact: true });
    await page.evaluate(() => {
      const original = Blob.prototype.arrayBuffer;
      const pending = new Promise<void>((resolve) => document.addEventListener('qa-release-image-read', () => {
        Blob.prototype.arrayBuffer = original; resolve();
      }, { once: true }));
      Blob.prototype.arrayBuffer = async function () { await pending; return original.call(this); };
    });
    await panel.getByLabel(background ? '背景画像を登録' : '画像ファイルを選択', { exact: true }).setInputFiles({ name: '処理待ち.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
    const close = panel.getByRole('button', { name: '閉じる', exact: true });
    await expect(close).toBeDisabled(); await page.keyboard.press('Escape'); await expect(panel).toBeVisible();
    await page.evaluate(() => document.dispatchEvent(new Event('qa-release-image-read')));
    await expect(close).toBeEnabled(); await close.click(); await expect(panel).not.toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  }
  const wait = page.waitForEvent('download'); await page.locator('.canvas-footer').getByRole('button', { name: 'JSONバックアップ', exact: true }).click();
  const data = JSON.parse(await readFile((await (await wait).path())!, 'utf8')) as { blobs: unknown[] };
  expect(data.blobs).toHaveLength(isMobile ? 2 : 1);
});
