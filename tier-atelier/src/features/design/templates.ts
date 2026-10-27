import { z } from 'zod';
import themeData from '../../data/themes/themes.json';
import rankData from '../../data/themes/ranks.json';
import { editedStyleSchema } from '../../data/schemas';
import { designDefaults } from './settings';

const paletteSchema = z.object({ id: z.string().min(1), name: z.string().min(1), colors: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(1), foreground: z.string().regex(/^#[0-9a-f]{6}$/i) });
export const themes = themeData.map((entry) => ({ ...paletteSchema.parse(entry), style: editedStyleSchema.parse({ ...designDefaults, ...entry.style, cardTextColor: entry.style.textColor ?? designDefaults.cardTextColor }) }));
export const rankPresets = rankData.map((entry) => paletteSchema.parse(entry));
