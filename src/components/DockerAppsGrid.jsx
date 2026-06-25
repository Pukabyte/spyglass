import { ExternalLink, Play, Square, RefreshCw, ChevronDown, ChevronUp, Cpu, HardDrive, Network, Activity, Clock, RotateCcw, ArrowUp, ArrowDown, Download, Trash2, FileText, Upload } from 'lucide-react'
import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react'
import { motion } from 'framer-motion'
import DockerLogViewer from './DockerLogViewer'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Progress } from './ui/progress'
import { Separator } from './ui/separator'
import { Skeleton } from './ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { staggerContainer, staggerItem, cardHover } from '../lib/animations'
import { cn } from '../lib/utils'

// Pure utility functions - defined outside component so they are stable references
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString()
}

const getStatusBadgeProps = (status) => {
  switch (status) {
    case 'running':
      return { variant: 'default', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20' }
    case 'stopped':
      return { variant: 'destructive', className: 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/20' }
    case 'restarting':
      return { variant: 'secondary', className: 'bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/20' }
    default:
      return { variant: 'secondary', className: 'bg-slate-500/15 text-slate-400 border-slate-500/25' }
  }
}

// Intersection observer hook - once a card becomes visible it stays rendered
function useInView(ref, options = {}) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        observer.disconnect() // Once visible, stay rendered
      }
    }, { rootMargin: '200px', ...options })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref]) // eslint-disable-line react-hooks/exhaustive-deps
  return inView
}

// Memoized card component - only re-renders when its own props change
const DockerAppCard = memo(({
  app,
  isExpanded,
  onToggleExpand,
  actionLoading,
  onAction,
  resolvedIcon,
  failedIcon,
  customIcons,
  canEditConfig,
  canStop,
  canStart,
  canRestart,
  canDelete,
  onIconUpload,
  onIconDelete,
  uploadingIcon,
  onViewLogs,
  updateStatus,
  checkingUpdate,
  setFailedIcons,
}) => {
  const ref = useRef(null)
  const inView = useInView(ref)

  // Lightweight skeleton placeholder while card is off-screen
  if (!inView) {
    return (
      <div ref={ref} className="min-h-[200px]">
        <Card className="bg-slate-900/80 border-slate-800 h-full">
          <CardContent className="p-5">
            <div className="flex items-center space-x-3 mb-4">
              <Skeleton className="w-12 h-12 rounded-lg bg-slate-800" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28 bg-slate-800" />
                <Skeleton className="h-3 w-20 bg-slate-800" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-full bg-slate-800 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-2 w-full bg-slate-800 rounded-full" />
              <Skeleton className="h-2 w-full bg-slate-800 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = app.stats
  const details = app.details
  const statusBadgeProps = getStatusBadgeProps(app.status)

  return (
    <motion.div
      ref={ref}
      variants={staggerItem}
      initial="initial"
      animate="animate"
      whileHover="hover"
    >
      <motion.div variants={cardHover} initial="rest" whileHover="hover">
        <Card className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-colors duration-200 group">
          <CardContent className="p-5">
            {/* Header: icon + name + expand toggle */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {app.iconType === 'image' && !failedIcon ? (
                  <img
                    src={resolvedIcon || app.icon}
                    alt={app.name}
                    className="w-10 h-10 object-contain flex-shrink-0 rounded"
                    onError={(e) => {
                      if (app.fallback && e.target.src === app.icon && !resolvedIcon) {
                        e.target.src = app.fallback
                      } else {
                        setFailedIcons(prev => new Set(prev).add(app.id))
                      }
                    }}
                  />
                ) : null}
                <div className={cn('text-3xl flex-shrink-0', app.iconType === 'image' && !failedIcon ? 'hidden' : '')}>
                  {app.iconType === 'emoji' ? app.icon : '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-100 truncate text-sm leading-tight">{app.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{app.category || 'Application'}</p>
                  {details?.image && (
                    <p className="text-xs text-slate-600 mt-0.5 truncate" title={details.image}>
                      {details.image.split(':')[0]}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleExpand(app.id)}
                className="ml-2 h-7 w-7 text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex-shrink-0"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>

            {/* Status + update badges */}
            <div className="mb-4 flex items-center flex-wrap gap-2">
              <Badge
                variant={statusBadgeProps.variant}
                className={cn('text-xs font-medium border gap-1.5', statusBadgeProps.className)}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', {
                  'bg-emerald-400': app.status === 'running',
                  'bg-red-400': app.status === 'stopped',
                  'bg-amber-400': app.status === 'restarting',
                  'bg-slate-400': !['running','stopped','restarting'].includes(app.status),
                })} />
                {app.status}
                {details?.health && app.status === 'running' && (
                  <span className="opacity-70">· {details.health}</span>
                )}
              </Badge>

              {updateStatus === true && (
                <Badge
                  variant="outline"
                  className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer gap-1"
                  onClick={() => onAction(app.id, 'update')}
                  title="Update container"
                >
                  <Download className="w-3 h-3" />
                  Update Available
                </Badge>
              )}
              {checkingUpdate && (
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-500 bg-transparent gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Checking…
                </Badge>
              )}
            </div>

            {/* Resource Usage Stats */}
            {stats && app.status === 'running' && (
              <div className="mb-4 space-y-3">
                {/* CPU */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Cpu className="w-3 h-3" />
                      <span>CPU</span>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {stats.cpu}%{stats.cpuCores > 1 && ` / ${stats.cpuCores * 100}%`}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(stats.cpu / (stats.cpuCores || 1), 100)}
                    className="h-1.5 bg-slate-800 [&>div]:bg-violet-500"
                  />
                </div>

                {/* Memory */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <HardDrive className="w-3 h-3" />
                      <span>Memory</span>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {formatBytes(stats.memory.usage)} / {formatBytes(stats.memory.limit)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(stats.memory.percent, 100)}
                    className="h-1.5 bg-slate-800 [&>div]:bg-blue-500"
                  />
                </div>

                {/* Network I/O */}
                {stats.network && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Network className="w-3 h-3" />
                      <span>Network</span>
                    </div>
                    <div className="text-slate-400 tabular-nums space-x-2">
                      <span>↓ {formatBytes(stats.network.rx)}</span>
                      <span>↑ {formatBytes(stats.network.tx)}</span>
                    </div>
                  </div>
                )}

                {/* Block I/O */}
                {stats.block && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Activity className="w-3 h-3" />
                      <span>Disk I/O</span>
                    </div>
                    <div className="text-slate-400 tabular-nums space-x-2">
                      <span>R: {formatBytes(stats.block.read)}</span>
                      <span>W: {formatBytes(stats.block.write)}</span>
                    </div>
                  </div>
                )}

                {/* PIDs */}
                {stats.pids !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Processes</span>
                    <span className="text-slate-400 tabular-nums">{stats.pids}</span>
                  </div>
                )}
              </div>
            )}

            {/* Expanded Details */}
            {isExpanded && details && (
              <div className="mb-4 space-y-3">
                <Separator className="bg-slate-800" />

                {/* Custom Icon Management */}
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Custom Icon</span>
                    {(() => {
                      const normalized = app.name.toLowerCase()
                        .replace(/[^a-z0-9]/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '')
                        .replace(/sandbox-/g, '')
                        .replace(/saltbox-/g, '')
                        .replace(/sandbox/g, '')
                        .replace(/saltbox/g, '')
                        .trim()
                      const hasCustomIcon = customIcons.has(normalized)
                      return hasCustomIcon && canEditConfig ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onIconDelete(app.id, app.name)}
                          className="h-6 px-2 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      ) : null
                    })()}
                  </div>
                  {canEditConfig ? (
                    <Label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/webp,image/png,image/jpeg,image/jpg,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) onIconUpload(app.id, app.name, file)
                          e.target.value = ''
                        }}
                        disabled={uploadingIcon}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        asChild={false}
                        disabled={uploadingIcon}
                        className="w-full h-8 text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-300 pointer-events-none"
                      >
                        <Upload className="w-3 h-3 mr-1.5" />
                        {uploadingIcon ? 'Uploading…' : 'Upload Icon'}
                      </Button>
                    </Label>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full h-8 text-xs border-slate-800 bg-slate-900/50 text-slate-600"
                    >
                      <Upload className="w-3 h-3 mr-1.5" />
                      Upload Icon
                    </Button>
                  )}
                  <p className="text-xs text-slate-600 mt-2">WebP, PNG, JPEG, or SVG — max 5 MB</p>
                </div>

                {/* Container details */}
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Container ID</span>
                    <span className="text-slate-300 font-mono">{details.shortId}</span>
                  </div>

                  {details.restartCount !== undefined && (
                    <>
                      <Separator className="bg-slate-800/60" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-slate-500">
                          <RotateCcw className="w-3 h-3" />
                          <span>Restarts</span>
                        </div>
                        <span className="text-slate-300 tabular-nums">{details.restartCount}</span>
                      </div>
                    </>
                  )}

                  {details.startedAt && (
                    <>
                      <Separator className="bg-slate-800/60" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>Started</span>
                        </div>
                        <span className="text-slate-300" title={formatDate(details.startedAt)}>
                          {new Date(details.startedAt).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}

                  {details.ports && Object.keys(details.ports).length > 0 && (
                    <>
                      <Separator className="bg-slate-800/60" />
                      <div>
                        <span className="text-slate-500 block mb-1.5">Ports</span>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(details.ports).slice(0, 3).map(([port, config]) => (
                            <Badge
                              key={port}
                              variant="outline"
                              className="text-xs font-mono border-slate-700 text-slate-400 bg-slate-900/50 px-1.5 py-0"
                            >
                              {port} → {config?.[0]?.HostPort || 'N/A'}
                            </Badge>
                          ))}
                          {Object.keys(details.ports).length > 3 && (
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-500 bg-transparent px-1.5 py-0">
                              +{Object.keys(details.ports).length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {details.volumes && details.volumes.length > 0 && (
                    <>
                      <Separator className="bg-slate-800/60" />
                      <div>
                        <span className="text-slate-500 block mb-1.5">Volumes ({details.volumes.length})</span>
                        <div className="space-y-1">
                          {details.volumes.slice(0, 2).map((vol, idx) => (
                            <div key={idx} className="truncate text-slate-400 font-mono" title={vol.source}>
                              {vol.destination}
                            </div>
                          ))}
                          {details.volumes.length > 2 && (
                            <div className="text-slate-600">+{details.volumes.length - 2} more</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              {app.status === 'running' ? (
                <>
                  {canStop && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction(app.id, 'stop')}
                      disabled={actionLoading}
                      className="flex-1 h-8 text-xs border-slate-800 bg-transparent hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-slate-400"
                    >
                      <Square className="w-3 h-3 mr-1.5" />
                      Stop
                    </Button>
                  )}
                  {canRestart && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction(app.id, 'restart')}
                      disabled={actionLoading}
                      className="flex-1 h-8 text-xs border-slate-800 bg-transparent hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 text-slate-400"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Restart
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {canStart && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction(app.id, 'start')}
                      disabled={actionLoading}
                      className="flex-1 h-8 text-xs border-slate-800 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 text-slate-400"
                    >
                      <Play className="w-3 h-3 mr-1.5" />
                      Start
                    </Button>
                  )}
                  {canDelete && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onAction(app.id, 'delete')}
                            disabled={actionLoading}
                            className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Delete container</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </>
              )}

              {onViewLogs && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewLogs({ containerId: app.id, containerName: app.name })}
                        className="h-8 w-8 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">View logs</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {app.url && app.status === 'running' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      >
                        <a href={app.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Open {app.url}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
})

DockerAppCard.displayName = 'DockerAppCard'

// Batch size for icon preloading to avoid overwhelming the browser
const ICON_BATCH_SIZE = 10

const DockerAppsGrid = ({ apps, loading, onRefresh, currentUser }) => {
  const [actionLoading, setActionLoading] = useState({})
  const [expandedApps, setExpandedApps] = useState(new Set())
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'running', 'stopped'
  const [healthFilter, setHealthFilter] = useState('all') // 'all', 'healthy', 'unhealthy'
  const [searchTerm, setSearchTerm] = useState('') // Search by name
  const [sortBy, setSortBy] = useState('alphabetical') // 'alphabetical', 'date'
  const [sortOrder, setSortOrder] = useState('ascending') // 'ascending', 'descending'
  const [updateStatus, setUpdateStatus] = useState({}) // { appId: boolean }
  const [checkingUpdates, setCheckingUpdates] = useState(new Set())
  const checkedAppsRef = useRef(new Set()) // Track which apps have been checked
  const [failedIcons, setFailedIcons] = useState(new Set()) // Track which app icons failed to load
  const [resolvedIcons, setResolvedIcons] = useState({}) // Track which icon URL successfully loaded for each app
  const loadingIconsRef = useRef(new Set()) // Track which icons are currently being loaded to prevent duplicates
  const [customIcons, setCustomIcons] = useState(new Set()) // Track which apps have custom icons
  const [uploadingIcons, setUploadingIcons] = useState({}) // Track which apps are uploading icons
  const [viewingLogs, setViewingLogs] = useState(null) // { containerId, containerName }

  // Helper function to preload an image and return a promise
  const preloadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(url)
      img.onerror = () => reject(new Error(`Failed to load ${url}`))
      img.src = url
    })
  }

  // Preload icon URLs in batches to avoid a browser request storm
  useEffect(() => {
    const loadIcons = async () => {
      const appsToLoad = apps.filter(app =>
        app.iconType === 'image' &&
        app.fallback &&
        !resolvedIcons[app.id] &&
        !failedIcons.has(app.id) &&
        !loadingIconsRef.current.has(app.id) // Don't load if already loading
      )

      if (appsToLoad.length === 0) return

      // Process in batches with a small delay between batches
      for (let i = 0; i < appsToLoad.length; i += ICON_BATCH_SIZE) {
        const batch = appsToLoad.slice(i, i + ICON_BATCH_SIZE)

        batch.forEach(app => {
          loadingIconsRef.current.add(app.id) // Mark as loading

          const primaryPromise = preloadImage(app.icon).catch(() => null)
          const fallbackPromise = preloadImage(app.fallback).catch(() => null)

          Promise.race([primaryPromise, fallbackPromise])
            .then(loadedUrl => {
              if (loadedUrl) {
                setResolvedIcons(prev => ({ ...prev, [app.id]: loadedUrl }))
              } else {
                Promise.allSettled([
                  preloadImage(app.icon),
                  preloadImage(app.fallback)
                ]).then(results => {
                  const allFailed = results.every(r => r.status === 'rejected')
                  if (allFailed) {
                    setFailedIcons(prev => new Set(prev).add(app.id))
                  }
                })
              }
              loadingIconsRef.current.delete(app.id)
            })
            .catch(() => {
              Promise.allSettled([
                preloadImage(app.icon),
                preloadImage(app.fallback)
              ]).then(results => {
                const allFailed = results.every(r => r.status === 'rejected')
                if (allFailed) {
                  setFailedIcons(prev => new Set(prev).add(app.id))
                }
                loadingIconsRef.current.delete(app.id)
              })
            })
        })

        // Wait 50ms between batches (skip delay after last batch)
        if (i + ICON_BATCH_SIZE < appsToLoad.length) {
          await new Promise(r => setTimeout(r, 50))
        }
      }
    }

    if (apps.length > 0) {
      loadIcons()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps])

  const filteredAndSortedApps = useMemo(() => {
    let filtered = (apps || []).filter(app => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const nameMatch = app.name.toLowerCase().includes(searchLower)
        const imageMatch = app.details?.image?.toLowerCase().includes(searchLower)
        if (!nameMatch && !imageMatch) return false
      }

      if (statusFilter === 'running' && app.status !== 'running') return false
      if (statusFilter === 'stopped' && app.status === 'running') return false

      if (healthFilter === 'healthy' && app.status === 'running') {
        if (app.details?.health !== 'healthy') return false
      }
      if (healthFilter === 'unhealthy' && app.status === 'running') {
        if (app.details?.health !== 'unhealthy') return false
      }

      return true
    })

    filtered = [...filtered].sort((a, b) => {
      let comparison = 0

      if (sortBy === 'alphabetical') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy === 'date') {
        const dateA = a.details?.startedAt || a.details?.created || 0
        const dateB = b.details?.startedAt || b.details?.created || 0
        comparison = new Date(dateA) - new Date(dateB)
      } else if (sortBy === 'cpu') {
        const cpuA = a.stats?.cpu ?? -1
        const cpuB = b.stats?.cpu ?? -1
        comparison = cpuA - cpuB
      } else if (sortBy === 'memory') {
        const memA = a.stats?.memory?.usage ?? -1
        const memB = b.stats?.memory?.usage ?? -1
        comparison = memA - memB
      }

      return sortOrder === 'ascending' ? comparison : -comparison
    })

    return filtered
  }, [apps, statusFilter, healthFilter, searchTerm, sortBy, sortOrder])

  const toggleExpand = useCallback((appId) => {
    setExpandedApps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(appId)) {
        newSet.delete(appId)
      } else {
        newSet.add(appId)
      }
      return newSet
    })
  }, [])

  // Check which apps have custom icons
  useEffect(() => {
    const checkCustomIcons = async () => {
      try {
        const response = await fetch('/api/icons/custom/list', {
          credentials: 'include'
        })
        if (response.ok) {
          const data = await response.json()
          const customIconNames = new Set(data.icons.map(icon => icon.name))
          setCustomIcons(customIconNames)
        }
      } catch (error) {
        console.error('Error fetching custom icons:', error)
      }
    }
    checkCustomIcons()
  }, [])

  const canEditConfig = currentUser?.permissions?.includes('config:edit')

  // Handle icon upload
  const handleIconUpload = useCallback(async (appId, appName, file) => {
    if (!file) return

    if (!canEditConfig) {
      alert('You do not have permission to upload icons')
      return
    }

    setUploadingIcons(prev => ({ ...prev, [appId]: true }))

    try {
      const formData = new FormData()
      formData.append('icon', file)
      formData.append('appName', appName)

      const response = await fetch('/api/icons/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (response.ok) {
        const normalized = appName.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .replace(/sandbox-/g, '')
          .replace(/saltbox-/g, '')
          .replace(/sandbox/g, '')
          .replace(/saltbox/g, '')
          .trim()
        setCustomIcons(prev => new Set(prev).add(normalized))

        setResolvedIcons(prev => {
          const newState = { ...prev }
          delete newState[appId]
          return newState
        })
        setFailedIcons(prev => {
          const newSet = new Set(prev)
          newSet.delete(appId)
          return newSet
        })
        loadingIconsRef.current.delete(appId)

        if (onRefresh) onRefresh()
      } else {
        let errorMessage = 'Unknown error'
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        if (response.status === 403) {
          alert('You do not have permission to upload icons')
        } else {
          alert(`Failed to upload icon: ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error uploading icon:', error)
      alert(`Failed to upload icon: ${error.message || 'Unknown error'}`)
    } finally {
      setUploadingIcons(prev => {
        const newState = { ...prev }
        delete newState[appId]
        return newState
      })
    }
  }, [canEditConfig, onRefresh])

  // Handle icon delete
  const handleIconDelete = useCallback(async (appId, appName) => {
    if (!canEditConfig) {
      alert('You do not have permission to delete icons')
      return
    }

    if (!confirm(`Delete custom icon for ${appName}?`)) return

    try {
      const response = await fetch(`/api/icons/custom/${appName}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        const normalized = appName.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .replace(/sandbox-/g, '')
          .replace(/saltbox-/g, '')
          .replace(/sandbox/g, '')
          .replace(/saltbox/g, '')
          .trim()
        setCustomIcons(prev => {
          const newSet = new Set(prev)
          newSet.delete(normalized)
          return newSet
        })

        setResolvedIcons(prev => {
          const newState = { ...prev }
          delete newState[appId]
          return newState
        })
        setFailedIcons(prev => {
          const newSet = new Set(prev)
          newSet.delete(appId)
          return newSet
        })
        loadingIconsRef.current.delete(appId)

        if (onRefresh) onRefresh()
      } else {
        const error = await response.json()
        if (response.status === 403) {
          alert('You do not have permission to delete icons')
        } else {
          alert(`Failed to delete icon: ${error.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error('Error deleting icon:', error)
      alert('Failed to delete icon')
    }
  }, [canEditConfig, onRefresh])

  const checkForUpdate = useCallback(async (appId) => {
    setCheckingUpdates(prev => {
      if (prev.has(appId)) return prev
      return new Set(prev).add(appId)
    })

    try {
      const response = await fetch(`/api/docker/${appId}/update-check`)
      if (response.ok) {
        const data = await response.json()
        setUpdateStatus(prev => ({
          ...prev,
          [appId]: data.updateAvailable
        }))
      }
    } catch (error) {
      console.error(`Failed to check for updates for ${appId}:`, error)
    } finally {
      setCheckingUpdates(prev => {
        const newSet = new Set(prev)
        newSet.delete(appId)
        return newSet
      })
    }
  }, [])

  // Check for updates lazily - only check a few containers at a time, with delays
  useEffect(() => {
    if (!apps || apps.length === 0) return

    const runningApps = apps.filter(app => app.status === 'running').slice(0, 5)

    runningApps.forEach((app, index) => {
      if (checkedAppsRef.current.has(app.id)) return
      checkedAppsRef.current.add(app.id)

      setTimeout(() => {
        checkForUpdate(app.id)
      }, 3000 + (index * 3000))
    })
  }, [apps?.length, checkForUpdate])

  const canStart = currentUser?.permissions?.includes('docker:start')
  const canStop = currentUser?.permissions?.includes('docker:stop')
  const canRestart = currentUser?.permissions?.includes('docker:restart')
  const canDelete = currentUser?.permissions?.includes('docker:delete')
  const canUpdate = currentUser?.permissions?.includes('docker:update') ||
                    (currentUser?.permissions?.includes('saltbox:execute') && currentUser?.permissions?.includes('docker:restart'))

  const handleAction = useCallback(async (appId, action) => {
    if (action === 'start' && !canStart) {
      alert('You do not have permission to start containers')
      return
    }
    if (action === 'stop' && !canStop) {
      alert('You do not have permission to stop containers')
      return
    }
    if (action === 'restart' && !canRestart) {
      alert('You do not have permission to restart containers')
      return
    }
    if (action === 'update' && !canUpdate) {
      alert('You do not have permission to update containers')
      return
    }
    if (action === 'delete' && !canDelete) {
      alert('You do not have permission to delete containers')
      return
    }
    if (action === 'delete' && !confirm(`Are you sure you want to delete this container? This action cannot be undone.`)) {
      return
    }

    setActionLoading(prev => ({ ...prev, [appId]: true }))
    try {
      const response = await fetch(`/api/docker/${appId}/${action}`, {
        method: 'POST',
        credentials: 'include'
      })
      if (response.ok) {
        setTimeout(() => {
          if (onRefresh) onRefresh()
        }, 1000)
      } else if (response.status === 403) {
        alert('You do not have permission to perform this action')
      }
    } catch (error) {
      console.error(`Failed to ${action} ${appId}:`, error)
    } finally {
      setActionLoading(prev => ({ ...prev, [appId]: false }))
    }
  }, [canStart, canStop, canRestart, canUpdate, canDelete, onRefresh])

  const handleViewLogs = useCallback((logInfo) => {
    setViewingLogs(logInfo)
  }, [])

  const canViewLogs = currentUser?.permissions?.includes('docker:view')

  // Loading skeleton
  if (loading && filteredAndSortedApps.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="bg-slate-900/80 border-slate-800">
                <CardContent className="p-5">
                  <div className="flex items-center space-x-3 mb-4">
                    <Skeleton className="w-10 h-10 rounded-lg bg-slate-800" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-28 bg-slate-800" />
                      <Skeleton className="h-3 w-20 bg-slate-800" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full bg-slate-800 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-2 w-full bg-slate-800 rounded-full" />
                    <Skeleton className="h-2 w-full bg-slate-800 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header + Filter bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 tracking-tight">Docker Applications</h2>
            <p className="text-sm text-slate-500 mt-0.5">Monitor and manage your containerized applications</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-100 tabular-nums">{filteredAndSortedApps.length}</div>
              <div className="text-xs text-slate-500">
                {filteredAndSortedApps.length === (apps || []).length
                  ? 'containers'
                  : `of ${(apps || []).length} containers`}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="border-slate-700 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator className="bg-slate-800 mb-5" />

        {/* Filter / Sort row */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-[130px] border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900 text-slate-300">
              <SelectItem value="all" className="text-xs focus:bg-slate-800 focus:text-slate-100">All Status</SelectItem>
              <SelectItem value="running" className="text-xs focus:bg-slate-800 focus:text-slate-100">Running</SelectItem>
              <SelectItem value="stopped" className="text-xs focus:bg-slate-800 focus:text-slate-100">Stopped</SelectItem>
            </SelectContent>
          </Select>

          {/* Health filter */}
          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-[130px] border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800">
              <SelectValue placeholder="All Health" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900 text-slate-300">
              <SelectItem value="all" className="text-xs focus:bg-slate-800 focus:text-slate-100">All Health</SelectItem>
              <SelectItem value="healthy" className="text-xs focus:bg-slate-800 focus:text-slate-100">Healthy</SelectItem>
              <SelectItem value="unhealthy" className="text-xs focus:bg-slate-800 focus:text-slate-100">Unhealthy</SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="flex-1 min-w-[160px]">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search containers…"
              className="h-8 text-xs border-slate-700 bg-slate-900 text-slate-300 placeholder:text-slate-600 focus-visible:ring-0 focus-visible:border-slate-600"
            />
          </div>

          {/* Sort by */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-[140px] border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900 text-slate-300">
              <SelectItem value="alphabetical" className="text-xs focus:bg-slate-800 focus:text-slate-100">Alphabetical</SelectItem>
              <SelectItem value="date" className="text-xs focus:bg-slate-800 focus:text-slate-100">Date</SelectItem>
              <SelectItem value="cpu" className="text-xs focus:bg-slate-800 focus:text-slate-100">CPU Usage</SelectItem>
              <SelectItem value="memory" className="text-xs focus:bg-slate-800 focus:text-slate-100">Memory Usage</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort order toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'ascending' ? 'descending' : 'ascending')}
            className="h-8 px-2.5 border-slate-700 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            title={`Sort ${sortOrder === 'ascending' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'ascending' ? (
              <ArrowUp className="w-3.5 h-3.5" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Cards grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {filteredAndSortedApps.map((app) => (
          <DockerAppCard
            key={app.id}
            app={app}
            isExpanded={expandedApps.has(app.id)}
            onToggleExpand={toggleExpand}
            actionLoading={actionLoading[app.id]}
            onAction={handleAction}
            resolvedIcon={resolvedIcons[app.id]}
            failedIcon={failedIcons.has(app.id)}
            customIcons={customIcons}
            canEditConfig={canEditConfig}
            canStop={canStop}
            canStart={canStart}
            canRestart={canRestart}
            canDelete={canDelete}
            onIconUpload={handleIconUpload}
            onIconDelete={handleIconDelete}
            uploadingIcon={uploadingIcons[app.id]}
            onViewLogs={canViewLogs ? handleViewLogs : null}
            updateStatus={updateStatus[app.id]}
            checkingUpdate={checkingUpdates.has(app.id)}
            setFailedIcons={setFailedIcons}
          />
        ))}
      </motion.div>

      {viewingLogs && (
        <DockerLogViewer
          containerId={viewingLogs.containerId}
          containerName={viewingLogs.containerName}
          onClose={() => setViewingLogs(null)}
        />
      )}
    </div>
  )
}

export default DockerAppsGrid
