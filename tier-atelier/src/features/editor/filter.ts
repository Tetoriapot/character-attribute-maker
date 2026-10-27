import type { Item, Project } from '../../data/types';

export const normalizeSearch = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja').trim();
export const orderedItemIds = (project: Project) => [...project.tiers.flatMap((tier) => tier.itemIds), ...project.unrankedItemIds];
export function matchesFilter(item: Item, query: string, tags: string[]) {
  const text = normalizeSearch([item.name, item.description, ...item.tags].join(' '));
  const itemTags = new Set(item.tags.map(normalizeSearch));
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every((term) => text.includes(term)) && tags.every((tag) => itemTags.has(normalizeSearch(tag)));
}
export function matchingIds(project: Project, query: string, tags: string[]) { return orderedItemIds(project).filter((id) => matchesFilter(project.items[id]!, query, tags)); }
export function selectableIds(project: Project, ids: string[]) {
  const locked = new Set(project.tiers.filter((tier) => tier.locked).flatMap((tier) => tier.itemIds));
  return ids.filter((id) => !!project.items[id] && !locked.has(id));
}
