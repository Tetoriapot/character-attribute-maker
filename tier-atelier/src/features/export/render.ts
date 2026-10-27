import type { StoredBlob } from '../../data/db';
import type { Item, Project } from '../../data/types';
import { e } from '../../app/exportMessages';
import { fontFamilies, resolveStyle } from '../design/settings';
import { buildLayout, imageRect, type CardLayout, type ExportLayout, type TextBlock } from './layout';
import { outputSize, parseOptions, type ExportOptions } from './options';

export interface RenderedImage { blob: Blob; canvas: HTMLCanvasElement; layout: ExportLayout; width: number; height: number; options: ExportOptions }
export function encodeCanvas(canvas: HTMLCanvasElement, format: ExportOptions['format']): Promise<Blob> {
  const mime = `image/${format}`;
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob) reject(new Error(e.renderError));
    else if (blob.type !== mime) reject(new Error(e.unsupported));
    else resolve(blob);
  }, mime, .95));
}
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, Math.max(0, Math.min(radius, width / 2, height / 2)));
}
function assertActive(signal?: AbortSignal) { signal?.throwIfAborted(); }

export async function renderProject(project: Project, records: Map<string, StoredBlob>, input: ExportOptions, signal?: AbortSignal): Promise<RenderedImage> {
  const options = parseOptions(input), s = resolveStyle(project.style);
  const font = fontFamilies[s.fontFamily] ?? s.fontFamily;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(e.renderError);
  try {
    try {
      const sample = [...new Set(Array.from(project.title + project.description + project.tiers.map((tier) => tier.name).join('') + Object.values(project.items).map((item) => item.name).join('')))].join('');
      await Promise.all([document.fonts.load(`400 ${s.fontSize}px ${font}`, sample), document.fonts.load(`700 ${s.titleSize}px ${font}`, sample)]);
      await document.fonts.ready;
    } catch { throw new Error(e.fontError); }
    assertActive(signal);
    const measure = (text: string, size: number, weight: number) => { ctx.font = `${weight} ${size}px ${font}`; return ctx.measureText(text).width; };
    const layout = buildLayout(project, options, measure);
    const size = outputSize(layout.width, layout.height, options.scale);
    canvas.width = size.width; canvas.height = size.height;
    ctx.scale(options.scale, options.scale); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const withImage = async (assetId: string, draw: (image: ImageBitmap) => void) => {
      assertActive(signal);
      const asset = project.assets[assetId], record = asset ? records.get(asset.blobKey) : undefined;
      if (!record) throw new Error(e.missingImage);
      let bitmap: ImageBitmap;
      try { bitmap = await createImageBitmap(record.blob); } catch { throw new Error(e.missingImage); }
      try { assertActive(signal); draw(bitmap); } finally { bitmap.close(); }
    };
    if (!options.transparent) {
      // Flatten even transparent source backgrounds onto a defined color, including JPEG.
      ctx.fillStyle = s.background; ctx.fillRect(0, 0, size.width / options.scale, size.height / options.scale);
      if (s.backgroundMode === 'gradient') {
        const angle = s.gradientAngle * Math.PI / 180, dx = Math.sin(angle), dy = -Math.cos(angle);
        const distance = Math.abs(layout.width * dx) + Math.abs(layout.height * dy);
        const gradient = ctx.createLinearGradient(layout.width / 2 - dx * distance / 2, layout.height / 2 - dy * distance / 2, layout.width / 2 + dx * distance / 2, layout.height / 2 + dy * distance / 2);
        gradient.addColorStop(0, s.background); gradient.addColorStop(1, s.backgroundSecondary); ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, layout.width, layout.height);
      }
      if (s.backgroundMode === 'pattern') {
        const tile = document.createElement('canvas'); tile.width = tile.height = 20;
        const pattern = tile.getContext('2d')!; pattern.strokeStyle = pattern.fillStyle = s.backgroundSecondary;
        if (s.pattern === 'dots') { pattern.beginPath(); pattern.arc(10, 10, 1.5, 0, Math.PI * 2); pattern.fill(); }
        else if (s.pattern === 'grid') { pattern.fillRect(0, 0, 20, 1); pattern.fillRect(0, 0, 1, 20); }
        else { pattern.lineWidth = 2; for (const offset of [-20, 0, 20]) { pattern.beginPath(); pattern.moveTo(offset, 20); pattern.lineTo(offset + 20, 0); pattern.stroke(); } }
        ctx.fillStyle = ctx.createPattern(tile, 'repeat')!; ctx.fillRect(0, 0, layout.width, layout.height);
      }
      if (s.backgroundMode === 'image' && s.backgroundAssetId) await withImage(s.backgroundAssetId, (image) => {
        const ratio = Math.max(layout.width / image.width, layout.height / image.height);
        ctx.drawImage(image, (layout.width - image.width * ratio) / 2, (layout.height - image.height * ratio) / 2, image.width * ratio, image.height * ratio);
      });
    }
    const drawText = (block: TextBlock) => {
      ctx.fillStyle = block.color; ctx.font = `${block.weight} ${block.size}px ${font}`; ctx.textAlign = block.align; ctx.textBaseline = 'top';
      const x = block.x + (block.align === 'center' ? block.width / 2 : block.align === 'right' ? block.width : 0);
      block.lines.forEach((line, index) => ctx.fillText(line, x, block.y + index * block.size * 1.5, Math.max(1, block.width)));
    };
    if (options.includeTitle && layout.texts[0]) {
      const title = layout.texts[0], height = title.lines.length * title.size * 1.5;
      ctx.fillStyle = s.textColor;
      if (s.titleDecoration === 'line') ctx.fillRect(layout.padding, title.y + height + 3, layout.width - 2 * layout.padding, 2);
      if (s.titleDecoration === 'band') {
        ctx.fillStyle = '#80808020'; ctx.fillRect(layout.padding, title.y, layout.width - 2 * layout.padding, height + 6);
        ctx.fillStyle = s.textColor; ctx.fillRect(layout.padding, title.y, 5, height + 6);
      }
    }
    layout.texts.forEach(drawText);
    const imageCards = new Map<string, { card: CardLayout; item: Item }[]>();
    for (const row of layout.rows) {
      assertActive(signal);
      if (row.tier) {
        ctx.fillStyle = row.tier.background; ctx.fillRect(layout.padding, row.y, row.labelWidth, row.height);
        drawText({ lines: row.labelLines, x: layout.padding + 8, y: row.y + (row.height - row.labelLines.length * s.labelFontSize * 1.5) / 2, width: row.labelWidth - 16, size: s.labelFontSize, weight: 700, align: 'center', color: row.tier.foreground });
      }
      ctx.strokeStyle = '#80808070'; ctx.lineWidth = 1; ctx.strokeRect(layout.padding + .5, row.y + .5, layout.width - layout.padding * 2 - 1, row.height - 1);
      for (const card of row.cards) {
        const item = project.items[card.id]!;
        ctx.save(); rounded(ctx, card.x, card.y, card.width, card.height, s.radius);
        if (s.shadow !== 'none') { ctx.shadowColor = s.shadow === 'soft' ? '#00000026' : '#00000040'; ctx.shadowBlur = s.shadow === 'soft' ? 8 : 0; ctx.shadowOffsetX = s.shadow === 'hard' ? 3 : 0; ctx.shadowOffsetY = 3; }
        ctx.fillStyle = s.cardBackground; ctx.fill(); ctx.restore();
        if (s.borderWidth > 0) {
          ctx.save(); ctx.strokeStyle = s.borderColor; ctx.lineWidth = s.borderWidth;
          if (s.borderStyle === 'dashed') ctx.setLineDash([s.borderWidth * 3, s.borderWidth * 2]);
          const stroke = (inset: number) => { rounded(ctx, card.x + inset, card.y + inset, card.width - inset * 2, card.height - inset * 2, Math.max(0, s.radius - inset)); ctx.stroke(); };
          if (s.borderStyle === 'double' && s.borderWidth >= 3) { ctx.lineWidth = s.borderWidth / 3; stroke(ctx.lineWidth / 2); stroke(s.borderWidth - ctx.lineWidth / 2); }
          else stroke(Math.min(s.borderWidth / 2, card.width / 2));
          ctx.restore();
        }
        const inset = (card.width - card.imageSize) / 2;
        if (item.assetId) {
          const group = imageCards.get(item.assetId) ?? []; group.push({ card, item }); imageCards.set(item.assetId, group);
        } else {
          const size = Math.min(32, card.imageSize / 1.5);
          const initial = new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(item.name)[Symbol.iterator]().next().value?.segment ?? '';
          drawText({ lines: [initial], x: card.x + inset, y: card.y + inset + (card.imageSize - size * 1.5) / 2, width: card.imageSize, size, weight: 700, align: 'center', color: s.cardTextColor });
        }
        if (card.lines.length) drawText({ lines: card.lines, x: card.x + inset, y: card.y + inset + card.imageSize + 5, width: card.imageSize, size: s.fontSize, weight: 400, align: 'center', color: s.cardTextColor });
      }
    }
    // Decode one original at a time, then release it. Shared assets are decoded once per output.
    for (const [assetId, cards] of imageCards) await withImage(assetId, (image) => {
      for (const { card, item } of cards) {
        const inset = (card.width - card.imageSize) / 2;
        const r = imageRect(image.width, image.height, card.imageSize, s.imageFit, item.crop);
        ctx.save(); rounded(ctx, card.x + inset, card.y + inset, card.imageSize, card.imageSize, Math.max(0, s.radius - inset)); ctx.clip();
        ctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, card.x + inset + r.dx, card.y + inset + r.dy, r.dw, r.dh); ctx.restore();
      }
    });
    assertActive(signal);
    const blob = await encodeCanvas(canvas, options.format);
    assertActive(signal);
    return { blob, canvas, layout, ...size, options };
  } catch (error) { canvas.width = canvas.height = 1; throw error; }
}
