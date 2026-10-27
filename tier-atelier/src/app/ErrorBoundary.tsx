import { Component, type ReactNode } from 'react';
import { t } from './messages';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal-error" role="alert"><h1>{t.brand}</h1><p>{t.errors.render}</p><button className="button primary" onClick={() => window.location.reload()}>{t.reload}</button></main>;
    return this.props.children;
  }
}
