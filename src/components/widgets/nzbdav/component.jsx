import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, ArrowUpRight, Trash2, Download, CheckCircle2, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Progress } from '../../ui/progress'
import { Skeleton } from '../../ui/skeleton'
import { cn } from '../../../lib/utils'
import { staggerContainer, staggerItem } from '../../../lib/animations'

const brandColor = {
  text: 'text-sky-400',
}

function statusBorderColor(status) {
  if (!status) return 'border-l-slate-600'
  const s = status.toLowerCase()
  if (s === 'downloading') return 'border-l-blue-500'
  if (s === 'queued') return 'border-l-slate-500'
  if (s === 'paused') return 'border-l-orange-500'
  return 'border-l-slate-600'
}

function historyStatusBadge(status) {
  if (!status) return { label: status, className: 'text-slate-400 border-slate-600' }
  const s = status.toLowerCase()
  if (s === 'completed') return { label: 'Completed', className: 'text-green-400 border-green-400/30' }
  if (s === 'failed') return { label: 'Failed', className: 'text-red-400 border-red-400/30' }
  return { label: status, className: 'text-slate-400 border-slate-600' }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const b = Number(bytes)
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${b} B`
}

function formatMB(mb) {
  if (!mb) return '0 B'
  const n = Number(mb)
  if (n >= 1024) return `${(n / 1024).toFixed(1)} GB`
  return `${n.toFixed(0)} MB`
}

export default function NzbdavWidget({ widget, onDelete, onRefresh }) {
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
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=nzbdav`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch data')
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

  const handleRefresh = () => {
    fetchData(false, true)
    onRefresh?.()
  }

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-3 pb-3 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src="/icons/custom/nzbdav.webp" alt="NZBDav" className="w-7 h-7 object-contain" onError={() => setIconError(true)} />
              ) : (
                <Download className={cn('w-5 h-5', brandColor.text)} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">{widget.title || 'NZBDav'}</p>
              <AnimatePresence mode="wait">
                {!loading && !error && data && (
                  <motion.div key="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 border-emerald-700/60 text-emerald-400 bg-emerald-950/40 font-normal mt-0.5"
                    >
                      Connected
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!loading && !error && data?.healthUnchecked > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-amber-400 border-amber-400/30">
                {data.healthUnchecked} unchecked
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading || refreshing} className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800">
              <RefreshCw className={cn('w-3.5 h-3.5', (loading || refreshing) && 'animate-spin')} />
            </Button>
            {onDelete && (
              <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-slate-800">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1 space-y-3">
        {error ? (
          <div className="text-center py-4">
            <AlertCircle className="w-7 h-7 mx-auto mb-2 text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)} className="mt-2 text-xs text-slate-400 hover:text-slate-100 h-7">Retry</Button>
          </div>
        ) : loading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-lg bg-slate-800" />
            <Skeleton className="h-12 rounded-lg bg-slate-800" />
          </div>
        ) : data ? (
          <motion.div className="space-y-3" variants={staggerContainer} initial="initial" animate="animate">

            {/* Queue section */}
            <motion.div variants={staggerItem}>
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-3 h-3 text-slate-400" />
                <span className="text-[11px] text-slate-300 font-medium">Queue</span>
                <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', data.queueCount > 0 ? 'text-sky-400 border-sky-400/30' : 'text-slate-500 border-slate-700')}>
                  {data.queueCount}
                </Badge>
              </div>

              {data.queueCount === 0 ? (
                <div className="text-center py-3 text-slate-500 text-xs bg-slate-800/30 rounded-lg border border-slate-700/30">
                  No items in queue
                </div>
              ) : (
                <div className="space-y-2">
                  {(data.queueItems || []).map((item, i) => (
                    <div key={item.id || i} className={cn('bg-slate-800/50 rounded-lg p-2.5 border-l-2 border border-slate-700/50 space-y-1.5', statusBorderColor(item.status))}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] text-slate-200 truncate leading-tight flex-1">{item.name || 'Unknown'}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.category && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 text-slate-400 border-slate-600">{item.category}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Progress value={item.progress || 0} className="h-1 bg-slate-700" />
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{item.progress?.toFixed(0) || 0}%</span>
                          <div className="flex items-center gap-2">
                            {item.timeLeft && item.timeLeft !== '0:00:00' && (
                              <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{item.timeLeft}</span>
                            )}
                            {item.sizeLeft && <span>{formatMB(item.sizeLeft)} left</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent history */}
            {(data.recentHistory || []).length > 0 && (
              <motion.div variants={staggerItem}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-3 h-3 text-slate-400" />
                  <span className="text-[11px] text-slate-300 font-medium">Recent</span>
                </div>
                <div className="space-y-1.5">
                  {(data.recentHistory || []).map((item, i) => {
                    const badge = historyStatusBadge(item.status)
                    return (
                      <div key={i} className="bg-slate-800/40 rounded-lg px-2.5 py-2 border border-slate-700/40 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-300 truncate flex-1">{item.name || 'Unknown'}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.size > 0 && <span className="text-[10px] text-slate-500">{formatBytes(item.size)}</span>}
                          <Badge variant="outline" className={cn('text-[9px] h-4 px-1', badge.className)}>{badge.label}</Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

          </motion.div>
        ) : null}
      </CardContent>

      {widget.url && (
        <CardFooter className="p-0 border-t border-slate-800">
          <a href={widget.url} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="ghost" className={cn('w-full h-9 rounded-none text-xs font-medium gap-1.5', brandColor.text, 'hover:text-slate-100 hover:bg-slate-800/60')}>
              Open NZBDav <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </CardFooter>
      )}
    </Card>
  )
}
