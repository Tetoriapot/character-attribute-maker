import { create } from 'zustand';
import { useEditor } from '../../stores/editorStore';
import { flushSave } from '../storage/session';
import { updateBlocker } from './policy';
import { p } from '../../app/pwaMessages';

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
interface PwaState {
  mode: 'development' | 'unsupported' | 'enabled'; online: boolean; offlineReady: boolean;
  updateAvailable: boolean; dismissed: boolean; checking: boolean; applying: boolean; reloading: boolean;
  error: string; message: string; installPrompt: InstallPrompt | null; installed: boolean;
}
export const usePwa = create<PwaState>(() => ({
  mode: import.meta.env.PROD ? 'enabled' : 'development', online: typeof navigator === 'undefined' || navigator.onLine,
  offlineReady: false, updateAvailable: false, dismissed: false, checking: false, applying: false, reloading: false,
  error: '', message: '', installPrompt: null, installed: false,
}));
let registration: ServiceWorkerRegistration | undefined, registering: Promise<void> | undefined, initialized = false, lastCheck = 0;
const set = usePwa.setState;

function observe(reg: ServiceWorkerRegistration) {
  const refresh = () => {
    set({ offlineReady: reg.active?.state === 'activated', updateAvailable: !!reg.waiting });
    if (reg.waiting) set({ dismissed: false });
  };
  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    let activated = worker.state === 'activated';
    worker.addEventListener('statechange', () => {
      refresh();
      if (worker.state === 'activated') activated = true;
      if (!activated && worker.state === 'redundant') set({ error: reg.active ? p.updateFailed : p.registerFailed });
    });
  };
  watch(reg.installing); watch(reg.waiting); watch(reg.active);
  reg.addEventListener('updatefound', () => { watch(reg.installing); refresh(); }); refresh();
}
export function registerPwa(): Promise<void> {
  if (registering) return registering;
  set({ error: '' });
  registering = (async () => {
    try {
      const base = new URL(import.meta.env.BASE_URL, document.baseURI);
      const existing = await navigator.serviceWorker.getRegistration(base.href);
      if (existing?.scope === base.href) { registration = existing; observe(existing); }
      // A cold offline launch can reject register() even though an installed worker is serving this page.
      if (!navigator.onLine && registration?.active) return;
      const next = await navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname, updateViaCache: 'none' });
      if (registration !== next) { registration = next; observe(next); }
    } catch { set({ error: registration?.active ? p.checkFailed : p.registerFailed }); }
  })().finally(() => { registering = undefined; });
  return registering;
}
export function initializePwa() {
  if (initialized) return; initialized = true;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const installed = () => set({ installed: standalone.matches || ('standalone' in navigator && navigator.standalone === true) });
  standalone.addEventListener('change', installed); installed();
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); set({ installPrompt: event as InstallPrompt }); });
  window.addEventListener('appinstalled', () => set({ installPrompt: null, installed: true, message: p.installedDone }));
  const connection = () => { set({ online: navigator.onLine }); if (navigator.onLine) void checkForUpdate(false); };
  window.addEventListener('online', connection); window.addEventListener('offline', connection);
  if (!import.meta.env.PROD) return;
  if (!window.isSecureContext || !('serviceWorker' in navigator)) { set({ mode: 'unsupported' }); return; }
  void registerPwa();
  window.addEventListener('focus', () => { if (navigator.onLine) void checkForUpdate(false); });
}
export async function checkForUpdate(manual = true) {
  if (usePwa.getState().mode !== 'enabled' || usePwa.getState().checking || usePwa.getState().applying) return;
  if (!navigator.onLine) { if (manual) set({ error: p.noConnection }); return; }
  if (!manual && Date.now() - lastCheck < 60_000) return;
  lastCheck = Date.now(); set({ checking: true, error: '', message: '' });
  try {
    if (!registration) await registerPwa();
    if (!registration) return;
    await registration.update();
    if (registration.waiting) set({ updateAvailable: true, dismissed: false });
    else if (!registration.installing && manual) set({ message: p.latest });
  } catch { if (manual) set({ error: p.checkFailed }); }
  finally { set({ checking: false }); }
}
function activate(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error?: string) => { clearTimeout(timeout); channel.port1.close(); worker.removeEventListener('statechange', changed); if (error) reject(new Error(error)); else resolve(); };
    const changed = () => { if (worker.state === 'activated') finish(); else if (worker.state === 'redundant') finish(p.updateFailed); };
    const timeout = window.setTimeout(() => finish(p.updateFailed), 15_000);
    channel.port1.onmessage = (event: MessageEvent<{ type: string }>) => {
      if (event.data.type === 'other-tabs') finish(p.otherTabs);
      else if (event.data.type === 'failed') finish(p.updateFailed);
      else if (event.data.type === 'activating') changed();
    };
    worker.addEventListener('statechange', changed);
    worker.postMessage({ type: 'ATELIER_ACTIVATE' }, [channel.port2]);
  });
}
export async function applyUpdate() {
  if (usePwa.getState().applying) return;
  const blocker = updateBlocker(useEditor.getState());
  if (blocker) { set({ error: blocker }); return; }
  const waiting = registration?.waiting;
  if (!waiting) { set({ error: p.checkFailed, updateAvailable: false }); return; }
  set({ applying: true, error: '', message: '' }); useEditor.setState({ busy: true });
  try {
    try { await flushSave(); } catch { throw new Error(p.saveFailed); }
    await activate(waiting);
    set({ reloading: true }); window.location.reload();
  } catch (error) { set({ error: error instanceof Error ? error.message : p.updateFailed }); }
  finally { if (!usePwa.getState().reloading) { set({ applying: false }); useEditor.setState({ busy: false }); } }
}
export async function installPwa() {
  const prompt = usePwa.getState().installPrompt; if (!prompt) return;
  set({ installPrompt: null, error: '', message: '' });
  try { await prompt.prompt(); const result = await prompt.userChoice; set({ message: result.outcome === 'accepted' ? p.installRequested : p.installCanceled }); }
  catch { set({ error: p.installFailed }); }
}
