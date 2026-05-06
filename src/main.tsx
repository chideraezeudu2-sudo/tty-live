import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{children: ReactNode}, {error: string | null}> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  componentDidCatch(error: any) {
    this.setState({ error: error?.message || String(error) });
  }
  static getDerivedStateFromError(error: any) {
    return { error: error?.message || String(error) };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{background:'#000000',color:'#ff6b6b',fontFamily:'monospace',padding:'2rem',minHeight:'100vh'}}>
          <h2 style={{color:'#fff',marginBottom:'1rem'}}>tty.live — startup error</h2>
          <pre style={{whiteSpace:'pre-wrap',fontSize:'13px'}}>{this.state.error}</pre>
          <p style={{color:'#888',marginTop:'1rem',fontSize:'12px'}}>Please screenshot this and send to support</p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
