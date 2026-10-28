import { describe, expect, it } from 'vitest';
import { createProject, createTier } from '../../src/data/defaults';
import { parseProject } from '../../src/data/schemas';
import { automaticLabelWidth } from '../../src/features/design/labelWidth';
import { resolveStyle } from '../../src/features/design/settings';
import { editProject } from '../../src/features/editor/commands';
import { buildLayout } from '../../src/features/export/layout';
import { defaultExportOptions } from '../../src/features/export/options';

describe('rank label widths', () => {
  it('uses rendered width rather than character count, including locks and multiline names', () => {
    const measure = (text: string) => Array.from(text).reduce((n, c) => n + (c === 'W' ? 30 : 5), 0);
    expect(automaticLabelWidth([createTier('iiiiiiii'), createTier('WW')], measure)).toBe(94);
    expect(automaticLabelWidth([{ ...createTier('WW\niiii'), locked: true }], measure)).toBe(111);
    expect(automaticLabelWidth([], measure)).toBe(48);
  });
  it('keeps old common and individual widths, applies auto to every row and restores manual widths', () => {
    const project = createProject(); project.tiers[0]!.labelWidth = 140; project.tiers[1]!.name = '長い名前';
    const measure = (text: string, size: number) => text.length * size;
    expect(resolveStyle(project.style).labelWidthMode).toBe('manual');
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
    expect(buildLayout(project, defaultExportOptions, measure).rows.map((row) => row.labelWidth)).toEqual([140, 96, 96, 96, 96]);
    const auto = editProject(project, { type: 'design.update', style: { labelWidthMode: 'auto' } });
    const rows = buildLayout(auto, defaultExportOptions, measure).rows;
    expect(rows.map((row) => row.labelWidth)).toEqual([146, 146, 146, 146, 146]);
    expect(rows[1]!.labelLines).toEqual(['長い名前']);
    expect(auto.tiers).toEqual(project.tiers); expect(auto.style.labelWidth).toBe(96);
    const manual = editProject(auto, { type: 'design.update', style: { labelWidthMode: 'manual', labelWidth: 300 } });
    expect(buildLayout(manual, defaultExportOptions, measure).rows.map((row) => row.labelWidth)).toEqual([140, 300, 300, 300, 300]);
    for (const scope of ['all', 'ranks', 'cards'] as const) expect(editProject(auto, { type: 'design.theme', id: 'cyber', scope }).style.labelWidthMode).toBe('auto');
  });
  it('reflows narrow exports, handles deletion and preserves every character', () => {
    const project = createProject(); project.style.labelWidthMode = 'auto'; project.style.labelFontSize = 64;
    project.tiers[0]!.name = '長い名前'.repeat(20);
    const measure = (text: string, size: number) => text.length * size;
    const rows = buildLayout(project, { ...defaultExportOptions, width: 320 }, measure).rows;
    expect(new Set(rows.map((row) => row.labelWidth)).size).toBe(1);
    expect(rows[0]!.labelWidth).toBeLessThan(128); expect(rows[0]!.labelLines.join('')).toBe(project.tiers[0]!.name);
    const shorter = editProject(project, { type: 'tier.delete', id: project.tiers[0]!.id });
    expect(buildLayout(shorter, defaultExportOptions, measure).rows[0]!.labelWidth).toBe(98);
  });
  it('validates widths atomically and retains optional settings through JSON', () => {
    const project = createProject(), tier = project.tiers[0]!;
    const updated = editProject(project, { type: 'tier.update', ...tier, name: 'とても儚い', labelWidth: 500, labelSizing: { labelWidthMode: 'auto', labelWidth: 600 } });
    expect(updated.style).toMatchObject({ labelWidthMode: 'auto', labelWidth: 600 });
    expect(updated.tiers[0]).toMatchObject({ name: 'とても儚い', labelWidth: 500 });
    expect(parseProject(JSON.parse(JSON.stringify(updated)))).toEqual(updated);
    for (const labelWidth of [47, 601, NaN, Infinity]) {
      expect(() => editProject(project, { type: 'tier.update', ...tier, name: '変更しない', labelSizing: { labelWidthMode: 'auto', labelWidth } })).toThrow();
      expect(() => editProject(project, { type: 'design.update', style: { labelWidth } })).toThrow();
    }
    expect(project.tiers[0]!.name).toBe('S');
    expect(() => parseProject({ ...project, style: { ...project.style, labelWidthMode: 'invalid' } })).toThrow();
  });
});
