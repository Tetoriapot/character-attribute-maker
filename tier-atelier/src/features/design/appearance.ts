import type { CSSProperties } from 'react';
import type { TierStyle } from '../../data/types';
import { fontFamilies, resolveStyle } from './settings';

export function appearance(style: TierStyle, imageUrl?: string): CSSProperties {
  const s = resolveStyle(style);
  let backgroundImage = 'none', backgroundSize = 'auto';
  if (s.backgroundMode === 'gradient') backgroundImage = `linear-gradient(${s.gradientAngle}deg, ${s.background}, ${s.backgroundSecondary})`;
  if (s.backgroundMode === 'pattern') {
    backgroundSize = '20px 20px';
    backgroundImage = s.pattern === 'dots' ? `radial-gradient(${s.backgroundSecondary} 1.5px, transparent 1.5px)`
      : s.pattern === 'grid' ? `linear-gradient(${s.backgroundSecondary} 1px, transparent 1px), linear-gradient(90deg, ${s.backgroundSecondary} 1px, transparent 1px)`
        : `repeating-linear-gradient(135deg, ${s.backgroundSecondary} 0 2px, transparent 2px 14px)`;
  }
  if (s.backgroundMode === 'image' && imageUrl) { backgroundImage = `url("${imageUrl}")`; backgroundSize = 'cover'; }
  const variables: Record<string, string> = {
    '--design-label': `${s.labelWidth}px`, '--design-item': `${Math.min(200, s.itemSize)}px`,
    '--design-gap': `${Math.min(40, s.gap)}px`, '--design-radius': `${Math.min(40, s.radius)}px`,
    '--design-padding': `${s.padding}px`, '--design-row-gap': `${s.rowGap}px`, '--design-border': s.borderColor,
    '--design-border-width': `${s.borderWidth}px`, '--design-border-style': s.borderStyle,
    '--design-card': s.cardBackground, '--design-card-text': s.cardTextColor, '--design-font-size': `${s.fontSize}px`,
    '--design-label-font': `${s.labelFontSize}px`, '--design-title-size': `${s.titleSize}px`,
    '--design-shadow': s.shadow === 'soft' ? '0 3px 8px #00000026' : s.shadow === 'hard' ? '3px 3px 0 #00000040' : 'none',
  };
  return { ...variables, backgroundColor: s.background, backgroundImage, backgroundSize, backgroundPosition: 'center', color: s.textColor, fontFamily: fontFamilies[s.fontFamily] ?? s.fontFamily };
}
