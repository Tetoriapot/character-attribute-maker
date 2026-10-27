import { setCacheNameDetails } from 'workbox-core';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision?: string | null }> };
declare const __APP_BUILD_ID__: string;

setCacheNameDetails({ prefix: 'tier-atelier', suffix: self.registration.scope });
// The precache controller removes obsolete entries from this scope's own cache.
// Broad legacy-cache cleanup would also match nested applications on this origin.
precacheAndRoute(self.__WB_MANIFEST);
const scope = new URL(self.registration.scope);
const escapedPath = scope.pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  allowlist: [new RegExp(`^${escapedPath}(?:index\\.html)?(?:\\?.*)?$`)],
}));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port) return;
  if (event.data?.type === 'ATELIER_STATUS') { port.postMessage({ type: 'status', build: __APP_BUILD_ID__ }); return; }
  if (event.data?.type !== 'ATELIER_ACTIVATE') return;
  event.waitUntil((async () => {
    // Updating one tab must not reload another tab or invalidate its unsaved editing session.
    const clients = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter((client) => {
      const url = new URL(client.url);
      return url.origin === scope.origin && (url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`);
    });
    const sourceId = event.source && 'id' in event.source ? event.source.id : undefined;
    if (!sourceId || clients.length !== 1 || clients[0]?.id !== sourceId) { port.postMessage({ type: 'other-tabs' }); return; }
    await self.skipWaiting(); port.postMessage({ type: 'activating' });
  })().catch(() => port.postMessage({ type: 'failed' })));
});
