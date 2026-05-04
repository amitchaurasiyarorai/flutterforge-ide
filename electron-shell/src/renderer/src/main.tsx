import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32, background: '#0d0d1a', color: '#e05252',
          fontFamily: 'monospace', fontSize: 13, height: '100vh',
          overflow: 'auto', whiteSpace: 'pre-wrap',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e0d7ff' }}>
            ? Appzillon-New — Render Error
          </div>
          <div style={{ color: '#e05252', marginBottom: 12 }}>
            {this.state.error.message}
          </div>
          <div style={{ color: '#555', fontSize: 11 }}>
            {this.state.error.stack}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 20, padding: '8px 16px', background: '#1e1a33',
              border: '1px solid #7c5cbf', borderRadius: 6, color: '#9d7fe8',
              cursor: 'pointer', fontSize: 12, fontFamily: 'system-ui,sans-serif',
            }}>
            ? Try to recover
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
