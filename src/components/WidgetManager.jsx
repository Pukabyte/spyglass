import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Search, Loader2, Server, ChevronDown, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAvailableWidgets, getWidgetConfig } from './widgets/widgets'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { ScrollArea } from './ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { cn } from '../lib/utils'
import { fadeIn, staggerContainer, staggerItem } from '../lib/animations'

// Helper to convert widget name to display label
const formatWidgetLabel = (name) => {
  const specialCases = {
    'npm': 'Nginx Proxy Manager',
    'pihole': 'Pi-hole',
    'pfsense': 'pfSense',
    'opnsense': 'OPNsense',
    'qbittorrent': 'qBittorrent',
    'nzbget': 'NZBGet',
    'nzbdav': 'NZBDav',
    'sabnzbd': 'SABnzbd',
    'homeassistant': 'Home Assistant',
    'proxmoxbackupserver': 'Proxmox Backup Server',
    'uptimekuma': 'Uptime Kuma',
    'changedetectionio': 'changedetection.io',
    'develancacheui': 'LANCache',
    'openmediavault': 'OpenMediaVault',
    'adguard': 'AdGuard Home',
    'nextdns': 'NextDNS',
    'paperlessngx': 'Paperless-ngx',
    'freshrss': 'FreshRSS',
    'calibreweb': 'Calibre-Web',
    'audiobookshelf': 'Audiobookshelf',
    'tubearchivist': 'TubeArchivist',
    'yourspotify': 'Your Spotify',
    'channelsdvrserver': 'Channels DVR',
    'hdhomerun': 'HDHomeRun',
    'truenas': 'TrueNAS',
    'diskstation': 'Synology DSM',
    'downloadstation': 'Download Station',
    'customapi': 'Custom API',
    'prometheusmetric': 'Prometheus Metric',
    'wgeasy': 'WireGuard Easy',
    'whatsupdocker': "What's Up Docker",
    'server-stats': 'Server Stats',
  }

  if (specialCases[name]) return specialCases[name]

  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

const widgetCategories = {
  'Media': ['plex', 'jellyfin', 'emby', 'navidrome', 'tautulli', 'stash'],
  'Requests': ['overseerr', 'jellyseerr', 'ombi'],
  'Downloads': ['sabnzbd', 'nzbget', 'nzbdav', 'qbittorrent', 'transmission', 'deluge', 'flood', 'rutorrent', 'pyload', 'jdownloader', 'decypharr'],
  'Media Management': ['sonarr', 'radarr', 'lidarr', 'readarr', 'prowlarr', 'bazarr', 'mylar', 'medusa'],
  'Books & Reading': ['audiobookshelf', 'calibreweb', 'kavita', 'komga'],
  'DNS & Network': ['pihole', 'adguard', 'nextdns', 'traefik', 'npm', 'cloudflared', 'tailscale', 'headscale', 'gluetun', 'wgeasy'],
  'Monitoring': ['uptimekuma', 'uptimerobot', 'glances', 'netdata', 'grafana', 'prometheus', 'speedtest', 'scrutiny', 'healthchecks', 'gatus', 'beszel'],
  'Infrastructure': ['portainer', 'proxmox', 'proxmoxbackupserver', 'truenas', 'unraid', 'watchtower', 'whatsupdocker', 'docker'],
  'Home Automation': ['homeassistant', 'homebridge', 'esphome', 'evcc', 'opendtu', 'moonraker'],
  'Photos & Files': ['immich', 'photoprism', 'filebrowser', 'nextcloud', 'paperlessngx', 'homebox'],
  'Other': [],
}

const WidgetManager = ({ dockerApps, onWidgetAdded, categories, currentUser }) => {
  const canCreate = currentUser?.permissions?.includes('widget:create')
  const [showModal, setShowModal] = useState(false)
  const [selectedApp, setSelectedApp] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [widgetConfig, setWidgetConfig] = useState({
    appName: '',
    containerId: '',
    url: '',
    token: '',
    apiEndpoint: '',
    title: '',
    username: '',
    password: '',
    categoryId: '__uncategorized__',
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const isSystemWidget = (name) => {
    const config = getWidgetConfig(name)
    return config?.isSystemWidget === true
  }

  const widgetTypes = useMemo(() => {
    const available = getAvailableWidgets()
    const filtered = available.filter(name =>
      !['ical', 'hoarder', 'pialert', 'unifi_console'].includes(name)
    )
    return filtered
      .map(name => ({
        value: name,
        label: formatWidgetLabel(name),
        isSystem: isSystemWidget(name)
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [])

  const systemWidgets = useMemo(() => widgetTypes.filter(w => w.isSystem), [widgetTypes])
  const appWidgetTypes = useMemo(() => widgetTypes.filter(w => !w.isSystem), [widgetTypes])

  const filteredWidgetTypes = useMemo(() => {
    if (!searchTerm) return appWidgetTypes
    const lower = searchTerm.toLowerCase()
    return appWidgetTypes.filter(t =>
      t.label.toLowerCase().includes(lower) || t.value.toLowerCase().includes(lower)
    )
  }, [appWidgetTypes, searchTerm])

  // Build grouped widget list for display
  const groupedWidgetTypes = useMemo(() => {
    if (searchTerm) {
      return [{ category: 'Results', items: filteredWidgetTypes }]
    }
    const assigned = new Set()
    const groups = []
    for (const [category, values] of Object.entries(widgetCategories)) {
      if (category === 'Other') continue
      const items = appWidgetTypes.filter(w => values.includes(w.value))
      items.forEach(w => assigned.add(w.value))
      if (items.length > 0) {
        groups.push({ category, items })
      }
    }
    const otherItems = appWidgetTypes.filter(w => !assigned.has(w.value))
    if (otherItems.length > 0) {
      groups.push({ category: 'Other', items: otherItems })
    }
    return groups
  }, [appWidgetTypes, filteredWidgetTypes, searchTerm])

  const handleAddSystemWidget = async (widgetType) => {
    setError(null)
    try {
      const response = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          appName: widgetType.value,
          title: widgetType.label,
          isSystemWidget: true,
          categoryId: widgetConfig.categoryId || '__uncategorized__',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          setShowModal(false)
          setSuccess(false)
          if (onWidgetAdded) onWidgetAdded()
        }, 1500)
      } else {
        setError(data.error || 'Failed to create widget')
      }
    } catch (err) {
      setError(`Failed to create widget: ${err.message}`)
    }
  }

  const handleExtractToken = useCallback(async () => {
    if (!selectedApp || !widgetConfig.appName) {
      setError('Please select an app and enter the app name')
      return
    }

    setExtracting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/widgets/extract-token/${selectedApp.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          appName: widgetConfig.appName,
          url: selectedApp.url || widgetConfig.url,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setWidgetConfig(prev => ({
          ...prev,
          token: data.token || prev.token,
          url: data.url || selectedApp.url || prev.url,
          containerId: selectedApp.id,
        }))
        setSuccessMsg('Token extracted successfully!')
        setTimeout(() => setSuccessMsg(null), 3000)
      } else {
        setError(data.error || 'Failed to extract token')
      }
    } catch (err) {
      setError(`Failed to extract token: ${err.message}`)
    } finally {
      setExtracting(false)
    }
  }, [selectedApp, widgetConfig.appName, widgetConfig.url])

  // Auto-extract token when app + widget type both resolved
  useEffect(() => {
    if (selectedApp && widgetConfig.appName && !widgetConfig.token && !extracting) {
      handleExtractToken()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp?.id, widgetConfig.appName])

  const handleCreateWidget = async () => {
    if (!widgetConfig.appName || !widgetConfig.url) {
      setError('Please fill in app name and URL')
      return
    }
    if (!widgetConfig.token && !widgetConfig.username && !widgetConfig.password) {
      const noAuthWidgets = ['iframe', 'calendar', 'mjpeg', 'customapi', 'gamedig', 'minecraft',
        'speedtest', 'server-stats', 'esphome', 'opendtu', 'uptimekuma', 'glances', 'fritzbox']
      if (!noAuthWidgets.includes(widgetConfig.appName?.toLowerCase())) {
        setError('Please provide an API token or username/password for authentication')
        return
      }
    }

    setError(null)

    try {
      const response = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          appName: widgetConfig.appName,
          containerId: widgetConfig.containerId,
          url: widgetConfig.url,
          token: widgetConfig.token,
          apiEndpoint: widgetConfig.apiEndpoint || widgetConfig.url,
          title: widgetConfig.title || widgetConfig.appName,
          username: widgetConfig.username || undefined,
          password: widgetConfig.password || undefined,
          categoryId: widgetConfig.categoryId || '__uncategorized__',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setWidgetConfig({
          appName: '',
          containerId: '',
          url: '',
          token: '',
          apiEndpoint: '',
          title: '',
          username: '',
          password: '',
          categoryId: '__uncategorized__',
        })
        setSelectedApp(null)
        setTimeout(() => {
          setShowModal(false)
          setSuccess(false)
          if (onWidgetAdded) onWidgetAdded()
        }, 1500)
      } else {
        setError(data.error || 'Failed to create widget')
      }
    } catch (err) {
      setError(`Failed to create widget: ${err.message}`)
    }
  }

  const handleAppSelect = (app) => {
    const containerName = app.name.toLowerCase().replace(/sandbox-|saltbox-/g, '')
    const matchedWidget = appWidgetTypes.find(w =>
      w.value === containerName ||
      containerName.includes(w.value) ||
      w.value.includes(containerName)
    )
    setSelectedApp(app)
    setWidgetConfig(prev => ({
      ...prev,
      appName: matchedWidget?.value || containerName,
      containerId: app.id,
      url: app.url || prev.url,
      title: app.name,
    }))
  }

  const handleClose = () => {
    setShowModal(false)
    setError(null)
    setSuccess(false)
    setShowAdvanced(false)
    setWidgetConfig({
      appName: '',
      containerId: '',
      url: '',
      token: '',
      apiEndpoint: '',
      title: '',
      username: '',
      password: '',
      categoryId: '__uncategorized__',
    })
    setSelectedApp(null)
    setSearchTerm('')
  }

  if (!canCreate) return null

  const app = widgetConfig.appName?.toLowerCase() || ''
  const usernamePasswordApps = ['qbittorrent', 'transmission', 'deluge', 'flood', 'rutorrent',
    'nzbget', 'emby', 'homeassistant', 'portainer', 'proxmox', 'openwrt', 'pihole',
    'nextcloud', 'audiobookshelf', 'calibreweb', 'navidrome', 'komga', 'kavita',
    'mealie', 'freshrss', 'miniflux', 'gitea', 'gitlab', 'urbackup', 'truenas',
    'opnsense', 'pfsense', 'unifi', 'omada', 'mikrotik', 'adguard', 'crowdsec',
    'authentik', 'headscale', 'pyload', 'jdownloader', 'filebrowser', 'photoprism',
    'autoscan']
  const needsUserPass = usernamePasswordApps.includes(app)
  const isEmby = app === 'emby'

  const selectedWidgetType = appWidgetTypes.find(w => w.value === widgetConfig.appName)

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        variant="outline"
        size="sm"
        className="glass border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200 gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Widget
      </Button>

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-slate-100 sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5">
            <DialogTitle className="text-lg font-semibold text-slate-100">Add App Widget</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4 overflow-y-auto">
            <motion.div
              variants={fadeIn}
              initial="initial"
              animate="animate"
              className="space-y-5"
            >
              {/* Status messages */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="destructive" className="w-full justify-start gap-2 py-2.5 px-3 text-sm font-normal rounded-lg">
                      {error}
                    </Badge>
                  </motion.div>
                )}
                {(success || successMsg) && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge className="w-full justify-start gap-2 py-2.5 px-3 text-sm font-normal rounded-lg bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">
                      {successMsg || 'Widget created successfully!'}
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* System Widgets */}
              {systemWidgets.length > 0 && (
                <div className="space-y-2.5">
                  <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">System Widgets</Label>
                  <motion.div
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                    className="flex flex-wrap gap-2"
                  >
                    {systemWidgets.map(widget => (
                      <motion.div key={widget.value} variants={staggerItem}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddSystemWidget(widget)}
                          className="border-white/10 bg-slate-800/50 hover:bg-primary-500/10 hover:border-primary-500/30 text-slate-300 gap-2"
                        >
                          <Server className="w-3.5 h-3.5 text-primary-400" />
                          {widget.label}
                          <Plus className="w-3 h-3 text-slate-500" />
                        </Button>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              )}

              <Separator className="bg-white/5" />

              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">App Widgets</p>

              {/* Docker App Selection */}
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-300">Select Docker App</Label>
                <ScrollArea className="h-44 rounded-lg border border-white/10 bg-slate-800/30">
                  {dockerApps
                    .filter(app => app.status === 'running')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(app => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleAppSelect(app)}
                        className={cn(
                          'w-full text-left px-4 py-2.5 transition-colors border-b border-white/5 last:border-0',
                          selectedApp?.id === app.id
                            ? 'bg-primary-500/15 border-l-2 border-l-primary-400'
                            : 'hover:bg-white/5'
                        )}
                      >
                        <div className="font-medium text-slate-200 text-sm">{app.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{app.url || 'No URL'}</div>
                      </button>
                    ))}
                </ScrollArea>
              </div>

              {/* Widget Type */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-slate-300">
                    Widget Type <span className="text-red-400">*</span>
                    <span className="text-slate-500 font-normal ml-2 text-xs">({appWidgetTypes.length} available)</span>
                  </Label>
                  {selectedWidgetType && (
                    <Badge className="bg-primary-500/15 text-primary-300 border-primary-500/30 hover:bg-primary-500/15 gap-1 text-xs">
                      {selectedWidgetType.label}
                      <button
                        type="button"
                        onClick={() => setWidgetConfig(prev => ({ ...prev, appName: '' }))}
                        className="ml-0.5 hover:text-primary-100 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search widgets..."
                    className="pl-9 bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary-500/50 focus-visible:border-primary-500/50"
                  />
                </div>
                <ScrollArea className="h-52 rounded-lg border border-white/10 bg-slate-800/30">
                  {groupedWidgetTypes.map(({ category, items }) => (
                    <div key={category}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-800/50 sticky top-0">
                        {category}
                      </div>
                      {items.map(type => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setWidgetConfig(prev => ({ ...prev, appName: type.value }))}
                          className={cn(
                            'w-full text-left px-4 py-2 text-sm transition-colors border-b border-white/5 last:border-0',
                            widgetConfig.appName === type.value
                              ? 'bg-primary-500/15 border-l-2 border-l-primary-400 text-primary-200'
                              : 'text-slate-300 hover:bg-white/5'
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </ScrollArea>
              </div>

              {/* Extract Token */}
              <AnimatePresence>
                {selectedApp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      type="button"
                      onClick={handleExtractToken}
                      disabled={extracting || !widgetConfig.appName}
                      variant="outline"
                      className="w-full border-primary-500/30 bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 disabled:opacity-50"
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Extracting Token...
                        </>
                      ) : (
                        'Extract Token from Container'
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              <Separator className="bg-white/5" />

              {/* URL */}
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-300">
                  App URL <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  value={widgetConfig.url}
                  onChange={(e) => setWidgetConfig(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://app.example.com"
                  className="bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary-500/50"
                />
              </div>

              {/* API Token */}
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-300">API Token</Label>
                <Input
                  type="password"
                  value={widgetConfig.token}
                  onChange={(e) => setWidgetConfig(prev => ({ ...prev, token: e.target.value }))}
                  placeholder="Enter API token or extract from container"
                  className="bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary-500/50"
                />
              </div>

              {/* Username/Password */}
              <AnimatePresence>
                {needsUserPass && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-lg border border-white/10 bg-slate-800/20 p-4 space-y-3"
                  >
                    <p className="text-xs text-slate-400">
                      {isEmby
                        ? 'Emby requires user authentication (not just API key) to display Now Playing information.'
                        : 'This app uses username/password authentication. You can use this instead of or in addition to an API token.'}
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-slate-300">Username</Label>
                      <Input
                        type="text"
                        value={widgetConfig.username}
                        onChange={(e) => setWidgetConfig(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="Username"
                        className="bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary-500/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-slate-300">Password</Label>
                      <Input
                        type="password"
                        value={widgetConfig.password}
                        onChange={(e) => setWidgetConfig(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Password"
                        className="bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary-500/50"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Advanced Options */}
              <div className="space-y-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-slate-400 hover:text-slate-200 hover:bg-white/5 px-0 gap-1"
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                  <ChevronDown className={cn('w-3 h-3 ml-1 transition-transform', showAdvanced && 'rotate-180')} />
                </Button>
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 pt-3 overflow-hidden"
                    >
                      {/* API Endpoint */}
                      <div className="space-y-1.5">
                        <Label className="text-sm text-slate-300">API Endpoint <span className="text-slate-500 font-normal text-xs">(Optional)</span></Label>
                        <Input
                          type="text"
                          value={widgetConfig.apiEndpoint}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                          placeholder="Leave empty to use URL"
                          className="bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary-500/50"
                        />
                      </div>

                      {/* Widget Title */}
                      <div className="space-y-1.5">
                        <Label className="text-sm text-slate-300">Widget Title <span className="text-slate-500 font-normal text-xs">(Optional)</span></Label>
                        <Input
                          type="text"
                          value={widgetConfig.title}
                          onChange={(e) => setWidgetConfig(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Display name for the widget"
                          className="bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary-500/50"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Category */}
              {categories && categories.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-300">Category</Label>
                  <Select
                    value={widgetConfig.categoryId}
                    onValueChange={(val) => setWidgetConfig(prev => ({ ...prev, categoryId: val }))}
                  >
                    <SelectTrigger className="bg-slate-800/50 border-white/10 text-slate-100 focus:ring-primary-500/50">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </motion.div>
          </ScrollArea>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-white/5 flex gap-3">
            <Button
              onClick={handleCreateWidget}
              disabled={!widgetConfig.appName || !widgetConfig.url}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50"
            >
              Create Widget
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              className="border-white/10 bg-slate-800/50 hover:bg-white/10 text-slate-300"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default WidgetManager
