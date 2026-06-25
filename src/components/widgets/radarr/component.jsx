import { useState, useEffect, useCallback, useRef } from 'react'
import { Film, AlertCircle, Download, HardDrive, RefreshCw, ArrowUpRight, Inbox, Search, Plus, Trash2, RotateCcw, Ban, ChevronDown, ChevronUp, Clock, Info, Loader2, Check, X, AlertTriangle, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { Progress } from '../../ui/progress'
import { Input } from '../../ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs'
import { ScrollArea } from '../../ui/scroll-area'
import { cn } from '../../../lib/utils'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function statusColor(status, trackedStatus) {
  if (trackedStatus === 'error' || status === 'failed') return { border: 'border-l-red-500', bg: 'bg-red-500/10', text: 'text-red-400', badge: 'border-red-700/60 text-red-400 bg-red-950/40' }
  if (trackedStatus === 'warning' || status === 'warning') return { border: 'border-l-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', badge: 'border-amber-700/60 text-amber-400 bg-amber-950/40' }
  if (status === 'downloading') return { border: 'border-l-yellow-500', bg: '', text: 'text-yellow-400', badge: 'border-yellow-700/60 text-yellow-400 bg-yellow-950/40' }
  if (status === 'queued' || status === 'delay') return { border: 'border-l-slate-500', bg: '', text: 'text-slate-400', badge: 'border-slate-700 text-slate-400 bg-slate-800' }
  if (status === 'completed') return { border: 'border-l-emerald-500', bg: '', text: 'text-emerald-400', badge: 'border-emerald-700/60 text-emerald-400 bg-emerald-950/40' }
  return { border: 'border-l-slate-600', bg: '', text: 'text-slate-400', badge: 'border-slate-700 text-slate-400 bg-slate-800' }
}

function QueueItem({ item, widgetId, onRefreshData }) {
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const colors = statusColor(item.status, item.trackedDownloadStatus)
  const isStuck = item.trackedDownloadStatus === 'warning' || item.trackedDownloadStatus === 'error' || item.status === 'failed'

  const doAction = async (action, params = {}) => {
    setActing(action)
    try {
      const res = await fetch(`/api/widgets/${widgetId}/action`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { id: item.id, ...params } })
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      onRefreshData()
    } catch (err) {
      console.error(`Action ${action} failed:`, err)
    } finally {
      setActing(null)
      setConfirmAction(null)
    }
  }

  const statusMessages = (item.statusMessages || []).flatMap(m =>
    [m.title, ...(m.messages || [])].filter(Boolean)
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn(
        'rounded-md border border-slate-800 border-l-2 bg-slate-800/40 px-3 py-2 flex flex-col gap-1',
        colors.border, isStuck && colors.bg
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate leading-tight">
            {item.title}{item.year ? <span className="text-slate-400 font-normal ml-1">({item.year})</span> : null}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge variant="outline" className={cn('text-[10px] h-4 px-1 font-normal', colors.badge)}>
              {item.trackedDownloadState || item.status}
            </Badge>
            {item.quality && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 border-slate-700 text-slate-400 font-normal">
                {item.quality}
              </Badge>
            )}
            {item.protocol && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 border-slate-700 text-slate-500 font-normal">
                {item.protocol}
              </Badge>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {item.progress !== undefined && (
        <div className="flex items-center gap-2">
          <Progress value={item.progress} className="h-1 flex-1 bg-slate-700" indicatorClassName="bg-yellow-500" />
          <span className="text-[10px] text-slate-500 w-7 text-right shrink-0">{item.progress}%</span>
        </div>
      )}

      {item.timeLeft && item.timeLeft !== '00:00:00' && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Clock className="w-2.5 h-2.5" /> {item.timeLeft} left
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pt-1.5 mt-1 border-t border-slate-700/50 space-y-1.5">
              {/* Details */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                {item.size > 0 && (
                  <>
                    <span className="text-slate-500">Size</span>
                    <span className="text-slate-300">{formatBytes(item.size)}{item.sizeleft > 0 ? ` (${formatBytes(item.sizeleft)} left)` : ''}</span>
                  </>
                )}
                {item.downloadClient && (
                  <>
                    <span className="text-slate-500">Client</span>
                    <span className="text-slate-300">{item.downloadClient}</span>
                  </>
                )}
                {item.indexer && (
                  <>
                    <span className="text-slate-500">Indexer</span>
                    <span className="text-slate-300">{item.indexer}</span>
                  </>
                )}
                {item.outputPath && (
                  <>
                    <span className="text-slate-500">Path</span>
                    <span className="text-slate-300 truncate" title={item.outputPath}>{item.outputPath}</span>
                  </>
                )}
              </div>

              {/* Error/warning messages */}
              {(item.errorMessage || statusMessages.length > 0) && (
                <div className={cn('rounded px-2 py-1.5 text-[10px] space-y-0.5', isStuck ? 'bg-red-950/30 border border-red-900/40' : 'bg-slate-800/60')}>
                  {item.errorMessage && (
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-red-300">{item.errorMessage}</span>
                    </div>
                  )}
                  {statusMessages.map((msg, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Info className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-amber-200/80">{msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 pt-0.5">
                {confirmAction ? (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400">
                      {confirmAction === 'queue.remove' ? 'Remove?' : 'Blocklist?'}
                    </span>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => doAction(confirmAction, confirmAction === 'queue.remove' ? { removeFromClient: true } : { removeFromClient: true, blocklist: true })}
                      disabled={!!acting}
                      className="h-5 px-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/40"
                    >
                      {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Yes
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)} className="h-5 px-1.5 text-[10px] text-slate-400 hover:text-slate-300">
                      <X className="w-3 h-3" /> No
                    </Button>
                  </div>
                ) : (
                  <>
                    {(item.status === 'delay' || item.trackedDownloadState === 'failedPending') && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => doAction('queue.grab')}
                        disabled={!!acting}
                        className="h-5 px-1.5 text-[10px] gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40"
                      >
                        {acting === 'queue.grab' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        Grab
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setConfirmAction('queue.remove')}
                      className="h-5 px-1.5 text-[10px] gap-1 text-slate-400 hover:text-red-400 hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setConfirmAction('queue.blocklist')}
                      className="h-5 px-1.5 text-[10px] gap-1 text-slate-400 hover:text-amber-400 hover:bg-amber-950/40"
                    >
                      <Ban className="w-3 h-3" /> Blocklist
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AddMoviePanel({ widgetId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [rootFolders, setRootFolders] = useState([])
  const [addingId, setAddingId] = useState(null)
  const [addedIds, setAddedIds] = useState(new Set())
  const [error, setError] = useState(null)
  const searchTimeout = useRef(null)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const [pRes, rRes] = await Promise.all([
          fetch(`/api/widgets/${widgetId}/action`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'qualityProfiles' }) }),
          fetch(`/api/widgets/${widgetId}/action`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rootFolders' }) })
        ])
        if (pRes.ok) { const d = await pRes.json(); setProfiles(d.data || []) }
        if (rRes.ok) { const d = await rRes.json(); setRootFolders(d.data || []) }
      } catch (e) { console.error('Failed to fetch config:', e) }
    }
    fetchConfig()
  }, [widgetId])

  const doSearch = useCallback(async (term) => {
    if (!term || term.length < 2) { setResults([]); return }
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/widgets/${widgetId}/action`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lookup', params: { term } })
      })
      if (!res.ok) throw new Error('Search failed')
      const d = await res.json()
      setResults(d.data || [])
    } catch (e) {
      setError(e.message)
    } finally { setSearching(false) }
  }, [widgetId])

  const onInput = (val) => {
    setQuery(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => doSearch(val), 400)
  }

  const addMovie = async (movie) => {
    if (!profiles.length || !rootFolders.length) return
    setAddingId(movie.tmdbId)
    try {
      const res = await fetch(`/api/widgets/${widgetId}/action`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          params: {
            tmdbId: movie.tmdbId,
            title: movie.title,
            qualityProfileId: profiles[0].id,
            rootFolderPath: rootFolders[0].path,
            monitored: true,
            searchForMovie: true,
          }
        })
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to add') }
      setAddedIds(prev => new Set(prev).add(movie.tmdbId))
    } catch (e) {
      setError(e.message)
    } finally { setAddingId(null) }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => onInput(e.target.value)}
          placeholder="Search movies..."
          className="pl-8 h-8 text-sm bg-slate-800/60 border-slate-700"
        />
        {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
      </div>

      {error && (
        <div className="text-[11px] text-red-400 px-1">{error}</div>
      )}

      <ScrollArea className="h-[260px]">
        <div className="space-y-1.5">
          {results.length === 0 && !searching && query.length >= 2 && (
            <p className="text-xs text-slate-500 text-center py-6">No results found</p>
          )}
          {results.length === 0 && !searching && query.length < 2 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
              <Search className="w-8 h-8 opacity-30" />
              <span className="text-xs">Search for a movie to add</span>
            </div>
          )}
          {results.map((movie) => {
            const isAdded = movie.existsInLibrary || addedIds.has(movie.tmdbId)
            return (
              <motion.div
                key={movie.tmdbId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2.5 rounded-md border border-slate-800 bg-slate-800/30 p-2 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {movie.title}
                    {movie.year ? <span className="text-slate-400 font-normal ml-1">({movie.year})</span> : null}
                  </p>
                  {movie.overview && (
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 leading-tight break-all">{movie.overview}</p>
                  )}
                  {movie.runtime > 0 && (
                    <span className="text-[10px] text-slate-600">{movie.runtime} min</span>
                  )}
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => addMovie(movie)}
                  disabled={isAdded || addingId === movie.tmdbId || !profiles.length}
                  className={cn(
                    'h-7 px-2 shrink-0 text-[11px] gap-1',
                    isAdded ? 'text-emerald-400' : 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30'
                  )}
                >
                  {addingId === movie.tmdbId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isAdded ? (
                    <><Check className="w-3.5 h-3.5" /> Added</>
                  ) : (
                    <><Plus className="w-3.5 h-3.5" /> Add</>
                  )}
                </Button>
              </motion.div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

function CalendarMovieCard({ movie }) {
  const [expanded, setExpanded] = useState(false)
  const releaseType = movie.digitalRelease ? 'Digital' : movie.physicalRelease ? 'Physical' : movie.inCinemas ? 'Cinema' : ''

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'rounded-md border border-slate-800 bg-slate-800/30 overflow-hidden',
        movie.hasFile && 'border-l-2 border-l-emerald-500',
        !movie.hasFile && movie.monitored && 'border-l-2 border-l-yellow-500',
        !movie.monitored && 'border-l-2 border-l-slate-600 opacity-60'
      )}
    >
      <div className="flex gap-2.5 p-2">
        {/* Poster */}
        {movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="w-10 h-14 rounded object-cover shrink-0 bg-slate-700"
          />
        ) : (
          <div className="w-10 h-14 rounded bg-slate-700/50 flex items-center justify-center shrink-0">
            <Film className="w-4 h-4 text-slate-600" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-100 truncate">
            {movie.title}
            {movie.year ? <span className="text-slate-400 font-normal ml-1">({movie.year})</span> : null}
          </p>

          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {movie.hasFile && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-emerald-700/60 text-emerald-400 bg-emerald-950/40 font-normal">On disk</Badge>
            )}
            {releaseType && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-slate-700 text-slate-500 font-normal">{releaseType}</Badge>
            )}
            {movie.runtime > 0 && (
              <span className="text-[9px] text-slate-600">{movie.runtime} min</span>
            )}
            {movie.studio && (
              <span className="text-[9px] text-slate-600">{movie.studio}</span>
            )}
          </div>

          {movie.overview && (
            <>
              <AnimatePresence>
                {expanded && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-[10px] text-slate-400 mt-1 leading-relaxed overflow-hidden"
                  >
                    {movie.overview}
                  </motion.p>
                )}
              </AnimatePresence>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[9px] text-yellow-400/70 hover:text-yellow-400 mt-0.5 transition-colors"
              >
                {expanded ? 'Show less' : 'More details'}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function MovieCalendarPanel({ calendarItems = [] }) {
  // Filter to only recent past (3 days) and upcoming
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 3)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const filtered = calendarItems.filter(movie => {
    const date = movie.digitalRelease?.split('T')[0] || movie.physicalRelease?.split('T')[0] || movie.inCinemas?.split('T')[0] || ''
    return date >= cutoffStr
  })

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
        <Calendar className="w-8 h-8 opacity-30" />
        <span className="text-xs">No upcoming releases</span>
      </div>
    )
  }

  // Group by release date
  const grouped = {}
  filtered.forEach(movie => {
    const date = movie.digitalRelease?.split('T')[0] || movie.physicalRelease?.split('T')[0] || movie.inCinemas?.split('T')[0] || 'Unknown'
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(movie)
  })

  const today = new Date().toISOString().split('T')[0]

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3">
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, movies]) => {
          const isToday = date === today
          const isPast = date < today
          const dateObj = new Date(date + 'T12:00:00')
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
          const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

          return (
            <div key={date}>
              <div className="flex items-center gap-2 mb-1.5">
                <p className={cn('text-[11px] font-medium whitespace-nowrap', isToday ? 'text-yellow-400' : isPast ? 'text-slate-500' : 'text-slate-400')}>
                  {isToday ? 'Today' : dayName} — {monthDay}
                </p>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <div className="space-y-1.5">
                {movies.map(movie => (
                  <CalendarMovieCard key={movie.id} movie={movie} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

const RadarrWidget = ({ widget }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [iconError, setIconError] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchData = useCallback(async (isInitial = false, isManual = false) => {
    const _st = Date.now()
    if (isManual) setRefreshing(true)
    try {
      if (isInitial) setLoading(true)
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=radarr`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch Radarr data')
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
  }, [widget.id])

  useEffect(() => {
    fetchData(true)
    const interval = setInterval(() => fetchData(false), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const queueItems = [...(data?.queueItems || [])].sort((a, b) => {
    // Stuck items first
    const aStuck = a.trackedDownloadStatus === 'error' || a.trackedDownloadStatus === 'warning' || a.status === 'failed' ? 0 : 1
    const bStuck = b.trackedDownloadStatus === 'error' || b.trackedDownloadStatus === 'warning' || b.status === 'failed' ? 0 : 1
    if (aStuck !== bStuck) return aStuck - bStuck
    return (a.title || '').localeCompare(b.title || '')
  })
  const stuckCount = queueItems.filter(i => i.trackedDownloadStatus === 'error' || i.trackedDownloadStatus === 'warning' || i.status === 'failed').length

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-3 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src="/icons/custom/radarr.webp" alt="Radarr" className="w-7 h-7 object-contain" onError={() => setIconError(true)} />
              ) : (
                <Film className="w-5 h-5 text-yellow-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">{widget.title || 'Radarr'}</p>
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

      <CardContent className="p-0 flex-1 flex flex-col">
        {error ? (
          <div className="text-center py-4 px-4">
            <AlertCircle className="w-7 h-7 mx-auto mb-2 text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)} className="mt-2 text-xs text-slate-400 hover:text-slate-100 h-7">Retry</Button>
          </div>
        ) : loading && !data ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-md bg-slate-800" />)}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
            <TabsList className="grid-cols-4 shrink-0">
              <TabsTrigger value="overview" className="text-xs gap-1 px-2">
                <Film className="w-3 h-3" /> Overview
              </TabsTrigger>
              <TabsTrigger value="queue" className="text-xs gap-1 px-2">
                <Download className="w-3 h-3" /> Queue
                {(data?.queue || 0) > 0 && (
                  <span className={cn(
                    'ml-1 text-[10px] font-semibold px-1 rounded-full',
                    stuckCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  )}>
                    {data.queue}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs gap-1 px-2">
                <Calendar className="w-3 h-3" /> Calendar
                {(data?.calendarItems?.length || 0) > 0 && (
                  <span className="ml-1 text-[10px] font-semibold px-1 rounded-full bg-yellow-500/20 text-yellow-400">
                    {data.calendarItems.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="add" className="text-xs gap-1 px-2">
                <Plus className="w-3 h-3" /> Add
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="px-4 pb-4 mt-3 flex-1">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
                    <Film className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
                    <p className="text-lg font-bold text-slate-100">{data?.movies ?? '—'}</p>
                    <p className="text-[10px] text-slate-500">Movies</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
                    <HardDrive className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                    <p className="text-lg font-bold text-slate-100">{data?.downloaded ?? '—'}</p>
                    <p className="text-[10px] text-slate-500">Downloaded</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
                    <AlertCircle className="w-4 h-4 mx-auto mb-1 text-red-400" />
                    <p className={cn('text-lg font-bold', data?.missing > 0 ? 'text-red-300' : 'text-slate-100')}>{data?.missing ?? '—'}</p>
                    <p className="text-[10px] text-slate-500">Missing</p>
                  </div>
                </div>

                {/* Quick queue summary */}
                {queueItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400 font-medium">Active Downloads</p>
                      {stuckCount > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-red-700/60 text-red-400 bg-red-950/40 font-normal gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> {stuckCount} stuck
                        </Badge>
                      )}
                    </div>
                    {queueItems.slice(0, 3).map((item) => (
                      <div key={item.id} className={cn('flex items-center gap-2 text-xs rounded px-2 py-1 border border-slate-800', statusColor(item.status, item.trackedDownloadStatus).bg)}>
                        <span className="truncate flex-1 text-slate-300">{item.title}</span>
                        <span className="text-slate-500 shrink-0">{item.progress}%</span>
                      </div>
                    ))}
                    {queueItems.length > 3 && (
                      <button onClick={() => setActiveTab('queue')} className="text-[10px] text-yellow-400/70 hover:text-yellow-400 transition-colors w-full text-center">
                        View all {queueItems.length} items
                      </button>
                    )}
                  </div>
                )}

                {queueItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-4 gap-1.5 text-slate-500">
                    <Inbox className="w-6 h-6 opacity-40" />
                    <span className="text-xs">Queue empty</span>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="queue" className="px-4 pb-4 mt-3 flex-1">
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  <AnimatePresence>
                    {queueItems.length > 0 ? (
                      queueItems.map((item) => (
                        <QueueItem key={item.id} item={item} widgetId={widget.id} onRefreshData={() => fetchData(false)} />
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
                        <Inbox className="w-8 h-8 opacity-40" />
                        <span className="text-sm">No items in queue</span>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="calendar" className="px-4 pb-4 mt-3 flex-1">
              <MovieCalendarPanel calendarItems={data?.calendarItems || []} />
            </TabsContent>

            <TabsContent value="add" className="px-4 pb-4 mt-3 flex-1">
              <AddMoviePanel widgetId={widget.id} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

export default RadarrWidget
