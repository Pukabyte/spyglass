import { Activity } from 'lucide-react'

const GenericWidget = ({ widget }) => {
  return (
    <div className="glass rounded-xl border border-white/10 overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-gradient-to-r from-slate-500/20 to-slate-600/20 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{widget?.title || widget?.appName || 'Widget'}</h3>
            <span className="text-xs text-slate-400">Loading...</span>
          </div>
        </div>
      </div>
      <div className="p-4 flex-1 flex items-center justify-center">
        <div className="text-center text-slate-500 text-sm">
          <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          <p>Loading widget...</p>
        </div>
      </div>
    </div>
  )
}

export default GenericWidget
