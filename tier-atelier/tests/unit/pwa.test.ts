import { describe, expect, it } from 'vitest';
import { updateBlocker } from '../../src/features/pwa/policy';
import { p } from '../../src/app/pwaMessages';

describe('PWA update barriers', () => {
  const saved = { ready: true, busy: false, draggingId: null, drafts: {} };
  it('allows committed edits to proceed to the save barrier', () => expect(updateBlocker(saved)).toBeNull());
  it('protects unapplied inputs', () => expect(updateBlocker({ ...saved, drafts: { title: true } })).toBe(p.drafts));
  it.each([{ ready: false }, { busy: true }, { draggingId: 'item' }])('protects active operations: %o', (state) => {
    expect(updateBlocker({ ...saved, ...state })).toBe(p.operation);
  });
});
