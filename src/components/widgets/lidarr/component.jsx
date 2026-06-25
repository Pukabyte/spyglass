import { useState, useEffect } from 'react'
import { Music, AlertCircle, Download, RefreshCw, ArrowUpRight, Inbox } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { Progress } from '../../ui/progress'
import { Separator } from '../../ui/separator'
import { cn } from '../../../lib/utils'

const MAX_ITEMS = 5

function statusBorderColor(status) {
  if (!status) return 'border-l-slate-700'
  const s = status.toLowerCase()
  if (s === 'downloading') return 'border-l-emerald-500'
  if (s === 'queued' || s === 'delay') return 'border-l-yellow-500'
  if (s === 'warning' || s === 'failed' || s === 'error') return 'border-l-red-500'
  return 'border-l-slate-600'
}

function QueueItem({ item, widgetUrl, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className={cn(
        'rounded-md border border-slate-800 border-l-2 bg-slate-800/40 px-3 py-2 flex flex-col gap-1',
        statusBorderColor(item.status)
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate leading-tight">{item.title}</p>
          {item.artist && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{item.artist}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.quality && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 border-slate-700 text-slate-400 font-normal">
              {item.quality}
            </Badge>
          )}
          {widgetUrl && (
            <a href={widgetUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-emerald-400 hover:bg-transparent">
                <ArrowUpRight className="w-3 h-3" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {item.progress !== undefined && (
        <div className="flex items-center gap-2">
          <Progress value={item.progress} className="h-1 flex-1 bg-slate-700" indicatorClassName="bg-emerald-500" />
          <span className="text-[10px] text-slate-500 w-7 text-right shrink-0">{Math.round(item.progress)}%</span>
        </div>
      )}

      {item.timeLeft && item.timeLeft !== '00:00:00' && (
        <p className="text-[10px] text-slate-500">{item.timeLeft} left</p>
      )}
    </motion.div>
  )
}

const LidarrWidget = ({ widget, onDelete, onRefresh }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [iconError, setIconError] = useState(false)

  const fetchData = async (isInitial = false, isManual = false) => {
    const _st = Date.now()
    if (isManual) setRefreshing(true)
    try {
      if (isInitial) setLoading(true)
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=lidarr`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch Lidarr data')
      const result = await response.json()
      setData(result.data || result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      if (isManual) {
        const el = Date.now() - _st
        if (el < 500) await new Promise(r => setTimeout(r, 500 - el))
      }
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData(true)
    const interval = setInterval(() => fetchData(false), 30000)
    return () => clearInterval(interval)
  }, [widget.id])

  const queueItems = [...(data?.queueItems || [])].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  const displayedItems = queueItems.slice(0, MAX_ITEMS)
  const overflow = queueItems.length - MAX_ITEMS

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-3 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src="/icons/custom/lidarr.webp" alt="Lidarr" className="w-7 h-7 object-contain" onError={() => setIconError(true)} />
              ) : (
                <Music className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">{widget.title || 'Lidarr'}</p>
              <AnimatePresence mode="wait">
                {!loading && !error && (
                  <motion.div key="badge" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-emerald-700/60 text-emerald-400 bg-emerald-950/40 font-normal mt-0.5">
                      Connected
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {widget.url && (
              <a href={widget.url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800 shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </a>
            )}
            <Button variant="ghost" size="icon" onClick={() => fetchData(false, true)} disabled={loading || refreshing} className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800 shrink-0">
              <RefreshCw className={cn('w-3.5 h-3.5', (loading || refreshing) && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1 flex flex-col gap-3">
        {error ? (
          <div className="text-center py-4">
            <AlertCircle className="w-7 h-7 mx-auto mb-2 text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)} className="mt-2 text-xs text-slate-400 hover:text-slate-100 h-7">Retry</Button>
          </div>
        ) : loading && !data ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-md bg-slate-800" />)}
          </div>
        ) : (
          <>
            {/* Summary badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1 text-xs bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-800">
                <Download className="w-3 h-3 text-emerald-400" />
                Queue: <span className={cn('font-semibold', data?.queue > 0 ? 'text-emerald-300' : 'text-slate-400')}>{data?.queue ?? '—'}</span>
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-800">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                Wanted: <span className={cn('font-semibold', data?.wanted > 0 ? 'text-amber-300' : 'text-slate-400')}>{data?.wanted ?? '—'}</span>
              </Badge>
            </div>

            <Separator className="bg-slate-800" />

            {/* Queue items */}
            {displayedItems.length > 0 ? (
              <div className="space-y-2">
                {displayedItems.map((item, idx) => (
                  <QueueItem key={idx} item={item} widgetUrl={widget.url} index={idx} />
                ))}
                {overflow > 0 && (
                  <p className="text-xs text-slate-500 text-center pt-1">+{overflow} more in queue</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-500">
                <Inbox className="w-8 h-8 opacity-40" />
                <span className="text-sm">No items in queue</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default LidarrWidget
