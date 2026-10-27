export type ID = string;

export interface Tier {
  id: ID;
  name: string;
  background: string;
  foreground: string;
  itemIds: ID[];
  minHeight?: number;
  locked?: boolean;
}

export interface Item {
  id: ID;
  assetId: ID | null;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
}

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
  showTitle: boolean;
  borderColor: string;
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

export type Selection = { kind: 'tier' | 'item'; id: ID } | { kind: 'project' };
