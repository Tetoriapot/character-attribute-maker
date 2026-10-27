import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import './styles/app.css';
import './styles/design.css';
import './styles/export.css';
import './styles/editing.css';
import './styles/pwa.css';
import { initializePwa } from './features/pwa/client';

initializePwa();
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
