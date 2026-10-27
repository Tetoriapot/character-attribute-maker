import { headerText as c } from '../app/headerMessages';
import releases from '../data/releases.json';
import { version } from '../../package.json';
import { toggleTheme, useTheme } from '../features/appearance/theme';
import { Icon } from './Icon';

export function ThemeToggle() {
  const theme = useTheme((state) => state.theme);
  return <button type="button" className="header-tool" onClick={toggleTheme}
    aria-label={c.switchTo(c[theme], c[theme === 'light' ? 'dark' : 'light'])}>
    <Icon name={theme === 'light' ? 'sun' : 'moon'} /><span>{c[theme]}</span>
  </button>;
}

export function ThemeFeedback() {
  const failed = useTheme((state) => state.saveFailed);
  return failed ? <p className="theme-feedback notice-inline" role="status">{c.themeStorageError}</p> : null;
}

export function ReleaseNotes() {
  return <div className="release-notes">
    <p className="release-current">{c.currentVersion}<strong>v{version}</strong></p>
    <p className="field-hint">{c.updateHint}</p>
    {releases.map((release) => <section key={release.version}>
      <h3>v{release.version}<time dateTime={release.date}>{release.date}</time></h3>
      <ul>{release.changes.map((change) => <li key={change}>{change}</li>)}</ul>
    </section>)}
  </div>;
}
