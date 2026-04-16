import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    this.props.onError?.(error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <p className="text-white font-medium mb-2">오류가 발생했습니다</p>
          <p className="text-zinc-400 text-sm mb-4">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
