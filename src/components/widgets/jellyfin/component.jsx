import { useState, useEffect } from 'react'
import { Play, Film, Tv, Music, Monitor, Smartphone, Pause, RefreshCw, ArrowUpRight, Zap, Trash2, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { Progress } from '../../ui/progress'
import { cn } from '../../../lib/utils'
import { staggerContainer, staggerItem } from '../../../lib/animations'

const brandColor = {
  text: 'text-purple-400',
  bg: 'bg-purple-500/10',
  border: 'border-purple-500/30',
  progress: 'bg-purple-500',
  streamBadge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

const MAX_STREAMS = 5

const JellyfinWidget = ({ widget, onDelete, onRefresh }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [expandedSession, setExpandedSession] = useState(null)
  const [iconError, setIconError] = useState(false)

  const fetchData = async (isInitial = false, isManual = false) => {
    const _st = Date.now()
    if (isManual) setRefreshing(true)
    try {
      if (isInitial) setLoading(true)
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=jellyfin`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch Jellyfin data')
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
    const interval = setInterval(() => fetchData(false), 10000)
    return () => clearInterval(interval)
  }, [widget.id])

  const decodeHtmlEntities = (text) => {
    if (!text) return text
    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    return textarea.value
  }

  const formatBitrate = (bitrate) => {
    if (!bitrate) return null
    if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)} Mbps`
    if (bitrate >= 1000) return `${(bitrate / 1000).toFixed(0)} Kbps`
    return `${bitrate} bps`
  }

  const formatResolution = (resolution) => {
    if (!resolution) return null
    const parts = resolution.split('x').map(Number)
    const height = parts[1]
    if (!height) return resolution
    if (height >= 2160) return '4K'
    if (height >= 1080) return '1080p'
    if (height >= 720) return '720p'
    if (height >= 480) return '480p'
    return resolution
  }

  const getDeviceIcon = (client) => {
    const c = (client || '').toLowerCase()
    if (c.includes('android') || c.includes('ios') || c.includes('mobile')) return Smartphone
    return Monitor
  }

  const getMediaIcon = (type) => {
    if (type === 'Movie') return Film
    if (type === 'Episode') return Tv
    if (type === 'Audio') return Music
    return Play
  }

  const sessions = [...(data?.sessions || [])]
    .sort((a, b) => (a.userName || '').localeCompare(b.userName || ''))
    .slice(0, MAX_STREAMS)

  const streamCount = data?.streams ?? 0

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-3 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src="/icons/custom/jellyfin.webp" alt="Jellyfin" className="w-6 h-6 object-contain" onError={() => setIconError(true)} />
              ) : (
                <Play className={cn('w-4 h-4', brandColor.text)} fill="currentColor" />
              )}
            </div>
            <span className="font-semibold text-slate-100 text-sm truncate">{widget.title || 'Jellyfin'}</span>
            <AnimatePresence mode="wait">
              {!loading && !error && data && (
                <motion.div key="badge" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Badge className={cn('text-[10px] px-1.5 py-0 h-4 rounded-full border font-medium', brandColor.streamBadge)}>
                    {streamCount > 0 ? `${streamCount} Stream${streamCount !== 1 ? 's' : ''}` : 'Idle'}
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchData(false, true)}
              disabled={loading || refreshing}
              className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', (loading || refreshing) && 'animate-spin')} />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex-1">
        {error ? (
          <div className="text-center py-6">
            <p className="text-red-400 text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)} className="mt-2 text-xs text-slate-400 hover:text-slate-100 h-7">Retry</Button>
          </div>
        ) : loading && !data ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-2.5 p-2.5 rounded-lg bg-slate-800/40">
                <Skeleton className="w-10 h-14 rounded bg-slate-700 flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3 w-3/4 bg-slate-700 rounded" />
                  <Skeleton className="h-2.5 w-1/2 bg-slate-700 rounded" />
                  <Skeleton className="h-1 w-full bg-slate-700 rounded mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', brandColor.bg)}>
              <Play className={cn('w-5 h-5', brandColor.text)} />
            </div>
            <p className="text-slate-500 text-sm">Nothing playing</p>
          </div>
        ) : (
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {sessions.map((session, idx) => {
              const DeviceIcon = getDeviceIcon(session.client)
              const MediaIcon = getMediaIcon(session.type)
              const progress = session.positionTicks && session.runtimeTicks
                ? Math.round((session.positionTicks / session.runtimeTicks) * 100)
                : 0
              const hasImage = session.itemId && session.imageTag
              const isExpanded = expandedSession === idx
              const isPaused = session.isPaused

              return (
                <motion.div key={idx} variants={staggerItem}>
                  <div
                    onClick={() => setExpandedSession(isExpanded ? null : idx)}
                    className={cn(
                      'rounded-lg p-2.5 border transition-all duration-200 cursor-pointer',
                      'bg-slate-800/40 border-slate-700/40',
                      'hover:bg-slate-800/70 hover:border-purple-500/25'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Poster */}
                      <div className="relative flex-shrink-0">
                        {hasImage ? (
                          <img
                            src={`/api/widgets/${widget.id}/proxy-image?path=${encodeURIComponent(`/Items/${session.itemId}/Images/Primary?tag=${session.imageTag}&quality=90&maxHeight=210`)}`}
                            alt=""
                            className="w-10 h-14 rounded object-cover bg-slate-700"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                          />
                        ) : null}
                        <div className={cn(hasImage ? 'hidden' : 'flex', 'w-10 h-14 rounded items-center justify-center', brandColor.bg)}>
                          <MediaIcon className={cn('w-5 h-5', brandColor.text)} />
                        </div>
                        <div className={cn(
                          'absolute -bottom-1 -right-1 p-0.5 rounded-full',
                          isPaused ? 'bg-yellow-500' : 'bg-green-500'
                        )}>
                          {isPaused
                            ? <Pause className="w-2 h-2 text-white" />
                            : <Play className="w-2 h-2 text-white" fill="white" />
                          }
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate leading-tight">
                          {session.seriesName
                            ? decodeHtmlEntities(session.seriesName)
                            : decodeHtmlEntities(session.nowPlayingItem) || 'Unknown'}
                        </p>
                        {session.seriesName ? (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {decodeHtmlEntities(session.nowPlayingItem)}
                            {session.seasonEpisode && ` · ${decodeHtmlEntities(session.seasonEpisode)}`}
                          </p>
                        ) : null}

                        {/* Progress bar */}
                        <div className="mt-2">
                          <Progress
                            value={progress}
                            className={cn('h-1', isPaused ? 'bg-yellow-500/20' : 'bg-slate-700')}
                            indicatorClassName={isPaused ? 'bg-yellow-500' : brandColor.progress}
                          />
                        </div>

                        {/* Badges row */}
                        <div className="flex items-center flex-wrap gap-1 mt-1.5">
                          <div className="flex items-center gap-1">
                            <DeviceIcon className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{session.userName}</span>
                          </div>
                          {formatResolution(session.resolution) && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 rounded border-slate-600 text-slate-400">
                              {formatResolution(session.resolution)}
                            </Badge>
                          )}
                          {session.isTranscoding ? (
                            <Badge className="text-[10px] px-1 py-0 h-4 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 gap-0.5">
                              <Zap className="w-2.5 h-2.5" />Transcode
                            </Badge>
                          ) : (session.playMethod === 'DirectPlay' || session.playMethod === 'DirectStream') ? (
                            <Badge variant="success" className="text-[10px] px-1 py-0 h-4 rounded">
                              {session.playMethod === 'DirectPlay' ? 'Direct' : 'Direct Stream'}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <Info className={cn('w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5 transition-transform', isExpanded && 'rotate-180')} />
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/50 text-xs space-y-1.5">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            {session.client && <div><span className="text-slate-500">Client: </span><span className="text-slate-300">{session.client}</span></div>}
                            {session.deviceName && <div><span className="text-slate-500">Device: </span><span className="text-slate-300">{session.deviceName}</span></div>}
                            {session.resolution && <div><span className="text-slate-500">Resolution: </span><span className="text-slate-300">{session.resolution}</span></div>}
                            {session.videoCodec && <div><span className="text-slate-500">Video: </span><span className="text-slate-300">{session.videoCodec}</span></div>}
                            {session.audioCodec && <div><span className="text-slate-500">Audio: </span><span className="text-slate-300">{session.audioCodec}{session.audioChannels && ` ${session.audioChannels}ch`}</span></div>}
                            {session.playMethod && <div><span className="text-slate-500">Method: </span><span className={session.isTranscoding ? 'text-orange-400' : 'text-green-400'}>{session.playMethod}</span></div>}
                          </div>
                          {session.isTranscoding && (
                            <div className="pt-1.5 border-t border-slate-700/50 space-y-1">
                              {session.transcodeBitrate && (
                                <p className="text-slate-400">Bitrate: {formatBitrate(session.transcodeBitrate)}</p>
                              )}
                              {session.transcodeReason && (
                                <p className="text-slate-500">Reason: {session.transcodeReason}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </CardContent>

      {widget.url && (
        <CardFooter className="p-0 border-t border-slate-800">
          <a href={widget.url} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button
              variant="ghost"
              className={cn('w-full h-9 rounded-none text-xs font-medium gap-1.5', brandColor.text, 'hover:text-slate-100 hover:bg-slate-800/60')}
            >
              Open Jellyfin <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </CardFooter>
      )}
    </Card>
  )
}

export default JellyfinWidget
