import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, ArrowUpRight, Trash2, Play, HardDrive, Zap, User, Link2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { Separator } from '../../ui/separator'
import { Progress } from '../../ui/progress'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '../../ui/carousel'
import { cn } from '../../../lib/utils'
import { staggerContainer, staggerItem } from '../../../lib/animations'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const b = Number(bytes)
  if (b >= 1099511627776) return `${(b / 1099511627776).toFixed(1)} TB`
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
  if (b >= 1048576) return `${(b / 1048576).toFixed(0)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${b} B`
}

function expiryColor(days) {
  if (days === null || days === undefined) return 'text-slate-400'
  if (days > 60) return 'text-emerald-400'
  if (days > 30) return 'text-yellow-400'
  return 'text-red-400'
}

function expiryBg(days) {
  if (days === null || days === undefined) return 'border-slate-600'
  if (days > 60) return 'border-emerald-500/30'
  if (days > 30) return 'border-yellow-500/30'
  return 'border-red-500/30'
}

export default function DecypharrWidget({ widget, onDelete, onRefresh }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [iconError, setIconError] = useState(false)
  const [carouselApi, setCarouselApi] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [slideCount, setSlideCount] = useState(0)

  useEffect(() => {
    if (!carouselApi) return
    setSlideCount(carouselApi.scrollSnapList().length)
    setCurrentSlide(carouselApi.selectedScrollSnap())
    const onSelect = () => setCurrentSlide(carouselApi.selectedScrollSnap())
    carouselApi.on('select', onSelect)
    return () => carouselApi.off('select', onSelect)
  }, [carouselApi])

  const fetchData = async (isInitial = false, isManual = false) => {
    const _st = Date.now()
    if (isManual) setRefreshing(true)
    try {
      if (isInitial) setLoading(true)
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=decypharr`, { credentials: 'include' })
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

  const accounts = data?.accounts || []
  const totalAccounts = accounts.length


  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-2.5 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src="/icons/custom/decypharr.webp" alt="Decypharr" className="w-7 h-7 object-contain" onError={() => setIconError(true)} />
              ) : (
                <Zap className="w-5 h-5 text-violet-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">{widget.title || 'Decypharr'}</p>
              {!loading && !error && data && (
                <span className="text-[10px] text-slate-400">up {data.uptime}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!loading && !error && data && (
              <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', data.mount === 'Ready' ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30')}>
                {data.mount}
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={() => { fetchData(false, true); onRefresh?.() }} disabled={loading || refreshing} className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800">
              <RefreshCw className={cn('w-3.5 h-3.5', (loading || refreshing) && 'animate-spin')} />
            </Button>
            {onDelete && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(widget.id)} className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-slate-800">
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
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)} className="mt-2 text-xs text-slate-400 h-7">Retry</Button>
          </div>
        ) : loading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-20 rounded-lg bg-slate-800" />
            <Skeleton className="h-10 rounded-lg bg-slate-800" />
          </div>
        ) : data ? (
          <motion.div className="space-y-3" variants={staggerContainer} initial="initial" animate="animate">

            {/* Account carousel */}
            {totalAccounts > 0 && (
              <motion.div variants={staggerItem}>
                {totalAccounts > 1 && (
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-2 block">
                    Debrid Accounts
                  </span>
                )}

                <Carousel setApi={setCarouselApi} opts={{ loop: true }} className="w-full">
                  <CarouselContent>
                    {accounts.map((account, i) => (
                      <CarouselItem key={i}>
                        <div className={cn('bg-slate-800/50 rounded-lg p-3 border', expiryBg(account.daysLeft))}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-sm font-medium text-slate-100 truncate">{account.username}</span>
                              {account.inUse && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 text-emerald-400 border-emerald-500/30">active</Badge>
                              )}
                              {account.disabled && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 text-red-400 border-red-500/30">disabled</Badge>
                              )}
                            </div>
                            <div className="shrink-0">
                              {account.daysLeft !== null && (
                                <span className={cn('text-xs font-semibold', expiryColor(account.daysLeft))}>
                                  {account.daysLeft}d
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            <span className="capitalize">{account.debrid}</span>
                            <Separator orientation="vertical" className="h-3 bg-slate-700" />
                            <span className="flex items-center gap-1">
                              <Link2 className="w-2.5 h-2.5" />
                              {(account.linksCount || 0).toLocaleString()} links
                            </span>
                            <Separator orientation="vertical" className="h-3 bg-slate-700" />
                            <span>{account.trafficUsed ? formatBytes(account.trafficUsed) : '0 MB'} used</span>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {totalAccounts > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <CarouselPrevious className="static translate-y-0 h-6 w-6 min-h-0" />
                      <div className="flex items-center gap-2">
                        {accounts.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => carouselApi?.scrollTo(i)}
                            className={cn(
                              'h-2.5 w-2.5 min-h-0 shrink-0 rounded-full border-2 transition-all',
                              i === currentSlide ? 'border-violet-400 bg-violet-400/30' : 'border-slate-600 hover:border-slate-500'
                            )}
                          />
                        ))}
                      </div>
                      <CarouselNext className="static translate-y-0 h-6 w-6 min-h-0" />
                    </div>
                  )}
                </Carousel>

              </motion.div>
            )}

            {/* Library stats row */}
            <motion.div variants={staggerItem} className="flex gap-2 text-[10px]">
              <div className="flex-1 bg-slate-800/50 rounded px-2 py-1.5 text-center border border-slate-700/50">
                <div className="text-slate-400 uppercase tracking-wider">Links</div>
                <div className="text-slate-100 font-semibold text-sm">{(data.totalLinks || 0).toLocaleString()}</div>
              </div>
              <div className="flex-1 bg-slate-800/50 rounded px-2 py-1.5 text-center border border-slate-700/50">
                <div className="text-slate-400 uppercase tracking-wider">Torrents</div>
                <div className="text-slate-100 font-semibold text-sm">{(data.totalTorrents || 0).toLocaleString()}</div>
              </div>
              {data.badTorrents > 0 && (
                <div className="flex-1 bg-slate-800/50 rounded px-2 py-1.5 text-center border border-red-500/20">
                  <div className="text-red-400 uppercase tracking-wider">Bad</div>
                  <div className="text-red-400 font-semibold text-sm">{data.badTorrents}</div>
                </div>
              )}
            </motion.div>

            {/* Active streams */}
            {data.streams > 0 && (
              <motion.div variants={staggerItem} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span className="text-[11px] text-slate-300 font-medium">Active Streams</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-emerald-400 border-emerald-500/30">{data.streams}</Badge>
                </div>
                {(data.streamDetails || []).map((s, i) => (
                  <div key={i} className="text-[10px] text-slate-400 truncate pl-5">
                    {s.fileName || 'Unknown'}
                    {s.client && <span className="text-slate-500"> · {s.client}</span>}
                  </div>
                ))}
              </motion.div>
            )}

            {/* Queue & Repair */}
            <motion.div variants={staggerItem} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-300 font-medium">Queue</span>
                <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', data.queue > 0 || (data.queueItems || []).length > 0 ? 'text-sky-400 border-sky-400/30' : 'text-slate-500 border-slate-700')}>
                  {data.queue || (data.queueItems || []).length}
                </Badge>
                {data.repair?.active > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-orange-400 border-orange-400/30">
                    {data.repair.active} repairing
                  </Badge>
                )}
                {data.repair?.pending > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-yellow-400 border-yellow-400/30">
                    {data.repair.pending} pending
                  </Badge>
                )}
              </div>
              {(data.queueItems || []).length > 0 && (
                <div className="space-y-1.5">
                  {data.queueItems.map((item, i) => (
                    <div key={i} className={cn(
                      'bg-slate-800/50 rounded-lg p-2.5 border-l-2 border border-slate-700/50 space-y-1',
                      item.status === 'downloading' ? 'border-l-sky-500' : item.status === 'error' ? 'border-l-red-500' : 'border-l-slate-500'
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-200 font-medium truncate">{item.name}</span>
                        {item.category && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 text-slate-400 border-slate-600 shrink-0">{item.category}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={item.progress} className="h-1 flex-1" />
                        <span className="text-[10px] text-slate-400 shrink-0">{item.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

          </motion.div>
        ) : null}
      </CardContent>

      {widget.url && (
        <CardFooter className="p-0 border-t border-slate-800">
          <a href={widget.url} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="ghost" className="w-full h-9 rounded-none text-xs font-medium gap-1.5 text-violet-400 hover:text-slate-100 hover:bg-slate-800/60">
              Open Decypharr <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </CardFooter>
      )}
    </Card>
  )
}
