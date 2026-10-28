import type { Tier, TierStyle } from '../../data/types';
import { resolveStyle } from './settings';

export const MIN_LABEL_WIDTH = 48;
export const MAX_LABEL_WIDTH = 600;

// Reserve the editor's drag handle, padding and lock icon in both editor and output.
export function automaticLabelWidth(tiers: Tier[], measure: (text: string) => number): number {
  return Math.ceil(tiers.reduce((width, tier) => {
    const textWidth = Math.max(...tier.name.replace(/\r\n?/g, '\n').split('\n').map((line) => measure(line.replace(/\t/g, ' '))));
    return Math.max(width, textWidth + 34 + (tier.locked ? 17 : 0));
  }, MIN_LABEL_WIDTH));
}

export function commonLabelWidth(tiers: Tier[], style: TierStyle, measure: (text: string) => number): number {
  return style.labelWidthMode === 'auto' ? automaticLabelWidth(tiers, measure) : resolveStyle(style).labelWidth;
}
