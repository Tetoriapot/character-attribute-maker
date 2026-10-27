import { describe, expect, it } from 'vitest';
import { createProject } from '../../src/data/defaults';
import { parseProject } from '../../src/data/schemas';
import { editProject } from '../../src/features/editor/commands';
import { buildLayout, imageRect, printSlices, wrapText } from '../../src/features/export/layout';
import { defaultExportOptions as defaults, outputSize, parseOptions, safeFilename } from '../../src/features/export/options';
import { createShareUrl, readShareHash, MAX_SHARE_URL } from '../../src/features/export/sharing';

const measure = (text: string, size: number) => Array.from(text).length * size;
describe('output options and layout', () => {
  it('defaults to PNG at 1x without unranked items and rejects invalid sizes', () => {
    expect(parseOptions(defaults)).toMatchObject({ format: 'png', scale: 1, includeUnranked: false });
    expect(parseOptions({ ...defaults, transparent: true, format: 'jpeg' }).transparent).toBe(false);
    for (const settings of [{ width: 319 }, { width: 2401 }, { scale: 0 }, { scale: 4.1 }, { scale: Infinity }, { format: 'gif' }]) expect(() => parseOptions({ ...defaults, ...settings })).toThrow();
  });
  it('enforces pixel and side limits before allocating the output bitmap', () => {
    expect(outputSize(960, 600, 3)).toEqual({ width: 2880, height: 1800 });
    expect(outputSize(320, 644, .5)).toEqual({ width: 160, height: 322 });
    for (const values of [[3000, 6000, 1], [960, 9000, 1], [NaN, 100, 1], [100, 100, 0]]) expect(() => outputSize(values[0]!, values[1]!, values[2]!)).toThrow();
  });
  it('wraps Japanese, explicit newlines and emoji graphemes without losing text', () => {
    expect(wrapText('日本語\nA B', 20, (value) => value.length * 10)).toEqual(['日本', '語', 'A ', 'B']);
    expect(wrapText('👨‍👩‍👧‍👦あ', 1, () => 2)).toEqual(['👨‍👩‍👧‍👦', 'あ']);
    expect(wrapText('', 100, measure.bind(null, '', 1))).toEqual(['']);
  });
  it('includes only selected content while retaining all ranked cards and original data', () => {
    let project = createProject();
    project = editProject(project, { type: 'item.add', name: '日本語', description: '', tags: [] });
    const id = project.unrankedItemIds[0]!;
    expect(buildLayout(project, defaults, measure).rows.flatMap((row) => row.cards)).toHaveLength(0);
    expect(buildLayout(project, { ...defaults, includeUnranked: true }, measure).rows.flatMap((row) => row.cards)).toHaveLength(1);
    const before = structuredClone(project);
    const withoutTitle = buildLayout(project, { ...defaults, includeTitle: false }, measure);
    expect(withoutTitle.texts).toEqual([]); expect(project).toEqual(before);
    project = editProject(project, { type: 'item.move', id, tierId: project.tiers[0]!.id });
    expect(buildLayout(project, defaults, measure).rows[0]!.cards.map((card) => card.id)).toEqual([id]);
  });
  it('expands long labels and names without truncating user text', () => {
    let project = createProject();
    project = editProject(project, { type: 'item.add', name: '日本語'.repeat(20), description: '', tags: [] });
    const layout = buildLayout(project, { ...defaults, width: 320, includeUnranked: true }, measure);
    expect(layout.rows.at(-1)!.cards[0]!.lines.join('')).toBe('日本語'.repeat(20));
    expect(layout.rows.at(-1)!.height).toBeGreaterThan(200);
    const longTier = { ...createProject(), tiers: [{ ...project.tiers[0]!, name: '長いランク名'.repeat(12) }] };
    const row = buildLayout(longTier, { ...defaults, width: 320 }, measure).rows[0]!;
    expect(row.labelLines.join('')).toBe(longTier.tiers[0]!.name);
    expect(row.height).toBeGreaterThanOrEqual(row.labelLines.length * 28 * 1.5 + 24);
    const empty = { ...createProject(), tiers: [] };
    const blank = buildLayout(empty, { ...defaults, includeTitle: false }, measure);
    expect(blank.height).toBeGreaterThanOrEqual(64);
  });
  it('extends tall tables and breaks print pages without gaps or overlap', () => {
    let project = createProject();
    for (let count = 0; count < 25; count++) project = editProject(project, { type: 'tier.add' });
    const layout = buildLayout(project, defaults, measure);
    expect(layout.height).toBeGreaterThan(3000);
    const slices = printSlices(layout.width, layout.height, layout.breaks);
    expect(slices.length).toBeGreaterThan(1);
    expect(slices.reduce((sum, slice) => sum + slice.height, 0)).toBe(layout.height);
    slices.forEach((slice, index) => { expect(slice.height).toBeGreaterThan(0); if (index) expect(slice.y).toBe(slices[index - 1]!.y + slices[index - 1]!.height); });
  });
  it('preserves image aspect ratios for contain, cover and non-destructive crops', () => {
    expect(imageRect(200, 100, 100, 'contain')).toMatchObject({ dx: 0, dy: 25, dw: 100, dh: 50 });
    expect(imageRect(200, 100, 100, 'cover')).toMatchObject({ dx: -50, dy: 0, dw: 200, dh: 100 });
    expect(imageRect(200, 100, 100, 'contain', { x: .5, y: 0, width: .5, height: 1 })).toMatchObject({ sx: 100, sw: 100, dw: 100, dh: 100 });
  });
  it('keeps Japanese filenames and replaces reserved path characters', () => {
    expect(safeFilename('日本語の 表', 'png')).toBe('日本語の 表.png');
    expect(safeFilename('../A:B? ', 'jpg')).toBe('.._A_B_.jpg');
    expect(safeFilename(' ', 'webp')).toBe('tier-atelier.webp');
  });
});

describe('lightweight URL sharing', () => {
  it('round trips Unicode, styles, placements and unknown keys without mutating the project', () => {
    const project = parseProject({ ...createProject(), title: '日本語 👨‍👩‍👧‍👦 <script>', extension: { note: '保持' } });
    const url = createShareUrl(project, 'https://example.test/sub/tier/?secret=value#old');
    expect(url).toMatch(/^https:\/\/example.test\/sub\/tier\/#tier=/);
    expect(url.length).toBeLessThanOrEqual(MAX_SHARE_URL);
    expect(readShareHash(new URL(url).hash)).toEqual(project);
  });
  it('rejects image references, including hidden backgrounds, and oversized URLs', () => {
    const project = createProject();
    expect(() => createShareUrl({ ...project, style: { ...project.style, backgroundAssetId: 'image' } }, 'https://example.test')).toThrow(/画像/);
    expect(() => createShareUrl({ ...project, description: 'あ'.repeat(8000) }, 'https://example.test')).toThrow(/8,000/);
  });
  it('rejects malformed, future and invalid placement data before import', () => {
    const bad = (project: unknown, version = 1) => `#tier=${btoa(JSON.stringify({ format: 'tier-atelier-url', version, project })).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;
    for (const hash of ['#tier=', '#tier=%3Cscript', '#tier=' + 'a'.repeat(8001), bad({}, 2), bad({ schemaVersion: 99 }), bad({ ...createProject(), title: 'bad', unrankedItemIds: ['missing'] })]) {
      expect(() => readShareHash(hash)).toThrow();
    }
  });
});
