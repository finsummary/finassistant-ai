'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

const ToastContext = React.createContext<{
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 max-w-md w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-4 shadow-lg',
              toast.type === 'success' && 'bg-green-50 border-green-200 text-green-800',
              toast.type === 'error' && 'bg-red-50 border-red-200 text-red-800',
              toast.type === 'warning' && 'bg-yellow-50 border-yellow-200 text-yellow-800',
              toast.type === 'info' && 'bg-blue-50 border-blue-200 text-blue-800'
            )}
          >
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
