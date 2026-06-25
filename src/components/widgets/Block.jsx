import classNames from 'classnames'
import { Play, Music, Film, Tv } from 'lucide-react'

const getIcon = (label) => {
  const lowerLabel = label?.toLowerCase() || ''
  if (lowerLabel.includes('stream')) return Play
  if (lowerLabel.includes('album')) return Music
  if (lowerLabel.includes('movie')) return Film
  if (lowerLabel.includes('tv') || lowerLabel.includes('show')) return Tv
  return null
}

const getLabelText = (label) => {
  const lowerLabel = label?.toLowerCase() || ''
  if (lowerLabel.includes('stream')) return 'Streams'
  if (lowerLabel.includes('album')) return 'Albums'
  if (lowerLabel.includes('movie')) return 'Movies'
  if (lowerLabel.includes('tv') || lowerLabel.includes('show')) return 'TV Shows'
  return label?.replace(/^[^.]+\./, '').replace(/_/g, ' ') || label
}

const formatNumber = (value) => {
  if (value === undefined || value === null) return '-'
  const num = typeof value === 'string' ? parseInt(value, 10) : value
  if (isNaN(num)) return value
  return num.toLocaleString('en-US')
}

export default function Block({ value, label, field }) {
  const Icon = getIcon(label)
  const displayLabel = getLabelText(label)
  const displayValue = formatNumber(value)
  const isLoading = value === undefined

  return (
    <div
      className={classNames(
        'bg-gradient-to-br from-slate-700/40 to-slate-800/40 rounded-lg m-1 flex-1 flex flex-col items-center justify-center text-center p-3 min-w-0',
        'border border-white/5 hover:border-white/10 transition-all duration-200',
        'hover:shadow-lg hover:shadow-primary-500/10 hover:-translate-y-0.5',
        isLoading ? 'animate-pulse' : '',
        'service-block group'
      )}
    >
      {Icon && (
        <div className="mb-1.5 p-1.5 rounded-lg bg-primary-500/10 group-hover:bg-primary-500/20 transition-colors duration-200">
          <Icon className="w-4 h-4 text-primary-400" />
        </div>
      )}
      <div className={classNames(
        'text-xl font-bold mb-0.5',
        isLoading ? 'text-slate-500' : 'text-slate-100',
        'transition-colors duration-200'
      )}>
        {displayValue}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5 leading-tight">
        {displayLabel}
      </div>
    </div>
  )
}

