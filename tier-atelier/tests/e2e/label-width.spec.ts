import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject } from '../../src/data/defaults';
import type { Project } from '../../src/data/types';

const issues = new WeakMap<Page, string[]>();
const properties = (page: Page, mobile: boolean) => page.getByRole(mobile ? 'dialog' : 'complementary', { name: 'プロパティ', exact: true });
const mode = 'ランク名の幅（全ランク共通）';
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; issues.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await expect(page.getByTestId('save-status')).toHaveText('保存済み');
});
test.afterEach(({ page }) => expect(issues.get(page)).toEqual([]));
async function close(page: Page, mobile: boolean) { if (mobile) await properties(page, mobile).getByRole('button', { name: '閉じる', exact: true }).click(); }
async function backup(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('.canvas-footer button').click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as { project: Project; blobs: unknown[]; format: string; backupVersion: number };
}
async function restore(page: Page, data: unknown) {
  await page.getByRole('button', { name: 'プロジェクト一覧', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'プロジェクト一覧', exact: true });
  await manager.getByLabel('JSONから復元', { exact: true }).setInputFiles({ name: 'ランク幅 日本語.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(manager).not.toBeVisible();
}
async function widths(page: Page) { return page.locator('.tier-label').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width)); }
async function automaticWidth(page: Page) {
  return page.locator('.design-surface').evaluate((surface) => {
    const button = surface.querySelector('.tier-name')!, style = getComputedStyle(button);
    const ctx = document.createElement('canvas').getContext('2d')!; ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const desired = Math.ceil(Math.max(48, ...Array.from(surface.querySelectorAll('.tier-name')).map((name) => ctx.measureText(name.querySelector('span')!.textContent!).width + 34 + (name.querySelector('svg') ? 17 : 0))));
    const row = surface.querySelector('.tier-row')!;
    return { desired, shown: Math.min(desired, (row.getBoundingClientRect().width - 2) * .4) };
  });
}

test('automatic and manual widths preserve individual values, undo, autosave and JSON', async ({ page, isMobile }, info) => {
  const pane = properties(page, isMobile);
  await page.getByLabel('ランク「S」を編集', { exact: true }).click();
  await pane.getByLabel('ランク名', { exact: true }).fill('とても儚い');
  await pane.getByLabel('個別ラベル幅（px）').fill('120');
  await pane.getByRole('button', { name: '変更を適用', exact: true }).click();
  await pane.getByLabel(mode).selectOption('auto');
  await expect(pane.getByLabel('個別ラベル幅（px）')).toBeDisabled();
  await pane.getByRole('button', { name: '変更を適用', exact: true }).click(); await close(page, isMobile);
  const expected = await automaticWidth(page);
  await expect.poll(async () => (await widths(page)).every((w) => Math.abs(w - expected.shown) < 1)).toBe(true);
  if (!isMobile) {
    const text = page.locator('.tier-name span').first();
    expect(await text.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(50);
  }
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  expect((await backup(page)).project.style.labelWidthMode).toBeUndefined();
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('保存済み'); await page.reload();
  const saved = await backup(page); expect(saved.project.style.labelWidthMode).toBe('auto'); expect(saved.project.tiers[0]!.labelWidth).toBe(120);
  await restore(page, saved);
  const restored = await backup(page); expect(restored.project.id).not.toBe(saved.project.id); expect(restored.project.style).toEqual(saved.project.style); expect(restored.project.tiers).toEqual(saved.project.tiers);
  await expect.poll(async () => (await widths(page)).every((w) => Math.abs(w - expected.shown) < 1)).toBe(true);
  await page.getByLabel('ランク「とても儚い」を編集', { exact: true }).click();
  await pane.getByLabel(mode).focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(pane.getByLabel(mode)).toHaveValue('manual');
  await pane.getByLabel('ラベル幅（px）', { exact: true }).fill('180');
  await expect(pane.getByLabel('個別ラベル幅（px）')).toHaveValue('120');
  await pane.getByRole('button', { name: '変更を適用', exact: true }).click(); await close(page, isMobile);
  const manual = await backup(page); expect(manual.project.style).toMatchObject({ labelWidthMode: 'manual', labelWidth: 180 });
  expect(manual.project.tiers[0]!.labelWidth).toBe(120);
  if (!isMobile) expect(await widths(page)).toEqual([120, 180, 180, 180, 180]);
  await page.getByLabel('ランク「とても儚い」を編集', { exact: true }).click();
  await pane.getByLabel('個別ラベル幅（px）').fill('');
  await pane.getByLabel(mode).selectOption('auto');
  await pane.getByRole('button', { name: '変更を適用', exact: true }).click();
  await expect(pane.getByLabel('個別ラベル幅（px）')).toHaveValue('');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `.qa/${info.project.name}-label-width-settings.png`, fullPage: true });
  await close(page, isMobile);
  await page.screenshot({ path: `.qa/${info.project.name}-label-width-board.png`, fullPage: true });
});

test('auto width follows rename and font changes, stays responsive and reaches every image format', async ({ page, isMobile }, info) => {
  test.setTimeout(60000);
  const project = createProject(); project.tiers[0]!.name = 'とても儚い'; project.style.labelWidthMode = 'auto';
  await restore(page, { format: 'tier-atelier', backupVersion: 1, project, blobs: [] });
  const initial = (await automaticWidth(page)).desired;
  const pane = properties(page, isMobile);
  await page.getByLabel('ランク「A」を編集', { exact: true }).click();
  await pane.getByLabel('ランク名', { exact: true }).fill('とても長いランク名');
  await pane.getByRole('button', { name: '変更を適用', exact: true }).click(); await close(page, isMobile);
  expect((await automaticWidth(page)).desired).toBeGreaterThan(initial);
  await page.locator(isMobile ? '.mobile-toolbar' : '.left-panel').getByRole('button', { name: 'デザイン', exact: true }).click();
  await pane.locator('summary').filter({ hasText: '文字・見出し' }).click();
  await pane.getByLabel('ラベル文字サイズ（px）').fill('40'); await pane.getByLabel('フォント', { exact: true }).selectOption('serif');
  await pane.getByRole('button', { name: 'デザインを保存', exact: true }).click(); await close(page, isMobile);
  const auto = await automaticWidth(page);
  await expect.poll(async () => (await widths(page)).every((w) => Math.abs(w - auto.shown) < 1)).toBe(true);
  await page.getByRole('button', { name: '出力・共有', exact: true }).click();
  const output = page.getByRole('dialog', { name: '画像出力・印刷・共有', exact: true });
  await output.getByLabel('出力の基準幅（px）').fill('1200'); await output.getByLabel('タイトル・説明を含める').uncheck();
  for (const format of ['png', 'jpeg', 'webp']) {
    await output.getByLabel('画像形式').selectOption(format); await output.getByRole('button', { name: 'プレビューを作成', exact: true }).click();
    await expect(output.getByRole('button', { name: '画像を保存', exact: true })).toBeEnabled({ timeout: 15000 });
    const pending = page.waitForEvent('download'); await output.getByRole('button', { name: '画像を保存', exact: true }).click();
    const bytes = await readFile((await (await pending).path())!);
    const pixels = await page.evaluate(async ({ data, format, boundary }) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: `image/${format}` }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
      return [boundary - 8, boundary + 8].map((x) => Array.from(ctx.getImageData(x, 24, 1, 1).data));
    }, { data: bytes.toString('base64'), format, boundary: 12 + auto.desired });
    for (const [i, expected] of [[0, [237, 170, 168]], [1, [255, 255, 255]]] as const) expected.forEach((value, channel) => expect(Math.abs(pixels[i]![channel]! - value)).toBeLessThan(6));
    if (format === 'png') await writeFile(`.qa/${info.project.name}-label-width-output.png`, bytes);
  }
  await output.getByRole('button', { name: '閉じる', exact: true }).click();
  for (const width of [320, 390, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect.poll(async () => {
      const wanted = await automaticWidth(page);
      return (await widths(page)).every((w) => Math.abs(w - wanted.shown) < 1);
    }).toBe(true);
  }
});
