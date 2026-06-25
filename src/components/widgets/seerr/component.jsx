import { useState, useEffect, useCallback, useRef } from 'react'
import { Film, Tv, AlertCircle, Clock, CheckCircle, RefreshCw, ArrowUpRight, Inbox, Search, Plus, Trash2, ThumbsUp, ThumbsDown, Loader2, Check, X, AlertTriangle, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { Input } from '../../ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs'
import { ScrollArea } from '../../ui/scroll-area'
import { cn } from '../../../lib/utils'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w92'

function requestStatusInfo(status) {
  switch (status) {
    case 1: return { label: 'Pending', color: 'text-yellow-400', badge: 'border-yellow-700/60 text-yellow-400 bg-yellow-950/40' }
    case 2: return { label: 'Approved', color: 'text-emerald-400', badge: 'border-emerald-700/60 text-emerald-400 bg-emerald-950/40' }
    case 3: return { label: 'Declined', color: 'text-red-400', badge: 'border-red-700/60 text-red-400 bg-red-950/40' }
    case 4: return { label: 'Failed', color: 'text-red-400', badge: 'border-red-700/60 text-red-400 bg-red-950/40' }
    case 5: return { label: 'Completed', color: 'text-blue-400', badge: 'border-blue-700/60 text-blue-400 bg-blue-950/40' }
    default: return { label: 'Unknown', color: 'text-slate-400', badge: 'border-slate-700 text-slate-400 bg-slate-800' }
  }
}

function mediaStatusInfo(status) {
  switch (status) {
    case 3: return { label: 'Processing', color: 'text-blue-400' }
    case 4: return { label: 'Partial', color: 'text-amber-400' }
    case 5: return { label: 'Available', color: 'text-emerald-400' }
    default: return null
  }
}

function RequestItem({ item, widgetId, onRefreshData }) {
  const [acting, setActing] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const statusInfo = requestStatusInfo(item.status)
  const mediaInfo = mediaStatusInfo(item.mediaStatus)

  const doAction = async (action) => {
    setActing(action)
    try {
      const res = await fetch(`/api/widgets/${widgetId}/action`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { id: item.id } })
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="rounded-md border border-slate-800 bg-slate-800/30 overflow-hidden"
    >
      <div className="flex gap-2.5 p-2">
        {item.posterPath ? (
          <img src={`${TMDB_IMG}${item.posterPath}`} alt={item.title} className="w-10 h-14 rounded object-cover shrink-0 bg-slate-700" />
        ) : (
          <div className="w-10 h-14 rounded bg-slate-700/50 flex items-center justify-center shrink-0">
            {item.type === 'tv' ? <Tv className="w-4 h-4 text-slate-600" /> : <Film className="w-4 h-4 text-slate-600" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-100 truncate">{item.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge variant="outline" className={cn('text-[9px] h-3.5 px-1 font-normal', statusInfo.badge)}>
              {statusInfo.label}
            </Badge>
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-slate-700 text-slate-500 font-normal">
              {item.type === 'tv' ? 'TV' : 'Movie'}
            </Badge>
            {item.is4k && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-slate-700 text-slate-500 font-normal">4K</Badge>
            )}
            {mediaInfo && (
              <span className={cn('text-[9px]', mediaInfo.color)}>{mediaInfo.label}</span>
            )}
          </div>
          <p className="text-[9px] text-slate-500 mt-0.5 truncate">
            by {item.requestedBy} — {new Date(item.createdAt).toLocaleDateString()}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-1 mt-1">
            {confirmAction ? (
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-slate-400">{confirmAction === 'request.delete' ? 'Delete?' : 'Decline?'}</span>
                <Button variant="ghost" size="sm" onClick={() => doAction(confirmAction)} disabled={!!acting}
                  className="h-5 px-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/40">
                  {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Yes
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)} className="h-5 px-1.5 text-[10px] text-slate-400">
                  <X className="w-3 h-3" /> No
                </Button>
              </div>
            ) : (
              <>
                {item.status === 1 && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => doAction('request.approve')} disabled={!!acting}
                      className="h-5 px-1.5 text-[10px] gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40">
                      {acting === 'request.approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />} Approve
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction('request.decline')}
                      className="h-5 px-1.5 text-[10px] gap-1 text-slate-400 hover:text-amber-400 hover:bg-amber-950/40">
                      <ThumbsDown className="w-3 h-3" /> Decline
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction('request.delete')}
                  className="h-5 px-1.5 text-[10px] gap-1 text-slate-400 hover:text-red-400 hover:bg-red-950/40">
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function SearchPanel({ widgetId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [requestingId, setRequestingId] = useState(null)
  const [requestedIds, setRequestedIds] = useState(new Set())
  const [error, setError] = useState(null)
  const searchTimeout = useRef(null)

  const doSearch = useCallback(async (term) => {
    if (!term || term.length < 2) { setResults([]); return }
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/widgets/${widgetId}/action`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', params: { query: term } })
      })
      if (!res.ok) throw new Error('Search failed')
      const d = await res.json()
      setResults(d.data || [])
    } catch (e) { setError(e.message) }
    finally { setSearching(false) }
  }, [widgetId])

  const onInput = (val) => {
    setQuery(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => doSearch(val), 400)
  }

  const requestMedia = async (item) => {
    setRequestingId(item.id)
    try {
      const res = await fetch(`/api/widgets/${widgetId}/action`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request.create',
          params: { mediaType: item.mediaType, mediaId: item.id }
        })
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      setRequestedIds(prev => new Set(prev).add(item.id))
    } catch (e) { setError(e.message) }
    finally { setRequestingId(null) }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <Input value={query} onChange={(e) => onInput(e.target.value)} placeholder="Search movies & TV..." className="pl-8 h-8 text-sm bg-slate-800/60 border-slate-700" />
        {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
      </div>

      {error && <div className="text-[11px] text-red-400 px-1">{error}</div>}

      <ScrollArea className="h-[260px]">
        <div className="space-y-1.5">
          {results.length === 0 && !searching && query.length >= 2 && (
            <p className="text-xs text-slate-500 text-center py-6">No results found</p>
          )}
          {results.length === 0 && !searching && query.length < 2 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
              <Search className="w-8 h-8 opacity-30" />
              <span className="text-xs">Search for movies or TV shows to request</span>
            </div>
          )}
          {results.map((item) => {
            const hasMedia = !!item.mediaInfo
            const isRequested = requestedIds.has(item.id) || (item.mediaInfo?.status && item.mediaInfo.status >= 2)
            return (
              <motion.div key={`${item.mediaType}-${item.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-start gap-2.5 rounded-md border border-slate-800 bg-slate-800/30 p-2 hover:bg-slate-800/60 transition-colors">
                {item.posterPath ? (
                  <img src={`${TMDB_IMG}${item.posterPath}`} alt={item.title} className="w-10 h-14 rounded object-cover shrink-0 bg-slate-700" />
                ) : (
                  <div className="w-10 h-14 rounded bg-slate-700/50 flex items-center justify-center shrink-0">
                    {item.mediaType === 'tv' ? <Tv className="w-4 h-4 text-slate-600" /> : <Film className="w-4 h-4 text-slate-600" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {item.title}
                    {item.year && <span className="text-slate-400 font-normal ml-1">({item.year})</span>}
                  </p>
                  {item.overview && (
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 leading-tight">{item.overview}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-slate-700 text-slate-500 font-normal">
                      {item.mediaType === 'tv' ? 'TV' : 'Movie'}
                    </Badge>
                    {item.voteAverage > 0 && (
                      <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-yellow-500" /> {item.voteAverage.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => requestMedia(item)}
                  disabled={isRequested || requestingId === item.id}
                  className={cn('h-7 px-2 shrink-0 text-[11px] gap-1',
                    isRequested ? 'text-emerald-400' : 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/30')}>
                  {requestingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : isRequested ? <><Check className="w-3.5 h-3.5" /> Requested</>
                    : <><Plus className="w-3.5 h-3.5" /> Request</>}
                </Button>
              </motion.div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

const SeerrWidget = ({ widget }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [iconError, setIconError] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Determine which brand variant this is
  const appName = (widget.appName || widget.type || '').toLowerCase()
  const isJellyseerr = appName.includes('jellyseerr')
  const isOverseerr = appName.includes('overseerr')
  const displayName = widget.title || (isJellyseerr ? 'Jellyseerr' : isOverseerr ? 'Overseerr' : 'Seerr')
  const iconFile = isJellyseerr ? 'jellyseerr' : isOverseerr ? 'overseerr' : 'jellyseerr'
  const proxyEndpoint = isOverseerr ? 'overseerr' : isJellyseerr ? 'jellyseerr' : 'seerr'

  const fetchData = useCallback(async (isInitial = false, isManual = false) => {
    const _st = Date.now()
    if (isManual) setRefreshing(true)
    try {
      if (isInitial) setLoading(true)
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=${proxyEndpoint}`, { credentials: 'include' })
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
  }, [widget.id, proxyEndpoint])

  useEffect(() => {
    fetchData(true)
    const interval = setInterval(() => fetchData(false), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const requests = data?.requests || []
  const pendingRequests = requests.filter(r => r.status === 1)

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-3 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src={`/icons/custom/${iconFile}.webp`} alt={displayName} className="w-7 h-7 object-contain" onError={() => setIconError(true)} />
              ) : (
                <Film className="w-5 h-5 text-purple-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">{displayName}</p>
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
            <TabsList className="grid-cols-3 shrink-0">
              <TabsTrigger value="overview" className="text-xs gap-1">
                <Film className="w-3 h-3" /> Overview
              </TabsTrigger>
              <TabsTrigger value="requests" className="text-xs gap-1">
                <Clock className="w-3 h-3" /> Requests
                {pendingRequests.length > 0 && (
                  <span className="ml-0.5 text-[10px] font-semibold px-1 rounded-full bg-yellow-500/20 text-yellow-400">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="search" className="text-xs gap-1">
                <Search className="w-3 h-3" /> Search
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="px-4 pb-4 mt-3 flex-1">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
                    <Clock className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
                    <p className={cn('text-lg font-bold', data?.pending > 0 ? 'text-yellow-300' : 'text-slate-100')}>{data?.pending ?? '—'}</p>
                    <p className="text-[10px] text-slate-500">Pending</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
                    <RefreshCw className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                    <p className="text-lg font-bold text-slate-100">{data?.processing ?? '—'}</p>
                    <p className="text-[10px] text-slate-500">Processing</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
                    <CheckCircle className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                    <p className="text-lg font-bold text-slate-100">{data?.approved ?? '—'}</p>
                    <p className="text-[10px] text-slate-500">Approved</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
                    <Film className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                    <p className="text-lg font-bold text-slate-100">{data?.available ?? '—'}</p>
                    <p className="text-[10px] text-slate-500">Available</p>
                  </div>
                </div>

                {data?.issues?.open > 0 && (
                  <div className="rounded-lg bg-amber-950/20 border border-amber-800/30 px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-300">{data.issues.open} open issue{data.issues.open !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Quick pending requests */}
                {pendingRequests.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-400 font-medium">Pending Approval</p>
                    {pendingRequests.slice(0, 3).map(req => (
                      <div key={req.id} className="flex items-center gap-2 text-xs rounded px-2 py-1 border border-slate-800 bg-yellow-500/5">
                        <span className="truncate flex-1 text-slate-300">{req.title}</span>
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-slate-700 text-slate-500 font-normal">
                          {req.type === 'tv' ? 'TV' : 'Movie'}
                        </Badge>
                      </div>
                    ))}
                    {pendingRequests.length > 3 && (
                      <button onClick={() => setActiveTab('requests')} className="text-[10px] text-purple-400/70 hover:text-purple-400 transition-colors w-full text-center">
                        View all {pendingRequests.length} pending
                      </button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="requests" className="px-4 pb-4 mt-3 flex-1">
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  <AnimatePresence>
                    {requests.length > 0 ? (
                      requests.map(req => (
                        <RequestItem key={req.id} item={req} widgetId={widget.id} onRefreshData={() => fetchData(false)} />
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
                        <Inbox className="w-8 h-8 opacity-40" />
                        <span className="text-sm">No requests</span>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="search" className="px-4 pb-4 mt-3 flex-1">
              <SearchPanel widgetId={widget.id} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

export default SeerrWidget
