import { useLayoutEffect, useState } from 'react';
import type { Tier, TierStyle } from '../../data/types';
import { fontFamilies, resolveStyle } from './settings';
import { automaticLabelWidth } from './labelWidth';

export function useLabelWidth(tiers: Tier[], style: TierStyle): number {
  const { labelWidth, labelWidthMode, labelFontSize, fontFamily } = resolveStyle(style);
  const [measured, setMeasured] = useState(labelWidth);
  useLayoutEffect(() => {
    if (labelWidthMode !== 'auto') return;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    let active = true;
    const font = `700 ${labelFontSize}px ${fontFamilies[fontFamily] ?? fontFamily}`;
    const measure = () => {
      if (!active) return;
      ctx.font = font;
      setMeasured(automaticLabelWidth(tiers, (text) => ctx.measureText(text).width));
    };
    measure();
    // Re-measure after fonts load, including fonts supplied by an imported project.
    void document.fonts.load(font, tiers.map((tier) => tier.name).join('')).then(measure, measure);
    document.fonts.addEventListener('loadingdone', measure);
    return () => { active = false; document.fonts.removeEventListener('loadingdone', measure); };
  }, [tiers, labelWidthMode, labelFontSize, fontFamily]);
  return labelWidthMode === 'auto' ? measured : labelWidth;
}
