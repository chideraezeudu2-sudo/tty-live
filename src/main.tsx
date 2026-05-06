import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Catch module-level errors
window.onerror = (msg, src, line, col, err) => {
  document.body.style.background = '#000';
  document.body.style.color = '#ff4444';
  document.body.style.fontFamily = 'monospace';
  document.body.style.padding = '2rem';
  document.body.innerHTML = `<h2 style="color:white">tty.live crash</h2><pre>${msg}\n${src}:${line}:${col}\n${err?.stack || ''}</pre>`;
};

window.onunhandledrejection = (e) => {
  document.body.style.background = '#000';
  document.body.style.color = '#ff4444';
  document.body.style.fontFamily = 'monospace';
  document.body.style.padding = '2rem';
  document.body.innerHTML = `<h2 style="color:white">tty.live promise crash</h2><pre>${e.reason?.message || e.reason}\n${e.reason?.stack || ''}</pre>`;
};

class ErrorBoundary extends Component<{children: ReactNode}, {error: string | null}> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error: error?.message || String(error) };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{background:'#000',color:'#ff4444',fontFamily:'monospace',padding:'2rem',minHeight:'100vh'}}>
          <h2 style={{color:'#fff',marginBottom:'1rem'}}>tty.live error</h2>
          <pre style={{whiteSpace:'pre-wrap',fontSize:'13px'}}>{this.state.error}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load App to catch import errors
import('./App.tsx').then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}).catch((err) => {
  document.body.style.background = '#000';
  document.body.style.color = '#ff4444';
  document.body.style.fontFamily = 'monospace';
  document.body.style.padding = '2rem';
  document.body.innerHTML = `<h2 style="color:white">Failed to load App</h2><pre>${err?.message}\n${err?.stack}</pre>`;
});
