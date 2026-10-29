import type { Crop, Project, Tier } from '../../data/types';
import { isItemNameVisible, resolveStyle } from '../design/settings';
import type { ExportOptions } from './options';
import { e } from '../../app/exportMessages';
import { commonLabelWidth } from '../design/labelWidth';

export interface TextBlock { lines: string[]; x: number; y: number; width: number; size: number; weight: number; align: CanvasTextAlign; color: string }
export interface CardLayout { id: string; x: number; y: number; width: number; height: number; lines: string[]; imageSize: number }
export interface RowLayout { tier?: Tier; y: number; height: number; labelWidth: number; labelLines: string[]; cards: CardLayout[] }
export interface ExportLayout { width: number; height: number; padding: number; rows: RowLayout[]; texts: TextBlock[]; breaks: number[] }
export type MeasureText = (text: string, size: number, weight: number) => number;

export function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  const segments = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const { segment } of segments.segment(paragraph)) {
      if (line && measure(line + segment) > maxWidth) { lines.push(line); line = ''; }
      line += segment;
    }
    lines.push(line);
  }
  return lines;
}

export function buildLayout(project: Project, options: ExportOptions, measure: MeasureText): ExportLayout {
  const s = resolveStyle(project.style), padding = s.padding;
  const width = options.width, contentWidth = width - padding * 2;
  const commonWidth = commonLabelWidth(project.tiers, s, (text) => measure(text, s.labelFontSize, 700));
  const hasTitle = project.title.trim().length > 0;
  let y = padding;
  const texts: TextBlock[] = [], rows: RowLayout[] = [], breaks: number[] = [0];
  const addText = (text: string, size: number, weight: number, align: CanvasTextAlign) => {
    const inset = hasTitle && s.titleDecoration === 'band' ? 16 : 0;
    const lines = wrapText(text, contentWidth - inset * 2, (value) => measure(value, size, weight));
    texts.push({ lines, x: padding + inset, y, width: contentWidth - inset * 2, size, weight, align, color: s.textColor });
    y += lines.length * size * 1.5 + 12;
  };
  if (options.includeTitle && (hasTitle || project.description)) {
    if (hasTitle) addText(project.title, s.titleSize, 700, s.titleAlign);
    if (project.description) addText(project.description, 14, 400, s.titleAlign);
    y += 8;
  }
  const addRow = (ids: string[], tier?: Tier) => {
    const labelWidth = tier ? Math.min(s.labelWidthMode === 'auto' ? commonWidth : tier.labelWidth ?? commonWidth, contentWidth * .4) : 0;
    const available = contentWidth - labelWidth - padding * 2;
    const cardWidth = Math.min(s.itemSize, available), border = s.borderWidth;
    // At narrow output widths, borders must leave at least one pixel for the image.
    const inset = Math.min(4 + border, Math.max(0, (cardWidth - 1) / 2));
    const imageSize = Math.max(1, cardWidth - inset * 2);
    const columns = Math.max(1, Math.floor((available + s.gap) / (cardWidth + s.gap)));
    const cards: CardLayout[] = [];
    let cardY = y + padding;
    for (let start = 0; start < ids.length; start += columns) {
      const group = ids.slice(start, start + columns).map((id, column) => {
        const item = project.items[id]!;
        const lines = isItemNameVisible(item, s) ? wrapText(item.name, imageSize, (value) => measure(value, s.fontSize, 400)) : [];
        return { id, x: padding + labelWidth + padding + column * (cardWidth + s.gap), y: cardY, width: cardWidth, height: inset * 2 + imageSize + (lines.length ? 5 + lines.length * s.fontSize * 1.5 : 0), imageSize, lines };
      });
      cards.push(...group);
      cardY += Math.max(...group.map((card) => card.height)) + s.gap;
      breaks.push(cardY - s.gap / 2);
    }
    const labelLines = tier ? wrapText(tier.name, Math.max(1, labelWidth - 16), (value) => measure(value, s.labelFontSize, 700)) : [];
    const height = Math.max(tier?.minHeight ?? 104, labelLines.length * s.labelFontSize * 1.5 + 24, ids.length ? cardY - y - s.gap + padding : padding * 2 + 40);
    rows.push({ tier, y, height, labelWidth, labelLines, cards });
    y += height + s.rowGap;
    breaks.push(y - s.rowGap / 2);
  };
  project.tiers.forEach((tier) => addRow(tier.itemIds, tier));
  if (options.includeUnranked) {
    y += 20;
    addText(e.unranked, 16, 700, 'left');
    addRow(project.unrankedItemIds);
  }
  const height = Math.ceil(Math.max(64, y + padding));
  return { width, height, padding, rows, texts, breaks: [...new Set(breaks.filter((value) => value > 0 && value < height))].sort((a, b) => a - b) };
}

export function imageRect(sourceWidth: number, sourceHeight: number, size: number, fit: 'contain' | 'cover', crop?: Crop | null) {
  const c = crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const sw = sourceWidth * c.width, sh = sourceHeight * c.height;
  const scale = fit === 'cover' ? Math.max(size / sw, size / sh) : Math.min(size / sw, size / sh);
  return { sx: sourceWidth * c.x, sy: sourceHeight * c.y, sw, sh, dx: (size - sw * scale) / 2, dy: (size - sh * scale) / 2, dw: sw * scale, dh: sh * scale };
}

export function printSlices(width: number, height: number, breaks: number[]): { y: number; height: number }[] {
  const pageHeight = Math.max(1, Math.floor(width * 273 / 186)); // A4 minus 12 mm margins.
  const slices = [];
  for (let y = 0; y < height;) {
    const limit = Math.min(height, y + pageHeight);
    const candidates = breaks.filter((value) => value > y + pageHeight * .5 && value <= limit);
    const end = limit === height ? height : Math.floor(candidates.at(-1) ?? limit);
    slices.push({ y, height: end - y }); y = end;
  }
  return slices;
}
