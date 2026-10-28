import type { Item, TierStyle } from '../../data/types';

export const designDefaults: Required<TierStyle> = {
  background: '#ffffff', fontFamily: 'sans-serif', labelWidth: 96, labelWidthMode: 'manual', itemSize: 76, gap: 8, radius: 8,
  imageFit: 'contain', showItemNames: true, showImageNames: true, showTitle: true, borderColor: '#e3e6e2',
  backgroundMode: 'solid', backgroundAssetId: null, backgroundSecondary: '#e2ece7', gradientAngle: 135, pattern: 'dots',
  textColor: '#252c29', fontSize: 11, labelFontSize: 28, padding: 12, rowGap: 0, borderWidth: 1,
  borderStyle: 'solid', cardBackground: '#ffffff', cardTextColor: '#252c29', shadow: 'soft', titleSize: 28, titleAlign: 'left', titleDecoration: 'none',
};
export const resolveStyle = (style: TierStyle): Required<TierStyle> => ({ ...designDefaults, ...style });
export const isItemNameVisible = (item: Item, style: TierStyle): boolean => style.showItemNames && (!item.assetId || style.showImageNames !== false);
export const fontFamilies: Record<string, string> = {
  'sans-serif': '"Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',
  serif: '"Yu Mincho", "Hiragino Mincho ProN", serif',
  monospace: '"Cascadia Mono", "MS Gothic", monospace',
  rounded: '"Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif',
};
export type ThemeScope = 'all' | 'ranks' | 'cards';
export const rankKeys = ['labelWidth', 'labelFontSize', 'rowGap'] as const;
export const cardKeys = ['itemSize', 'gap', 'radius', 'imageFit', 'showItemNames', 'fontSize', 'cardBackground', 'cardTextColor', 'shadow', 'borderColor', 'borderWidth', 'borderStyle'] as const;
