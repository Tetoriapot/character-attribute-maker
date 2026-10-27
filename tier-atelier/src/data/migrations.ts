import { parseProject } from './schemas';
import { storageText as s } from '../app/storageMessages';

export const CURRENT_SCHEMA_VERSION = 1;
export function migrateProject(value: unknown) {
  if (!value || typeof value !== 'object' || !('schemaVersion' in value)) throw new Error(s.invalidSchema);
  // Add explicit version-to-version transformations here when the project format changes.
  if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error(s.futureVersion);
  return parseProject(value);
}
