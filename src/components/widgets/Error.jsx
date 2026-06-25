import { AlertCircle } from 'lucide-react'

export default function Error({ service, widget, error }) {
  const errorMessage =
    error?.message || error?.error || error || 'Failed to load widget data'

  return (
    <div className="glass rounded-lg p-4 border border-red-500/30">
      <div className="flex items-center space-x-2 text-red-400">
        <AlertCircle className="w-5 h-5" />
        <div>
          <div className="font-semibold">
            {widget?.title || service?.name || 'Widget Error'}
          </div>
          <div className="text-sm text-red-300 mt-1">{errorMessage}</div>
        </div>
      </div>
    </div>
  )
}

