import { useState, useEffect, useRef } from 'react'
import { Activity, AlertCircle, Box, RefreshCw, ArrowUpRight, X } from 'lucide-react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent, CardFooter } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { cn } from '../../lib/utils'
import { staggerContainer, staggerItem, counterSpring } from '../../lib/animations'

// Centralized widget layout configuration
export const WIDGET_LAYOUT = {
  mode: 'inline',
  gap: 'gap-2',
}

const getLayoutClasses = (itemCount) => {
  switch (WIDGET_LAYOUT.mode) {
    case 'inline':
      return `flex flex-wrap ${WIDGET_LAYOUT.gap}`
    case 'grid-2':
      return `grid grid-cols-2 ${WIDGET_LAYOUT.gap}`
    case 'grid-3':
      return `grid grid-cols-3 ${WIDGET_LAYOUT.gap}`
    case 'grid-4':
      return `grid grid-cols-4 ${WIDGET_LAYOUT.gap}`
    default:
      return `flex flex-wrap ${WIDGET_LAYOUT.gap}`
  }
}

const getItemClasses = (itemCount) => {
  if (WIDGET_LAYOUT.mode === 'inline') {
    return 'flex-1 min-w-[70px]'
  }
  return ''
}

// Flatten API response data into displayable key-value pairs
export function flattenForDisplay(data, prefix = '', depth = 0) {
  const entries = []
  if (!data || typeof data !== 'object') return entries
  if (depth > 2) return entries

  for (const [key, value] of Object.entries(data)) {
    const label = prefix ? `${prefix} ${key}` : key

    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      entries.push({ key: label, value: value.length, type: 'number' })
    } else if (typeof value === 'object') {
      if (value.total !== undefined) {
        entries.push({ key: label, value: value.total, type: 'number' })
      } else if (value.count !== undefined) {
        entries.push({ key: label, value: value.count, type: 'number' })
      } else {
        entries.push(...flattenForDisplay(value, label, depth + 1))
      }
    } else if (typeof value === 'boolean') {
      entries.push({ key: label, value: value ? 'Yes' : 'No', type: 'string' })
    } else {
      const keyLower = label.toLowerCase()
      let type = 'string'
      if (typeof value === 'number') {
        if (keyLower.includes('byte') || keyLower.includes('size') || keyLower.includes('space') || keyLower.includes('disk')) {
          type = 'bytes'
        } else if (keyLower.includes('rate') || keyLower.includes('speed') || keyLower.includes('bandwidth')) {
          type = 'rate'
        } else {
          type = 'number'
        }
      }
      entries.push({ key: label, value, type })
    }
  }
  return entries
}

export const formatRate = (rate) => {
  if (!rate) return '—'
  const r = Number(rate)
  if (r >= 1073741824) return `${(r / 1073741824).toFixed(1)} Gbps`
  if (r >= 1048576) return `${(r / 1048576).toFixed(1)} Mbps`
  if (r >= 1024) return `${(r / 1024).toFixed(0)} Kbps`
  return `${r} bps`
}

export const formatLabel = (key) => key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\./g, ' ').trim()

// Animated number counter using framer-motion spring
function AnimatedNumber({ value, formatter }) {
  const isNumeric = typeof value === 'number' && isFinite(value)
  const spring = useSpring(isNumeric ? value : 0, counterSpring)
  const display = useTransform(spring, (v) => {
    if (!isNumeric) return String(value ?? '—')
    return formatter ? formatter(Math.round(v)) : Math.round(v).toLocaleString()
  })
  const prevValue = useRef(isNumeric ? value : 0)

  useEffect(() => {
    if (isNumeric) {
      spring.set(value)
      prevValue.current = value
    }
  }, [value, spring, isNumeric])

  if (!isNumeric) return <span>{String(value ?? '—')}</span>
  return <motion.span>{display}</motion.span>
}

function StatBox({ label, value, type, formatNumber, formatBytes, itemClass }) {
  let displayValue = value
  let isNumeric = typeof value === 'number' && isFinite(value)

  const formatFn = type === 'bytes'
    ? (v) => formatBytes(v)
    : type === 'rate'
    ? (v) => formatRate(v)
    : type === 'number'
    ? (v) => Number(v).toLocaleString()
    : null

  const rawStringValue = type === 'bytes'
    ? formatBytes(value)
    : type === 'rate'
    ? formatRate(value)
    : type === 'number'
    ? formatNumber(value)
    : String(value ?? '—')

  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        'bg-slate-800/50 rounded-lg p-2 border border-slate-700/50 text-center',
        itemClass
      )}
    >
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
        {formatLabel(label)}
      </div>
      <div className="text-lg font-semibold text-slate-50 leading-tight">
        {isNumeric && (type === 'number' || type === 'bytes' || type === 'rate') ? (
          <AnimatedNumber value={value} formatter={formatFn} />
        ) : (
          rawStringValue
        )}
      </div>
    </motion.div>
  )
}

function AutoDisplay({ data, formatNumber, formatBytes, getItemClasses, getLayoutClasses }) {
  if (!data) return null

  const entries = flattenForDisplay(data).slice(0, 8)
  if (entries.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-4">
        No data available
      </div>
    )
  }

  return (
    <motion.div
      className={getLayoutClasses(entries.length)}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {entries.map(({ key, value, type }) => (
        <StatBox
          key={key}
          label={key}
          value={value}
          type={type}
          formatNumber={formatNumber}
          formatBytes={formatBytes}
          itemClass={getItemClasses(entries.length)}
        />
      ))}
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg bg-slate-800" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-24 bg-slate-800" />
          <Skeleton className="h-3 w-16 bg-slate-800" />
        </div>
      </div>
      {/* Stat boxes skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="flex-1 h-14 rounded-lg bg-slate-800" />
        ))}
      </div>
    </div>
  )
}

const GenericServiceWidget = ({
  widget,
  title,
  icon: Icon = Box,
  endpoint,
  onDelete,
  onRefresh,
  brandColor = {
    gradient: 'from-slate-500/20 to-slate-600/20',
    text: 'text-slate-400',
    bg: 'bg-slate-500/10',
    bgHover: 'hover:bg-slate-500/20',
  },
  fields = [],
  renderData,
  layout,
}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [iconError, setIconError] = useState(false)

  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true)
      else setRefreshing(true)
      const startTime = Date.now()
      const response = await fetch(
        `/api/widgets/${widget.id}/proxy?endpoint=${endpoint || widget.appName?.toLowerCase()}`,
        { credentials: 'include' }
      )
      if (!response.ok) throw new Error(`Failed to fetch data`)
      const result = await response.json()
      setData(result.data || result)
      setError(null)
      // Ensure spinner shows for at least 500ms so user sees feedback
      const elapsed = Date.now() - startTime
      if (!isInitial && elapsed < 500) {
        await new Promise(r => setTimeout(r, 500 - elapsed))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData(true)
    const interval = setInterval(() => fetchData(false), 30000)
    return () => clearInterval(interval)
  }, [widget.id])

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '—'
    return Number(num).toLocaleString()
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '—'
    const b = Number(bytes)
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB`
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
    if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`
    return `${b} B`
  }

  const formatPercent = (value) => {
    if (value === undefined || value === null) return '—'
    return `${parseFloat(value).toFixed(1)}%`
  }

  const getNestedValue = (obj, path) => {
    if (!obj || !path) return undefined
    return path.split('.').reduce((acc, part) => acc?.[part], obj)
  }

  const displayTitle = widget.title || title || widget.appName || 'Service'
  const iconSrc = `/icons/custom/${(widget.appName || title || '').toLowerCase().replace(/[^a-z0-9]/g, '')}.webp`

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      {/* Header */}
      <CardHeader className="px-4 py-2.5 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Icon */}
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img
                  src={iconSrc}
                  alt={displayTitle}
                  className="w-7 h-7 object-contain"
                  onError={() => setIconError(true)}
                />
              ) : (
                <Icon className={cn('w-5 h-5', brandColor.text)} />
              )}
            </div>

            {/* Title + status */}
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">
                {displayTitle}
              </p>
              <AnimatePresence mode="wait">
                {!loading && !error && (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 border-emerald-700/60 text-emerald-400 bg-emerald-950/40 font-normal mt-0.5"
                    >
                      Connected
                    </Badge>
                  </motion.div>
                )}
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 border-red-700/60 text-red-400 bg-red-950/40 font-normal mt-0.5"
                    >
                      Error
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchData(false)}
              disabled={loading || refreshing}
              className="text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <RefreshCw className={cn('w-4 h-4', (loading || refreshing) && 'animate-spin')} />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(widget.id)}
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-4 flex-1">
        <AnimatePresence mode="wait">
          {loading && !data ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <LoadingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-center py-4"
            >
              <AlertCircle className="w-7 h-7 mx-auto mb-2 text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchData(true)}
                className="mt-2 text-xs text-slate-400 hover:text-slate-100 h-7"
              >
                Retry
              </Button>
            </motion.div>
          ) : renderData ? (
            <motion.div
              key="render"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {renderData(data, { formatNumber, formatBytes, formatPercent, getNestedValue, loading })}
            </motion.div>
          ) : fields.length > 0 ? (
            <motion.div
              key="fields"
              className={getLayoutClasses(fields.length)}
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {fields.map((field, idx) => {
                const value = getNestedValue(data, field.key)
                let displayValue = value
                if (field.format === 'number') displayValue = formatNumber(value)
                else if (field.format === 'bytes') displayValue = formatBytes(value)
                else if (field.format === 'percent') displayValue = formatPercent(value)
                else if (value === undefined || value === null) displayValue = '—'

                return (
                  <motion.div
                    key={idx}
                    variants={staggerItem}
                    className={cn(
                      'bg-slate-800/50 rounded-lg p-2 border border-slate-700/50 text-center',
                      getItemClasses(fields.length)
                    )}
                  >
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                      {field.label}
                    </div>
                    <div className="text-lg font-semibold text-slate-50 leading-tight">
                      {displayValue}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : (
            <AutoDisplay
              key="auto"
              data={data}
              formatNumber={formatNumber}
              formatBytes={formatBytes}
              getItemClasses={getItemClasses}
              getLayoutClasses={getLayoutClasses}
            />
          )}
        </AnimatePresence>
      </CardContent>

      {/* Footer */}
      {widget.url && (
        <CardFooter className="p-0 border-t border-slate-800">
          <a
            href={widget.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <Button
              variant="ghost"
              className={cn(
                'w-full h-9 rounded-none text-xs font-medium gap-1.5',
                brandColor.text,
                'hover:text-slate-100 hover:bg-slate-800/60'
              )}
            >
              Open {displayTitle}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </CardFooter>
      )}
    </Card>
  )
}

export default GenericServiceWidget
