type IconName = 'plus' | 'grip' | 'up' | 'down' | 'close' | 'copy' | 'trash' | 'lock' | 'text' | 'settings' | 'layers' | 'help' | 'panel' | 'check' | 'arrow' | 'info';
const paths: Record<IconName, string> = {
  plus: 'M12 5v14M5 12h14', grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  up: 'm6 14 6-6 6 6', down: 'm6 10 6 6 6-6', close: 'm6 6 12 12M6 18 18 6',
  copy: 'M9 9h11v11H9zM15 5V3H3v12h2', trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  lock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4', text: 'M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3',
  settings: 'M4 7h16M4 17h16M9 4v6M15 14v6', layers: 'm3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3M12 17h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  panel: 'M3 4h18v16H3zM9 4v16', check: 'm5 12 4 4L19 6', arrow: 'M4 12h16m-6-6 6 6-6 6',
  info: 'M12 10v7M12 7h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'grip' ? 3 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
