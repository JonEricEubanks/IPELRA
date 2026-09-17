/**
 * ErrorBoundary.jsx — last-resort catch so a render error in one page can't
 * blank the whole app. Offers a reload; the error goes to the console.
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: 24, textAlign: 'center', background: 'var(--color-bg, #f5f6f8)',
      }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0, color: 'var(--color-text-muted, #555)', maxWidth: 360 }}>
          The page hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: 'var(--color-primary, #1d3461)', color: '#fff', fontWeight: 700, fontSize: 15,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
