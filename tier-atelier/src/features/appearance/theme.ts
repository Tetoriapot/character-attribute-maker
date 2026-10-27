import { create } from 'zustand';

type Theme = 'light' | 'dark';
const storageKey = 'tier-atelier.appearance.v1';
const validTheme = (value: string | null): Theme | null => value === 'light' || value === 'dark' ? value : null;
export const useTheme = create<{ theme: Theme; saveFailed: boolean }>(() => ({ theme: 'light', saveFailed: false }));

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18211e' : '#ffffff');
  useTheme.setState({ theme });
}

let preferred: Theme | null = null;
export function initializeTheme() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  try { preferred = validTheme(localStorage.getItem(storageKey)); } catch { /* Private storage can be unavailable; keep the session usable. */ }
  const applyPreference = () => applyTheme(preferred ?? (media.matches ? 'dark' : 'light'));
  applyPreference();
  media.addEventListener('change', applyPreference);
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    preferred = validTheme(event.newValue);
    useTheme.setState({ saveFailed: false });
    applyPreference();
  });
}

export function toggleTheme() {
  preferred = useTheme.getState().theme === 'light' ? 'dark' : 'light';
  applyTheme(preferred);
  try {
    localStorage.setItem(storageKey, preferred);
    useTheme.setState({ saveFailed: false });
  } catch { useTheme.setState({ saveFailed: true }); }
}
