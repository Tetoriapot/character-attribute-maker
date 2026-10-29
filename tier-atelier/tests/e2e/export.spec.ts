import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject } from '../../src/data/defaults';
import type { Project } from '../../src/data/types';
import { designDefaults } from '../../src/features/design/settings';

const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; issues.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
});
test.afterEach(({ page }) => { expect(issues.get(page)).toEqual([]); });
const dialog = (page: Page) => page.getByRole('dialog', { name: '画像出力・印刷・共有', exact: true });
async function open(page: Page) { await page.getByRole('button', { name: '出力・共有', exact: true }).click(); await expect(dialog(page).getByRole('button', { name: 'プレビューを作成', exact: true })).toBeEnabled(); }
async function generate(page: Page) { await dialog(page).getByRole('button', { name: 'プレビューを作成', exact: true }).click(); await expect(dialog(page).getByRole('button', { name: '画像を保存', exact: true })).toBeEnabled({ timeout: 15000 }); }
async function download(page: Page, button = '画像を保存') {
  const pending = page.waitForEvent('download'); await dialog(page).getByRole('button', { name: button, exact: true }).click(); const file = await pending;
  return { name: file.suggestedFilename(), buffer: await readFile((await file.path())!) };
}
async function decode(page: Page, buffer: Buffer, type: string, points: [number, number][] = [[0, 0]]) {
  return page.evaluate(async ({ data, type, points }) => {
    const blob = new Blob([Uint8Array.from(atob(data), (char) => char.charCodeAt(0))], { type });
    const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
    const result = { width: bitmap.width, height: bitmap.height, pixels: points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data)) }; bitmap.close(); return result;
  }, { data: buffer.toString('base64'), type, points });
}
async function importData(page: Page, project: Project, blobs: { key: string; mimeType: string; dataBase64: string }[] = []) {
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: '出力検証.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'tier-atelier', backupVersion: 1, project, blobs })) });
  await expect(manager).not.toBeVisible();
}
async function imageProject(page: Page, count = 21) {
  const project = createProject(); project.title = '日本語の 出力'; project.description = '画像とデザインの検証';
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 120;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#e77766'; ctx.fillRect(0, 0, 120, 120); ctx.fillStyle = '#558fc2'; ctx.fillRect(120, 0, 120, 120);
    return canvas.toDataURL().split(',')[1]!;
  });
  const blobs = [];
  for (let n = 0; n < count; n++) {
    const assetId = crypto.randomUUID(), id = crypto.randomUUID(), key = crypto.randomUUID();
    project.assets[assetId] = { id: assetId, blobKey: key, mimeType: 'image/png', width: 240, height: 120, originalName: `画像 ${n}.png` };
    project.items[id] = { id, assetId, name: `画像 ${n}`, description: '保持する説明', tags: ['日本語'], createdAt: project.createdAt, ...(n === 0 ? { crop: { x: .5, y: 0, width: .5, height: 1 } } : {}) };
    if (n === count - 1) project.unrankedItemIds.push(id); else project.tiers[0]!.itemIds.push(id);
    blobs.push({ key, mimeType: 'image/png', dataBase64: data });
  }
  await importData(page, project, blobs); return project;
}

test('PNG JPEG WebP, scale, alpha, filenames and saved settings work', async ({ page }) => {
  await open(page); const panel = dialog(page);
  await panel.getByLabel('出力の基準幅（px）').fill('640'); await panel.getByLabel('タイトル・説明を含める').uncheck();
  await panel.getByLabel('背景を透明にする').check(); await generate(page);
  const png = await download(page); expect(png.name).toBe('新しいTier表.png');
  const first = await decode(page, png.buffer, 'image/png'); expect(first).toMatchObject({ width: 640, height: 544, pixels: [[0, 0, 0, 0]] });
  for (const format of ['jpeg', 'webp']) {
    await panel.getByLabel('画像形式').selectOption(format); await panel.getByLabel('出力倍率', { exact: true }).selectOption('2');
    if (format === 'webp') await panel.getByLabel('背景を透明にする').check();
    else await expect(panel.getByLabel('背景を透明にする')).toBeDisabled();
    await expect(panel.getByRole('button', { name: '画像を保存', exact: true })).toBeDisabled();
    await generate(page); const file = await download(page);
    expect(file.name).toBe(`新しいTier表.${format === 'jpeg' ? 'jpg' : format}`);
    expect(format === 'jpeg' ? file.buffer.subarray(0, 2).toString('hex') : file.buffer.subarray(8, 12).toString()).toBe(format === 'jpeg' ? 'ffd8' : 'WEBP');
    const decoded = await decode(page, file.buffer, `image/${format}`); expect(decoded.width).toBe(first.width * 2); expect(decoded.height).toBe(first.height * 2);
    expect(decoded.pixels[0]![3]).toBe(format === 'jpeg' ? 255 : 0);
  }
  await panel.getByLabel('出力倍率', { exact: true }).selectOption('3'); await generate(page);
  expect((await decode(page, (await download(page)).buffer, 'image/webp')).width).toBe(1920);
  await panel.getByLabel('出力倍率', { exact: true }).selectOption('custom'); await panel.getByLabel('カスタム倍率', { exact: true }).fill('1.5'); await generate(page);
  expect((await decode(page, (await download(page)).buffer, 'image/webp')).width).toBe(960);
  await panel.getByRole('button', { name: '閉じる', exact: true }).click(); await page.reload(); await open(page);
  await expect(panel.getByLabel('カスタム倍率', { exact: true })).toHaveValue('1.5'); await expect(panel.getByLabel('画像形式')).toHaveValue('webp');
});

test('empty and whitespace-only titles survive history, image JSON and all output formats', async ({ page, isMobile }, info) => {
  test.setTimeout(60000);
  await imageProject(page, 2);
  const properties = page.getByRole(isMobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
  const editTitle = async (title: string) => {
    await page.locator('.canvas-heading').getByRole('button', { name: 'プロジェクト設定', exact: true }).click();
    await properties.getByLabel('プロジェクト名', { exact: true }).fill(title);
    await properties.getByLabel('プロジェクトの説明', { exact: true }).fill('');
    await properties.getByRole('button', { name: '変更を適用', exact: true }).click();
    await expect(properties.getByLabel('プロジェクト名', { exact: true })).toHaveValue('');
    if (isMobile) await properties.getByRole('button', { name: '閉じる', exact: true }).click();
  };
  await editTitle('');
  await expect(page.locator('#board-heading')).toHaveClass('visually-hidden');
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.locator('#board-heading')).toHaveText('日本語の 出力');
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await editTitle('　   ');
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await page.reload();
  await expect(page.locator('#board-heading')).toHaveClass('visually-hidden');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `.qa/${info.project.name}-untitled-board.png`, fullPage: true });
  const pending = page.waitForEvent('download'); await page.locator('.canvas-footer button').click();
  const file = await pending; expect(file.suggestedFilename()).toBe('tier-atelier.tier.json');
  const data = JSON.parse(await readFile((await file.path())!, 'utf8')) as { project: Project; blobs: { key: string; mimeType: string; dataBase64: string }[] };
  expect(data.project.title).toBe(''); expect(data.blobs).toHaveLength(2);
  await open(page); const output = dialog(page);
  await output.getByLabel('未分類を含める').check();
  for (const format of ['png', 'jpeg', 'webp']) {
    await output.getByLabel('画像形式').selectOption(format);
    await output.getByLabel('タイトル・説明を含める').check(); await generate(page);
    const included = await download(page); expect(included.name).toBe(`tier-atelier.${format === 'jpeg' ? 'jpg' : format}`);
    await output.getByLabel('タイトル・説明を含める').uncheck(); await generate(page);
    expect((await download(page)).buffer.equals(included.buffer)).toBe(true);
    if (format === 'png') await writeFile(`.qa/${info.project.name}-untitled-output.png`, included.buffer);
  }
  await output.getByRole('button', { name: '閉じる', exact: true }).click();
  await importData(page, data.project, data.blobs);
  await expect(page.locator('.item-card')).toHaveCount(2);
  await page.reload(); await expect(page.locator('#board-heading')).toHaveClass('visually-hidden');
  await open(page); await output.getByLabel('画像形式').selectOption('png'); await output.getByLabel('タイトル・説明を含める').check(); await generate(page);
  expect((await download(page)).buffer.equals(await readFile(`.qa/${info.project.name}-untitled-output.png`))).toBe(true);
  await output.getByRole('button', { name: '印刷ページを作成', exact: true }).click();
  await expect(output.getByRole('button', { name: '印刷する', exact: true })).toBeEnabled({ timeout: 15000 });
  const frame = page.frames().find((frame) => frame.parentFrame() !== null)!;
  expect(await frame.locator('img').count()).toBeGreaterThan(0);
  expect(await frame.locator('body').innerText()).toBe('');
});

test('untitled description and tray headings have no title decoration; blank projects can be created and copied', async ({ page }) => {
  test.setTimeout(60000);
  const project = createProject(); project.title = ''; project.description = 'タイトルなしで説明を保持';
  let plain: Buffer | undefined;
  for (const titleDecoration of ['none', 'line', 'band'] as const) {
    project.style.titleDecoration = titleDecoration;
    await importData(page, project); await open(page);
    await dialog(page).getByLabel('タイトル・説明を含める').check(); await dialog(page).getByLabel('未分類を含める').check();
    await generate(page); const file = await download(page);
    if (plain) expect(file.buffer.equals(plain)).toBe(true); else plain = file.buffer;
    await dialog(page).getByRole('button', { name: '閉じる', exact: true }).click();
  }
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByRole('button', { name: '新規作成', exact: true }).click(); await expect(manager).not.toBeVisible();
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const current = manager.getByTestId('project-entry').filter({ has: page.locator('.current-project') });
  await expect(current.locator('strong')).toHaveText('タイトルなし');
  await current.getByRole('button', { name: '複製', exact: true }).click(); await expect(manager).not.toBeVisible();
  await expect(page.locator('#board-heading')).toHaveClass('visually-hidden');
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  await expect(current.locator('strong')).toHaveText('タイトルなし');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('21 original images, cropping, content switches and editor UI exclusion are verified in the output', async ({ page, isMobile }, info) => {
  await imageProject(page); await open(page);
  const panel = dialog(page);
  await panel.getByLabel('タイトル・説明を含める').uncheck(); await generate(page);
  const before = await download(page); await writeFile(`.qa/${info.project.name}-phase4-output.png`, before.buffer);
  const pixels = await decode(page, before.buffer, 'image/png', [[130, 34], [218, 34], [218, 54]]);
  expect(pixels.pixels[0]).toEqual([85, 143, 194, 255]); // Crop B only.
  expect(pixels.pixels[1]).toEqual([255, 255, 255, 255]); // Contain letterbox.
  expect(pixels.pixels[2]).toEqual([231, 119, 102, 255]);
  await panel.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('region', { name: 'ランク「S」', exact: true }).getByRole('button', { name: '折りたたむ', exact: true }).click();
  await page.getByLabel('ランク「S」を編集', { exact: true }).click();
  if (isMobile) await page.getByRole('dialog', { name: 'プロパティ', exact: true }).getByRole('button', { name: '閉じる', exact: true }).click();
  await page.locator('.tier-board').evaluate((board) => { const marker = document.createElement('button'); marker.textContent = '編集UI_SENTINEL'; marker.style.background = '#ff00ff'; board.append(marker); });
  await open(page); await generate(page);
  expect((await download(page)).buffer.equals(before.buffer)).toBe(true);
  await panel.getByLabel('タイトル・説明を含める').check(); await panel.getByLabel('未分類を含める').check(); await generate(page);
  const larger = await download(page); expect((await decode(page, larger.buffer, 'image/png')).height).toBeGreaterThan(pixels.height);
  const preview = panel.getByRole('region', { name: '出力プレビュー', exact: true });
  await preview.focus(); await expect(preview).toBeFocused();
  if (!isMobile) { await page.keyboard.press('End'); await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0); }
  await page.screenshot({ path: `.qa/${info.project.name}-phase4-dialog.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('print document contains output pages only and preserves all pixels across page breaks', async ({ page }, info) => {
  const project = createProject();
  project.title = '印刷の検証'; project.tiers = Array.from({ length: 20 }, (_, index) => ({ ...project.tiers[index % 5]!, id: crypto.randomUUID(), name: `ランク${index + 1}` }));
  await importData(page, project); await open(page); await generate(page);
  await dialog(page).getByRole('button', { name: '印刷ページを作成', exact: true }).click();
  // Encoding every A4 page can exceed the default assertion timeout on shared CI runners.
  await expect(dialog(page).getByRole('button', { name: '印刷する', exact: true })).toBeEnabled({ timeout: 15000 });
  const frame = page.frames().find((frame) => frame.parentFrame() !== null)!;
  const result = await frame.evaluate(() => ({ pages: document.images.length, controls: document.querySelectorAll('button,input,textarea,select').length, text: document.body.textContent, totalHeight: Array.from(document.images).reduce((sum, image) => sum + image.naturalHeight, 0), complete: Array.from(document.images).every((image) => image.complete) }));
  expect(result.pages).toBeGreaterThan(1); expect(result.controls).toBe(0); expect(result.text).toBe(''); expect(result.complete).toBe(true);
  const file = await download(page); expect(result.totalHeight).toBe((await decode(page, file.buffer, 'image/png')).height);
  await frame.evaluate(() => { window.print = () => { document.body.dataset.printInvoked = 'true'; }; });
  await dialog(page).getByRole('button', { name: '印刷する', exact: true }).click();
  expect(await frame.locator('body').getAttribute('data-print-invoked')).toBe('true');
  const images = await frame.locator('img').evaluateAll(async (images) => Promise.all(images.map(async (image) => {
    const blob = await (await fetch((image as HTMLImageElement).src)).blob();
    return await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob); });
  })));
  const printPage = await page.context().newPage();
  await printPage.setContent('<style>@page{size:A4;margin:12mm}body{margin:0}img{display:block;width:100%;height:auto;break-after:page}img:last-child{break-after:auto}</style>');
  await printPage.evaluate(async (urls) => { for (const url of urls) { const image = new Image(); image.src = url; document.body.append(image); await image.decode(); } }, images);
  await printPage.pdf({ path: `.qa/${info.project.name}-phase4-print.pdf`, preferCSSPageSize: true, printBackground: true }); await printPage.close();
  await dialog(page).getByRole('button', { name: '閉じる', exact: true }).click(); await expect(page.locator('iframe.export-print-frame')).toHaveCount(0);
});

test('share fallback downloads a restorable project; native share succeeds and cancellation is handled', async ({ page }) => {
  await imageProject(page, 2);
  await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); });
  await open(page); await generate(page);
  const image = await download(page, '画像を共有'); expect(image.name).toBe('日本語の 出力.png');
  await dialog(page).getByRole('button', { name: '共有用JSONを作成', exact: true }).click();
  await expect(dialog(page).getByRole('button', { name: 'プロジェクトを共有', exact: true })).toBeEnabled();
  const shared = await download(page, 'プロジェクトを共有');
  const data = JSON.parse(shared.buffer.toString()) as { project: Project; blobs: { key: string; mimeType: string; dataBase64: string }[] };
  expect(data.blobs).toHaveLength(2);
  await dialog(page).getByRole('button', { name: '共有URLを作成', exact: true }).click(); await expect(dialog(page).getByRole('alert')).toContainText('画像を含むため');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { document.body.dataset.sharedName = data.files?.[0]?.name; document.body.dataset.sharedType = data.files?.[0]?.type; } });
  });
  await dialog(page).getByRole('button', { name: '画像を共有', exact: true }).click(); await expect(dialog(page).getByRole('status')).toHaveText('共有先へ渡しました。');
  await expect(page.locator('body')).toHaveAttribute('data-shared-type', 'image/png');
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Canceled', 'AbortError'); } }); });
  await dialog(page).getByRole('button', { name: '画像を共有', exact: true }).click(); await expect(dialog(page).getByRole('status')).toHaveText('共有をキャンセルしました。');
  await dialog(page).getByRole('button', { name: '閉じる', exact: true }).click(); await importData(page, data.project, data.blobs);
  await expect(page.locator('.item-card')).toHaveCount(2);
});

test('text URL can be copied and imported as a new project without changing the original', async ({ page, context }) => {
  const project = createProject(); project.title = '日本語の共有 👋';
  const id = crypto.randomUUID(); project.items[id] = { id, assetId: null, name: '<script>共有内容</script>', description: '説明', tags: ['タグ'], createdAt: project.createdAt }; project.tiers[0]!.itemIds.push(id);
  await importData(page, project); await open(page);
  await dialog(page).getByRole('button', { name: '共有URLを作成', exact: true }).click();
  const url = await dialog(page).getByLabel('共有URL', { exact: true }).inputValue(); expect(url.length).toBeLessThanOrEqual(8000);
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { document.body.dataset.clipboard = value; } } }); });
  await dialog(page).getByRole('button', { name: 'URLをコピー', exact: true }).click(); await expect(page.locator('body')).toHaveAttribute('data-clipboard', url);
  const receiver = await context.newPage(); await receiver.goto(url);
  const incoming = receiver.getByRole('dialog', { name: '共有されたTier表', exact: true });
  await expect(incoming).toContainText('日本語の共有 👋'); await incoming.getByRole('button', { name: '新しいプロジェクトとして取り込む', exact: true }).click();
  await expect(incoming).not.toBeVisible(); await expect(receiver.locator('.item-name')).toHaveText('<script>共有内容</script>');
  expect(new URL(receiver.url()).hash).toBe('');
  await receiver.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  await expect(receiver.getByTestId('project-entry')).toHaveCount(3); await receiver.close();
});

test('invalid links, empty output, limits and unsupported encoding recover without changing project data', async ({ page }) => {
  await page.goto('/#tier=invalid!');
  const incoming = page.getByRole('dialog', { name: '共有されたTier表', exact: true }); await expect(incoming.getByRole('alert')).toBeVisible(); await incoming.getByRole('button', { name: '閉じる', exact: true }).click();
  const project = createProject(); project.tiers = []; await importData(page, project); await open(page);
  await dialog(page).getByLabel('タイトル・説明を含める').uncheck(); await generate(page);
  expect((await decode(page, (await download(page)).buffer, 'image/png')).height).toBe(64);
  await dialog(page).getByLabel('出力の基準幅（px）').fill('2400'); await dialog(page).getByLabel('出力倍率', { exact: true }).selectOption('custom'); await dialog(page).getByLabel('カスタム倍率', { exact: true }).fill('4');
  await dialog(page).getByRole('button', { name: 'プレビューを作成', exact: true }).click(); await expect(dialog(page).getByRole('alert')).toContainText('上限');
  await dialog(page).getByLabel('出力の基準幅（px）').fill('640'); await dialog(page).getByLabel('出力倍率', { exact: true }).selectOption('1');
  await page.evaluate(() => { const original = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) { HTMLCanvasElement.prototype.toBlob = original; return original.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality); }; });
  await dialog(page).getByLabel('画像形式').selectOption('webp'); await dialog(page).getByRole('button', { name: 'プレビューを作成', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('PNGを選択'); await dialog(page).getByLabel('画像形式').selectOption('png'); await generate(page);
  await dialog(page).getByRole('button', { name: '閉じる', exact: true }).click(); await page.reload(); await expect(page.locator('.tier-row')).toHaveCount(0);
});

test('export waits for fonts and mobile controls do not overflow', async ({ page, isMobile }) => {
  await open(page);
  await page.evaluate(() => {
    const original = document.fonts.load.bind(document.fonts);
    let release: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    Object.defineProperty(document.fonts, 'load', { configurable: true, value: async (...args: Parameters<FontFaceSet['load']>) => { await wait; return original(...args); } });
    const button = document.createElement('button'); button.id = 'test-font-release'; button.textContent = 'フォント読み込み完了'; button.onclick = () => release(); document.querySelector('dialog .dialog-content')!.append(button);
  });
  await dialog(page).getByRole('button', { name: 'プレビューを作成', exact: true }).click();
  await expect(dialog(page).getByRole('button', { name: '画像を保存', exact: true })).toBeDisabled();
  await page.locator('#test-font-release').click(); await expect(dialog(page).getByRole('button', { name: '画像を保存', exact: true })).toBeEnabled();
  await page.locator('#test-font-release').evaluate((button) => button.remove());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (isMobile) { await page.setViewportSize({ width: 320, height: 844 }); expect(await dialog(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true); }
});

test('all design templates produce distinct images with their colors and readable Japanese', async ({ page }, info) => {
  test.setTimeout(60000);
  const themes = JSON.parse(await readFile(new URL('../../src/data/themes/themes.json', import.meta.url), 'utf8')) as { id: string; name: string; style: Partial<Project['style']>; colors: string[]; foreground: string }[];
  const outputs = new Set<string>();
  for (const theme of themes) {
    const project = createProject(); project.title = `${theme.name}の出力`; project.description = '日本語の見出しと文字カード';
    project.style = { ...designDefaults, ...theme.style, cardTextColor: theme.style.textColor ?? designDefaults.cardTextColor }; project.tiers.forEach((tier, index) => { tier.background = theme.colors[index % theme.colors.length]!; tier.foreground = theme.foreground; });
    const id = crypto.randomUUID(); project.items[id] = { id, assetId: null, name: '文字アイテム', description: '', tags: [], createdAt: project.createdAt }; project.tiers[0]!.itemIds.push(id);
    await importData(page, project); await open(page); await generate(page);
    const file = await download(page); outputs.add(file.buffer.toString('base64'));
    const decoded = await decode(page, file.buffer, 'image/png', [[5, 5]]); expect(decoded.pixels[0]![3]).toBe(255);
    await writeFile(`.qa/${info.project.name}-phase4-${theme.id}.png`, file.buffer);
    await dialog(page).getByRole('button', { name: '閉じる', exact: true }).click();
  }
  expect(outputs.size).toBe(themes.length);
});

test('original background, custom design and crops export identically after reload and image JSON restoration', async ({ page }) => {
  test.setTimeout(60000);
  await imageProject(page, 24); await open(page);
  await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); });
  await dialog(page).getByRole('button', { name: '共有用JSONを作成', exact: true }).click();
  const initial = JSON.parse((await download(page, 'プロジェクトを共有')).buffer.toString()) as { project: Project; blobs: { key: string; mimeType: string; dataBase64: string }[] };
  await dialog(page).getByRole('button', { name: '閉じる', exact: true }).click();
  const { project, blobs } = initial;
  project.style = { ...project.style, backgroundMode: 'image', backgroundAssetId: Object.keys(project.assets)[0]!, itemSize: 110, padding: 24, gap: 14, rowGap: 9, radius: 16, borderStyle: 'dashed', borderWidth: 3, fontFamily: 'serif', fontSize: 16, titleAlign: 'right', titleDecoration: 'band', titleSize: 38, cardBackground: '#f8ead5', cardTextColor: '#223344', shadow: 'hard' };
  project.tiers[0]!.labelWidth = 120; project.tiers[1]!.minHeight = 180;
  await importData(page, project, blobs); await open(page); await dialog(page).getByLabel('未分類を含める').check(); await generate(page);
  const before = await download(page); expect((await decode(page, before.buffer, 'image/png', [[0, 0]])).pixels[0]).toEqual([231, 119, 102, 255]);
  await dialog(page).getByRole('button', { name: '共有用JSONを作成', exact: true }).click();
  const backup = JSON.parse((await download(page, 'プロジェクトを共有')).buffer.toString()) as typeof initial;
  expect(backup.project.style).toEqual(project.style);
  expect(backup.blobs.map(({ dataBase64, mimeType }) => ({ dataBase64, mimeType }))).toEqual(blobs.map(({ dataBase64, mimeType }) => ({ dataBase64, mimeType })));
  expect(backup.blobs.every((blob) => !blobs.some((original) => original.key === blob.key))).toBe(true);
  await dialog(page).getByRole('button', { name: '閉じる', exact: true }).click(); await page.reload(); await open(page); await generate(page);
  expect((await download(page)).buffer.equals(before.buffer)).toBe(true);
  await dialog(page).getByRole('button', { name: '閉じる', exact: true }).click(); await importData(page, backup.project, backup.blobs); await open(page); await generate(page);
  expect((await download(page)).buffer.equals(before.buffer)).toBe(true);
  await dialog(page).getByLabel('背景を透明にする').check(); await generate(page);
  expect((await decode(page, (await download(page)).buffer, 'image/png')).pixels[0]).toEqual([0, 0, 0, 0]);
});
