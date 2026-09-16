import { Component } from 'react';
import { ErrorState } from './ErrorState.jsx';
import { Button } from './Button.jsx';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
    this.reload = this.reload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo?.componentStack);
  }

  reset() {
    this.setState({ error: null });
  }

  reload() {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error == null) {
      return children;
    }

    if (typeof fallback === 'function') {
      return fallback({ error, reset: this.reset });
    }
    if (fallback !== undefined) {
      return fallback;
    }

    return (
      <ErrorState
        title="Something went wrong."
        description={error?.message}
      >
        <Button type="button" variant="secondary" size="md" onClick={this.reload}>
          Reload
        </Button>
      </ErrorState>
    );
  }
}
