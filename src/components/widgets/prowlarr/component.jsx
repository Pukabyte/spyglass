import { useState, useEffect } from 'react'
import { AlertCircle, Search, Database, Download, BarChart3, RefreshCw, ArrowUpRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { cn } from '../../../lib/utils'
import { staggerContainer, staggerItem } from '../../../lib/animations'

const brandColor = {
  text: 'text-amber-400',
}

function StatBox({ icon: Icon, iconColor, label, value }) {
  return (
    <motion.div variants={staggerItem} className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50 flex-1 min-w-[60px] text-center">
      <Icon className={cn('w-3.5 h-3.5 mx-auto mb-1', iconColor)} />
      <div className="text-base font-semibold text-slate-50">{value}</div>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
    </motion.div>
  )
}

export default function ProwlarrWidget({ widget, onDelete, onRefresh }) {
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
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=prowlarr`, { credentials: 'include' })
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

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '—'
    return Number(num).toLocaleString()
  }

  const indexers = Array.isArray(data?.indexer) ? data.indexer : []
  const enabledIndexers = indexers.filter(i => i.enable).length
  const stats = data?.indexerstats || {}

  let totalGrabs = 0, totalQueries = 0, totalFailed = 0
  if (Array.isArray(stats.indexers)) {
    stats.indexers.forEach(s => {
      totalGrabs += s.numberOfGrabs || 0
      totalQueries += s.numberOfQueries || 0
      totalFailed += s.numberOfFailedGrabs || s.numberOfFailedQueries || 0
    })
  } else {
    totalGrabs = stats.grabCount || stats.numberOfGrabs || 0
    totalQueries = stats.queryCount || stats.numberOfQueries || 0
    totalFailed = stats.failedGrabCount || stats.numberOfFailedGrabs || 0
  }

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-3 pb-3 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src="/icons/custom/prowlarr.webp" alt="Prowlarr" className="w-7 h-7 object-contain" onError={() => setIconError(true)} />
              ) : (
                <Search className={cn('w-5 h-5', brandColor.text)} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">{widget.title || 'Prowlarr'}</p>
              <AnimatePresence mode="wait">
                {!loading && !error && (
                  <motion.div key="badge" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-emerald-700/60 text-emerald-400 bg-emerald-950/40 font-normal mt-0.5">
                      Indexer Manager
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => fetchData(false, true)} disabled={loading || refreshing} className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800 shrink-0">
            <RefreshCw className={cn('w-3.5 h-3.5', (loading || refreshing) && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1">
        {error ? (
          <div className="text-center py-4">
            <AlertCircle className="w-7 h-7 mx-auto mb-2 text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)} className="mt-2 text-xs text-slate-400 hover:text-slate-100 h-7">Retry</Button>
          </div>
        ) : loading && !data ? (
          <div className="flex gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="flex-1 h-16 rounded-lg bg-slate-800" />)}</div>
        ) : (
          <motion.div className="flex flex-wrap gap-2" variants={staggerContainer} initial="initial" animate="animate">
            <StatBox icon={Database} iconColor="text-amber-400" label="Indexers" value={`${enabledIndexers}/${indexers.length}`} />
            <StatBox icon={Download} iconColor="text-green-400" label="Grabs" value={formatNumber(totalGrabs)} />
            <StatBox icon={Search} iconColor="text-blue-400" label="Queries" value={formatNumber(totalQueries)} />
            <StatBox icon={BarChart3} iconColor="text-red-400" label="Failed" value={formatNumber(totalFailed)} />
          </motion.div>
        )}
      </CardContent>

      {widget.url && (
        <CardFooter className="p-0 border-t border-slate-800">
          <a href={widget.url} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="ghost" className={cn('w-full h-9 rounded-none text-xs font-medium gap-1.5', brandColor.text, 'hover:text-slate-100 hover:bg-slate-800/60')}>
              Open Prowlarr <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </CardFooter>
      )}
    </Card>
  )
}
