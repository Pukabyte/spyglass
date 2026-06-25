import { User, Play } from 'lucide-react'

export default function StreamList({ streams = [] }) {
  if (!streams || streams.length === 0) {
    return null
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <div className="flex items-center space-x-2 mb-2">
        <Play className="w-4 h-4 text-primary-400" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Active Streams
        </h4>
      </div>
      <div className="space-y-2">
        {streams.map((stream, index) => (
          <div
            key={index}
            className="bg-slate-700/30 rounded-lg p-2.5 border border-white/5 hover:border-white/10 transition-colors duration-200"
          >
            <div className="flex items-start space-x-2">
              <div className="p-1.5 rounded bg-primary-500/10 mt-0.5">
                <User className="w-3.5 h-3.5 text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {stream.user}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {stream.title || 'Unknown content'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

