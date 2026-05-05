import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query'
import { router } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// 저장된 UI 줌 레벨 즉시 적용 (레이아웃 시프트 방지)
const savedZoom = localStorage.getItem('oomni-ui-zoom')
if (savedZoom) document.documentElement.style.setProperty('--ui-zoom', savedZoom)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
