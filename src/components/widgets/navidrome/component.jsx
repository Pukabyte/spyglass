import { useState, useEffect, useRef } from 'react'
import { AlertCircle, Music, Disc3, ListMusic, User, Play, RefreshCw, ArrowUpRight, Info, Headphones, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/card'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { Progress } from '../../ui/progress'
import { cn } from '../../../lib/utils'
import { staggerContainer, staggerItem } from '../../../lib/animations'

const brandColor = {
  text: 'text-emerald-400',
  bg: 'bg-emerald-500/10',
}

function StatItem({ icon: Icon, label, value, highlight, loading }) {
  return (
    <motion.div variants={staggerItem} className="flex flex-col items-center">
      <Icon className={cn('w-3.5 h-3.5 mb-0.5', highlight ? brandColor.text : 'text-slate-500')} />
      <span className={cn('text-base font-semibold', highlight ? 'text-slate-50' : 'text-slate-200')}>
        {loading ? '—' : value}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
    </motion.div>
  )
}

export default function NavidromeWidget({ widget }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [expandedStream, setExpandedStream] = useState(null)
  const [tick, setTick] = useState(0)
  const trackState = useRef({})
  const [iconError, setIconError] = useState(false)

  const fetchData = async (isInitial = false, isManual = false) => {
    const _st = Date.now()
    if (isManual) setRefreshing(true)
    try {
      if (isInitial) setLoading(true)
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=navidrome`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch data')
      const result = await response.json()
      const newData = result.data || result

      const currentKeys = new Set()
      ;(newData.nowPlaying || []).forEach(track => {
        const key = `${track.title}|${track.artist}|${track.username}`
        currentKeys.add(key)
        const existing = trackState.current[key]
        const minutesAgo = track.minutesAgo || 0
        if (!existing) {
          trackState.current[key] = { startTime: Date.now() - minutesAgo * 60 * 1000, lastMinutesAgo: minutesAgo }
        } else if (minutesAgo !== existing.lastMinutesAgo) {
          trackState.current[key] = { startTime: Date.now() - minutesAgo * 60 * 1000, lastMinutesAgo: minutesAgo }
        }
      })
      Object.keys(trackState.current).forEach(key => {
        if (!currentKeys.has(key)) delete trackState.current[key]
      })

      setData(newData)
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
    const interval = setInterval(() => fetchData(false), 15000)
    return () => clearInterval(interval)
  }, [widget.id])

  useEffect(() => {
    const ticker = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(ticker)
  }, [])

  const formatDuration = (seconds) => {
    if (!seconds) return ''
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '—'
    return Number(num).toLocaleString()
  }

  const formatSize = (bytes) => {
    if (!bytes) return null
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${bytes} B`
  }

  const nowPlaying = data?.nowPlaying || []

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-3 pb-3 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src="/icons/custom/navidrome.webp" alt="Navidrome" className="w-7 h-7 object-contain" onError={() => setIconError(true)} />
              ) : (
                <Music className={cn('w-5 h-5', brandColor.text)} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">{widget.title || 'Navidrome'}</p>
              <AnimatePresence mode="wait">
                {!loading && !error && data && (
                  <motion.div key="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn('inline-block w-1.5 h-1.5 rounded-full', data.playing > 0 ? 'bg-green-400 animate-pulse' : 'bg-slate-500')} />
                    <span className="text-[10px] text-slate-400">
                      {data.playing > 0 ? `${data.playing} active stream${data.playing !== 1 ? 's' : ''}` : 'No active streams'}
                    </span>
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
          <div className="flex gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="flex-1 h-14 rounded-lg bg-slate-800" />)}</div>
        ) : (
          <>
            <motion.div className="flex items-center justify-between gap-2 mb-4 px-1" variants={staggerContainer} initial="initial" animate="animate">
              <StatItem icon={Music} label="Songs" value={formatNumber(data?.songs)} loading={loading} />
              <StatItem icon={User} label="Artists" value={formatNumber(data?.artists)} loading={loading} />
              <StatItem icon={ListMusic} label="Playlists" value={formatNumber(data?.playlists)} loading={loading} />
              <StatItem icon={Play} label="Streams" value={formatNumber(data?.playing ?? 0)} highlight={data?.playing > 0} loading={loading} />
            </motion.div>

            {nowPlaying.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Now Playing</span>
                  </div>
                  <span className="text-xs text-slate-500">{nowPlaying.length} active</span>
                </div>
                <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {nowPlaying.map((track, idx) => {
                    const trackId = `${track.title}|${track.artist}|${track.username}`
                    const isExpanded = expandedStream === idx
                    const state = trackState.current[trackId]
                    const elapsed = state ? Math.floor((Date.now() - state.startTime) / 1000) : 0
                    const progress = track.duration > 0 ? Math.min(Math.round((elapsed / track.duration) * 100), 100) : 0

                    return (
                      <div key={trackId}>
                        <div
                          onClick={() => setExpandedStream(isExpanded ? null : idx)}
                          className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50 hover:border-emerald-500/30 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative flex-shrink-0">
                              {track.coverArt ? (
                                <img src={track.coverArt} alt={track.album} className="w-10 h-10 rounded object-cover bg-slate-700" onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex' }} />
                              ) : null}
                              <div className={cn(track.coverArt ? 'hidden' : 'flex', 'w-10 h-10 rounded items-center justify-center', brandColor.bg)}>
                                <Disc3 className={cn('w-5 h-5', brandColor.text, 'animate-spin')} style={{ animationDuration: '3s' }} />
                              </div>
                              <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-green-500">
                                <Play className="w-2 h-2 text-white" fill="white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-white truncate block">{track.title || 'Unknown'}</span>
                              <p className="text-xs text-slate-400 truncate">{track.artist}{track.album && ` — ${track.album}`}</p>
                              <div className="flex items-center flex-wrap gap-1.5 mt-1">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-500" />
                                  <span className="text-xs text-slate-500">{track.username || 'Unknown'}</span>
                                </div>
                                {track.playerName && <span className="text-xs px-1 py-0.5 rounded bg-slate-700 text-slate-400">{track.playerName}</span>}
                                {track.playMethod === 'Transcode' && (
                                  <span className="text-xs px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /><span>Transcode</span></span>
                                )}
                                {track.playMethod === 'Direct Play' && (
                                  <span className="text-xs px-1 py-0.5 rounded bg-green-500/20 text-green-400">Direct</span>
                                )}
                                {track.duration && <span className="text-xs text-slate-500">{formatDuration(track.duration)}</span>}
                              </div>
                              {track.duration > 0 && (
                                <div className="mt-1.5">
                                  <Progress value={Math.max(progress, 1)} className="h-1 bg-slate-700" indicatorClassName="bg-emerald-500 transition-all duration-1000 ease-linear" />
                                </div>
                              )}
                            </div>
                            <Info className={cn('w-4 h-4 text-slate-500 flex-shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-1 bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 text-xs space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {track.username && <div><span className="text-slate-500">User:</span><span className="ml-1 text-slate-300">{track.username}</span></div>}
                              {track.playerClient && <div><span className="text-slate-500">Client:</span><span className="ml-1 text-slate-300">{track.playerClient}</span></div>}
                              {track.playerUserAgent && <div><span className="text-slate-500">Device:</span><span className="ml-1 text-slate-300">{track.playerUserAgent}</span></div>}
                              {track.artist && <div><span className="text-slate-500">Artist:</span><span className="ml-1 text-slate-300">{track.artist}</span></div>}
                              {track.album && <div><span className="text-slate-500">Album:</span><span className="ml-1 text-slate-300">{track.album}</span></div>}
                              {track.year && <div><span className="text-slate-500">Year:</span><span className="ml-1 text-slate-300">{track.year}</span></div>}
                              {track.suffix && <div><span className="text-slate-500">Format:</span><span className="ml-1 text-slate-300">{track.suffix.toUpperCase()}</span></div>}
                              {track.bitRate > 0 && <div><span className="text-slate-500">Bitrate:</span><span className="ml-1 text-slate-300">{track.bitRate} kbps</span></div>}
                              {track.size > 0 && <div><span className="text-slate-500">Size:</span><span className="ml-1 text-slate-300">{formatSize(track.size)}</span></div>}
                              {track.duration > 0 && <div><span className="text-slate-500">Progress:</span><span className="ml-1 text-slate-300">{formatDuration(Math.min(elapsed, track.duration))} / {formatDuration(track.duration)} ({progress}%)</span></div>}
                              <div><span className="text-slate-500">Play Method:</span><span className={cn('ml-1', track.playMethod === 'Transcode' ? 'text-orange-400' : 'text-green-400')}>{track.playMethod}</span></div>
                            </div>
                            {track.playMethod === 'Transcode' && (
                              <div className="pt-2 border-t border-slate-700/50">
                                <div className="text-orange-400 font-medium mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /><span>Transcoding</span></div>
                                <div className="grid grid-cols-2 gap-2 text-slate-400">
                                  <div>Source: {track.suffix?.toUpperCase() || 'Unknown'} {track.bitRate > 0 ? `${track.bitRate} kbps` : ''}</div>
                                  <div>Target: {track.transcodeFormat?.toUpperCase() || 'Unknown'} {track.transcodeBitRate > 0 ? `${track.transcodeBitRate} kbps` : ''}</div>
                                  {track.transcodeCodec && <div className="col-span-2 text-slate-500">Profile: {track.transcodeCodec}</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {data && nowPlaying.length === 0 && (
              <div className="text-center py-3 text-slate-500 text-sm">No one is currently streaming</div>
            )}
          </>
        )}
      </CardContent>

      {widget.url && (
        <CardFooter className="p-0 border-t border-slate-800">
          <a href={widget.url} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="ghost" className={cn('w-full h-9 rounded-none text-xs font-medium gap-1.5', brandColor.text, 'hover:text-slate-100 hover:bg-slate-800/60')}>
              Open Navidrome <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </CardFooter>
      )}
    </Card>
  )
}
