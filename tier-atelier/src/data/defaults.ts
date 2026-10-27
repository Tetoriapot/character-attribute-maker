import type { Project, Tier } from './types';
import { t } from '../app/messages';

export const tierColors = ['#edaaa8', '#efc198', '#ecda98', '#bed3af', '#a9cbd9'];
export function createTier(name = t.newTier, background = '#c9c2e1'): Tier {
  return { id: crypto.randomUUID(), name, background, foreground: '#252c29', itemIds: [], minHeight: 104, locked: false };
}

export function createProject(): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, id: crypto.randomUUID(), title: t.projectDefault, description: '',
    createdAt: now, updatedAt: now,
    tiers: ['S', 'A', 'B', 'C', 'D'].map((name, index) => createTier(name, tierColors[index])),
    unrankedItemIds: [], items: {}, assets: {},
    style: { background: '#ffffff', fontFamily: 'sans-serif', labelWidth: 96, itemSize: 76,
      gap: 8, radius: 8, imageFit: 'contain', showItemNames: true, showTitle: true, borderColor: '#e3e6e2' },
  };
}
