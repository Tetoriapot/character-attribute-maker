export type ID = string;

export interface Tier {
  id: ID;
  name: string;
  background: string;
  foreground: string;
  itemIds: ID[];
  minHeight?: number;
  labelWidth?: number;
  locked?: boolean;
}

export interface Item {
  id: ID;
  assetId: ID | null;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  crop?: Crop | null;
}

export interface Crop { x: number; y: number; width: number; height: number }

export interface Asset {
  id: ID;
  blobKey: ID;
  mimeType: string;
  width: number;
  height: number;
  originalName: string;
}

export interface TierStyle {
  background: string;
  fontFamily: string;
  labelWidth: number;
  itemSize: number;
  gap: number;
  radius: number;
  imageFit: 'cover' | 'contain';
  showItemNames: boolean;
  showImageNames?: boolean;
  showTitle: boolean;
  borderColor: string;
  backgroundMode?: 'solid' | 'gradient' | 'pattern' | 'image';
  backgroundAssetId?: ID | null;
  backgroundSecondary?: string;
  gradientAngle?: number;
  pattern?: 'dots' | 'grid' | 'stripes';
  textColor?: string;
  fontSize?: number;
  labelFontSize?: number;
  padding?: number;
  rowGap?: number;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'double';
  cardBackground?: string;
  cardTextColor?: string;
  shadow?: 'none' | 'soft' | 'hard';
  titleSize?: number;
  titleAlign?: 'left' | 'center' | 'right';
  titleDecoration?: 'none' | 'line' | 'band';
}

export interface Project {
  schemaVersion: 1;
  id: ID;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  tiers: Tier[];
  unrankedItemIds: ID[];
  items: Record<ID, Item>;
  assets: Record<ID, Asset>;
  style: TierStyle;
}

export type Selection = { kind: 'tier' | 'item'; id: ID } | { kind: 'project' | 'design' };
