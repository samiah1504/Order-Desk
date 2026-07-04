import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[App Error]', error.message)
    console.error('[Component Stack]', info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#fff', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '340px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#111' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '14px', color: '#555', marginBottom: '6px' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <p style={{ fontSize: '12px', color: '#999', marginBottom: '24px' }}>
              Open browser console for full details
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#000', color: '#fff', padding: '12px 28px',
                borderRadius: '12px', border: 'none', fontWeight: '600',
                fontSize: '14px', cursor: 'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
