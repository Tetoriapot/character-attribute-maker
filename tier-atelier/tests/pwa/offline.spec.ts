import { test, expect, chromium, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Project } from '../../src/data/types';

const panel = (page: Page) => page.getByRole('dialog', { name: 'アプリとオフライン', exact: true });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, request }) => {
  await request.post('/__test__/release?value=a');
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', (error) => messages.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') messages.push(message.text()); });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
async function ready(page: Page, path = '/') {
  await page.goto(path); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await page.getByRole('button', { name: 'アプリ・オフライン', exact: true }).click();
  await expect(panel(page).getByTestId('offline-status')).toHaveText('オフラインで利用できます。');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await panel(page).getByRole('button', { name: '閉じる', exact: true }).click();
}
async function images(page: Page, count: number, contentType = 'image/png') {
  const encoded = await page.evaluate((type) => {
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 72;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#e77766'; ctx.fillRect(0, 0, 96, 72);
    return canvas.toDataURL(type).split(',')[1]!;
  }, contentType);
  await page.getByRole('region', { name: '未分類アイテム', exact: true }).getByRole('button', { name: '画像を追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '画像を追加', exact: true });
  await dialog.getByLabel('画像ファイルを選択').setInputFiles(Array.from({ length: count }, (_, i) => ({ name: `日本語 画像${i}.png`, mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') })));
  await expect(dialog.getByRole('status')).toContainText(`${count}枚の画像を登録しました`);
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
}
async function backup(page: Page) {
  const waiting = page.waitForEvent('download');
  await page.locator('.canvas-footer').getByRole('button', { name: 'JSONバックアップ', exact: true }).click();
  const text = await readFile((await (await waiting).path())!, 'utf8');
  return { text, data: JSON.parse(text) as { project: Project; blobs: { key: string; dataBase64: string }[] } };
}
async function build(page: Page) { return page.locator('meta[name="atelier-build"]').getAttribute('content'); }
async function notify(page: Page) {
  await page.getByRole('button', { name: 'アプリ・オフライン', exact: true }).click();
  await panel(page).getByRole('button', { name: '更新を確認する', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: '保存して更新', exact: true })).toBeVisible();
}

for (const path of ['/', '/nested/tier-atelier/']) test(`offline saved images, lazy export, edits, history and JSON round-trip: ${path}`, async ({ page, context, isMobile }, info) => {
  await ready(page, path); await images(page, 24); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await context.setOffline(true); await page.reload(); await expect(page.locator('.item-card')).toHaveCount(24);
  await images(page, 1, 'image/jpeg'); await expect(page.locator('.item-card')).toHaveCount(25);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click(); await expect(page.locator('.item-card')).toHaveCount(24);
  await page.getByRole('button', { name: 'やり直す', exact: true }).click(); await expect(page.locator('.item-card')).toHaveCount(25);
  await page.locator('.editing-tools > summary').click();
  await page.locator('.editing-tools').getByLabel('画像名を一括で非表示').check();
  await expect(page.locator('.item-name:not(.visually-hidden)')).toHaveCount(0);
  await page.locator(isMobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click();
  const design = page.getByRole(isMobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
  await design.getByLabel('背景色のカラーコード', { exact: true }).fill('#d5eafa');
  await design.locator('summary').filter({ hasText: 'サイズ・余白' }).click();
  await design.getByLabel('ランク名の幅（全ランク共通）').selectOption('auto');
  await design.getByRole('button', { name: 'デザインを保存', exact: true }).click();
  if (isMobile) await design.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.locator('.canvas-heading').getByRole('button', { name: 'プロジェクト設定', exact: true }).click();
  await design.getByLabel('プロジェクト名', { exact: true }).fill('');
  await design.getByRole('button', { name: '変更を適用', exact: true }).click();
  if (isMobile) await design.getByRole('button', { name: '閉じる', exact: true }).click();
  const before = await backup(page); expect(before.data.blobs).toHaveLength(25);
  expect(before.data.project.title).toBe('');
  expect(before.data.project.style.labelWidthMode).toBe('auto');
  await page.getByRole('button', { name: '複数選択', exact: true }).click();
  await page.getByRole('button', { name: '表示中を選択', exact: true }).click();
  await page.getByRole('button', { name: '選択項目を削除', exact: true }).click();
  await page.getByRole('dialog', { name: '25件のアイテムを削除しますか？', exact: true }).getByRole('button', { name: '削除する', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(0); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  expect((await backup(page)).data.blobs).toHaveLength(0);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.locator('.item-thumbnail')).toHaveCount(25);
  expect((await backup(page)).data.blobs.map((blob) => blob.dataBase64).sort()).toEqual(before.data.blobs.map((blob) => blob.dataBase64).sort());
  // ExportPanel has never been opened online: its lazy chunk must already be cached.
  await page.getByRole('button', { name: '出力・共有', exact: true }).click();
  const output = page.getByRole('dialog', { name: '画像出力・印刷・共有', exact: true });
  await output.getByLabel('未分類を含める').check(); await output.getByLabel('出力の基準幅（px）').fill('640');
  let png: Buffer | undefined;
  for (const format of ['png', 'jpeg', 'webp']) {
    await output.getByLabel('画像形式').selectOption(format);
    if (format !== 'jpeg') await output.getByLabel('背景を透明にする').check();
    await output.getByRole('button', { name: 'プレビューを作成', exact: true }).click();
    await expect(output.getByRole('button', { name: '画像を保存', exact: true })).toBeEnabled();
    const waiting = page.waitForEvent('download'); await output.getByRole('button', { name: '画像を保存', exact: true }).click();
    const file = await waiting, bytes = await readFile((await file.path())!);
    expect(file.suggestedFilename()).toBe(`tier-atelier.${format === 'jpeg' ? 'jpg' : format}`);
    const decoded = await page.evaluate(async ({ data, format }) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: `image/${format}` }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
      return { width: bitmap.width, alpha: ctx.getImageData(0, 0, 1, 1).data[3] };
    }, { data: bytes.toString('base64'), format });
    expect(decoded).toEqual({ width: 640, alpha: format === 'jpeg' ? 255 : 0 });
    if (format === 'png') png = bytes;
  }
  await output.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: '日本語 復元.json', mimeType: 'application/json', buffer: Buffer.from(before.text) });
  await expect(manager).not.toBeVisible(); await page.reload(); await expect(page.locator('.item-card')).toHaveCount(25);
  await expect(page.locator('.item-name:not(.visually-hidden)')).toHaveCount(0);
  const after = await backup(page); expect(after.data.project.id).not.toBe(before.data.project.id);
  expect(after.data.project.items).toEqual(before.data.project.items); expect(after.data.project.style).toEqual(before.data.project.style);
  for (const [id, asset] of Object.entries(before.data.project.assets)) {
    const restored = after.data.project.assets[id]!;
    expect(after.data.blobs.find((blob) => blob.key === restored.blobKey)?.dataBase64).toBe(before.data.blobs.find((blob) => blob.key === asset.blobKey)?.dataBase64);
  }
  await page.locator('.item-thumbnail').last().scrollIntoViewIfNeeded();
  expect(await page.locator('.item-thumbnail').evaluateAll((nodes) => nodes.every((node) => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const fresh = await context.newPage(); await fresh.goto(`${path}?offline=1`); await expect(fresh.locator('.item-card')).toHaveCount(25); await fresh.close();
  await page.getByRole('button', { name: 'アプリ・オフライン', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: '更新を確認する', exact: true })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `.qa/phase6-${info.project.name}-${path === '/' ? 'root' : 'nested'}.png`, fullPage: true });
  await writeFile(`.qa/phase6-${info.project.name}-offline.png`, png!);
  const cacheUrls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url)))).flat());
  expect(cacheUrls.some((url) => url.includes('ExportPanel'))).toBe(true);
  expect(cacheUrls.every((url) => new URL(url).origin === 'http://127.0.0.1:4180')).toBe(true);
  expect(cacheUrls.some((url) => url.startsWith('blob:') || url.startsWith('data:'))).toBe(false);
});

test('manual update keeps committed data and protects other tabs', async ({ page, context, request }, info) => {
  await ready(page); await images(page, 2); const before = await backup(page);
  await page.evaluate(async () => { await (await caches.open('unrelated-app')).put('/unrelated-sentinel', new Response('keep')); });
  const second = await context.newPage(); await second.goto('/'); await expect(second.locator('.item-card')).toHaveCount(2);
  await request.post('/__test__/release?value=b'); await notify(page);
  expect(await build(page)).toBe('pwa-a');
  await panel(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: 'あとで', exact: true }).click(); await expect(page.locator('.pwa-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'アプリ・オフライン', exact: true }).click();
  await panel(page).getByRole('button', { name: '保存して更新', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toContainText('別のタブ'); expect(await build(page)).toBe('pwa-a'); expect(await build(second)).toBe('pwa-a');
  await page.screenshot({ path: `.qa/phase6-${info.project.name}-update.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await second.close();
  await panel(page).getByRole('button', { name: '保存して更新', exact: true }).click();
  await expect(page.locator('meta[name="atelier-build"]')).toHaveAttribute('content', 'pwa-b');
  await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  const after = await backup(page); expect(after.data).toEqual(before.data);
  expect(await page.evaluate(async () => !!await (await caches.open('unrelated-app')).match('/unrelated-sentinel'))).toBe(true);
  await context.setOffline(true); await page.reload(); await expect(page.locator('.item-card')).toHaveCount(2);
});

test('save failure prevents activation, preserves emergency backup, and can be retried', async ({ page, request, isMobile }) => {
  await ready(page); await request.post('/__test__/release?value=b'); await notify(page);
  await panel(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'projects' && !document.body.dataset.allowSave) throw new DOMException('Test quota', 'QuotaExceededError');
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
  });
  await page.getByLabel('ランク「S」を編集', { exact: true }).click();
  const properties = page.getByRole(isMobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
  await properties.getByLabel('ランク名', { exact: true }).fill('保存を再試行');
  await properties.getByRole('button', { name: '変更を適用', exact: true }).click();
  if (isMobile) await properties.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('保存できませんでした');
  await page.getByRole('button', { name: 'アプリ・オフライン', exact: true }).click();
  await panel(page).getByRole('button', { name: '保存して更新', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toContainText('保存できなかったため更新を中止'); expect(await build(page)).toBe('pwa-a');
  await panel(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(panel(page)).not.toBeVisible();
  expect((await backup(page)).data.project.tiers[0]!.name).toBe('保存を再試行');
  await page.evaluate(() => { document.body.dataset.allowSave = 'true'; });
  await page.getByRole('button', { name: 'アプリ・オフライン', exact: true }).click();
  await panel(page).getByRole('button', { name: '保存して更新', exact: true }).click();
  await expect(page.locator('meta[name="atelier-build"]')).toHaveAttribute('content', 'pwa-b');
  await expect(page.getByRole('region', { name: 'ランク「保存を再試行」', exact: true })).toBeVisible();
});

test('unapplied inputs prevent update and retain native focus', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'Mobile property drawer is modal; it must be resolved before opening PWA controls.');
  await ready(page); await request.post('/__test__/release?value=b'); await notify(page);
  await panel(page).getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('ランク「S」を編集', { exact: true }).click();
  const name = page.getByRole('complementary', { name: 'プロパティ', exact: true }).getByLabel('ランク名', { exact: true });
  await name.fill('未適用を保持');
  const open = page.getByRole('button', { name: 'アプリ・オフライン', exact: true }); await open.click();
  await expect(panel(page).getByRole('button', { name: '保存して更新', exact: true })).toBeDisabled();
  await expect(panel(page)).toContainText('未適用の入力があります');
  await page.keyboard.press('Escape'); await expect(open).toBeFocused(); await expect(name).toHaveValue('未適用を保持'); expect(await build(page)).toBe('pwa-a');
});

test('manifest, icons and independent deployment scopes are valid', async ({ page, context, request }) => {
  await ready(page, '/nested/tier-atelier/');
  const manifest = await (await request.get('/nested/tier-atelier/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ id: './', start_url: './', scope: './', display: 'standalone', lang: 'ja' });
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const size = await page.evaluate(async (src) => { const image = new Image(); image.src = src; await image.decode(); return `${image.naturalWidth}x${image.naturalHeight}`; }, icon.src);
    expect(size).toBe(icon.sizes);
  }
  const nestedCaches = await page.evaluate(() => caches.keys());
  await ready(page); expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((reg) => new URL(reg.scope).pathname).sort())).toEqual(['/', '/nested/tier-atelier/']);
  expect(await page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(nestedCaches));
  const other = await context.newPage(); expect((await other.goto('/another-application/'))?.status()).toBe(404); await other.close();
  await context.setOffline(true);
  const nested = await context.newPage(); await nested.goto('/nested/tier-atelier/'); await expect(nested.getByTestId('save-status')).toHaveText('保存済み'); await nested.close();
  expect((await request.get('/another-application/')).status()).toBe(404);
});

test('failed release keeps the cached version and retries after publication completes', async ({ page, context, request }) => {
  await ready(page); await images(page, 1);
  await request.post('/__test__/release?value=b&fail=1');
  await page.getByRole('button', { name: 'アプリ・オフライン', exact: true }).click();
  await panel(page).getByRole('button', { name: '更新を確認する', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toContainText('更新を完了できませんでした');
  await expect(panel(page).getByTestId('offline-status')).toHaveText('オフラインで利用できます。');
  await expect(panel(page).getByRole('button', { name: '保存して更新', exact: true })).toHaveCount(0);
  await context.setOffline(true); await page.reload(); await expect(page.locator('.item-card')).toHaveCount(1); expect(await build(page)).toBe('pwa-a');
  await request.post('/__test__/release?value=b'); await context.setOffline(false); await notify(page);
  await panel(page).getByRole('button', { name: '保存して更新', exact: true }).click();
  await expect(page.locator('meta[name="atelier-build"]')).toHaveAttribute('content', 'pwa-b'); await expect(page.locator('.item-card')).toHaveCount(1);
});

test('initial registration retry and install event cancellation keep editing available', async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    let failed = false;
    navigator.serviceWorker.register = (...args) => { if (!failed) { failed = true; return Promise.reject(new Error('Registration test failure')); } return original(...args); };
  });
  await page.goto('/'); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
  await page.getByRole('button', { name: 'アプリ・オフライン', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toContainText('準備に失敗');
  await panel(page).getByRole('button', { name: '準備を再試行', exact: true }).click();
  await expect(panel(page).getByTestId('offline-status')).toHaveText('オフラインで利用できます。');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => { document.body.dataset.installCalled = 'true'; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await panel(page).getByRole('button', { name: 'アプリをインストール', exact: true }).click();
  await expect(panel(page)).toContainText('インストールをキャンセルしました'); await expect(page.locator('body')).toHaveAttribute('data-install-called', 'true');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled'))); await expect(panel(page)).toContainText('アプリをインストール済みです');
});

test('browser process restart retains the offline application and image project', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Persistent-profile process restart is tested once on desktop Chromium.');
  // Keep Windows CacheStorage file paths below the browser's path-length limit.
  const profile = resolve(`.qa/pwa-profile-${crypto.randomUUID().slice(0, 8)}`);
  for (const offline of [false, true]) {
    const browser = await chromium.launchPersistentContext(profile, { headless: true, offline, viewport: { width: 1440, height: 1080 } });
    try {
      const tab = browser.pages()[0]!;
      tab.on('pageerror', (error) => errors.get(page)!.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.get(page)!.push(message.text()); });
      await ready(tab, 'http://127.0.0.1:4180/');
      if (!offline) await images(tab, 24);
      await expect(tab.locator('.item-card')).toHaveCount(24);
      if (offline) {
        await images(tab, 1); await tab.getByRole('button', { name: '元に戻す', exact: true }).click(); await expect(tab.locator('.item-card')).toHaveCount(24);
        await tab.getByRole('button', { name: 'やり直す', exact: true }).click(); await expect(tab.locator('.item-card')).toHaveCount(25);
      }
      await expect(tab.getByTestId('save-status')).toHaveText('保存済み');
    } catch (error) {
      await info.attach('restart-state', { contentType: 'application/json', body: JSON.stringify(await browser.pages()[0]!.evaluate(async (offline) => ({
        offline, online: navigator.onLine, url: location.href, controller: navigator.serviceWorker.controller?.scriptURL,
        registrations: (await navigator.serviceWorker.getRegistrations()).map((r) => ({ scope: r.scope, active: r.active?.state, installing: r.installing?.state, waiting: r.waiting?.state })),
        caches: await caches.keys(), text: document.querySelector('dialog')?.textContent,
      }), offline)) });
      throw error;
    } finally { await browser.close(); }
  }
});
