import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, Package, Download, Check, X, Github, FileText, Home, Plus, Filter, Container } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Skeleton } from './ui/skeleton'
import { Dialog, DialogContent } from './ui/dialog'
import { cn } from '../lib/utils'
import { staggerContainer, staggerItem, scaleIn } from '../lib/animations'

const DescriptionText = ({ description, appName, isExpanded, onToggle }) => {
  const textRef = useRef(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    if (textRef.current && !isExpanded) {
      setIsTruncated(textRef.current.scrollHeight > textRef.current.clientHeight)
    } else {
      setIsTruncated(false)
    }
  }, [description, isExpanded])

  return (
    <div className="mb-4 flex-grow text-center">
      <p
        ref={textRef}
        className={cn('text-sm text-slate-400', !isExpanded && 'line-clamp-3')}
        title={isExpanded ? undefined : description}
      >
        {description}
      </p>
      {(isTruncated || isExpanded) && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          className="text-xs text-violet-400 hover:text-violet-300 mt-1 transition-colors"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

const AppStore = ({ onInstall, currentUser }) => {
  const [apps, setApps] = useState({ saltbox: [], sandbox: [] })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all') // source: all | saltbox | sandbox
  const [selectedTaxCat, setSelectedTaxCat] = useState('all') // docs category
  const [categoryTree, setCategoryTree] = useState({})
  const [appCategoryMap, setAppCategoryMap] = useState({})
  const [systemTags, setSystemTags] = useState(new Set())
  const [installing, setInstalling] = useState({})
  const [appIcons, setAppIcons] = useState({})
  const [appDescriptions, setAppDescriptions] = useState({})
  const [failedIcons, setFailedIcons] = useState(new Set())
  const [resolvedIcons, setResolvedIcons] = useState({})
  const [installedApps, setInstalledApps] = useState({})
  const [showInstanceModal, setShowInstanceModal] = useState(null)
  const [instanceName, setInstanceName] = useState('')
  const [expandedDescriptions, setExpandedDescriptions] = useState(new Set())
  const loadedAppsRef = useRef(new Set())
  const observerRef = useRef(null)

  useEffect(() => { fetchApps(); fetchCategories() }, [])

  // Alnum-only normalization, mirrors server.js so docs display names match sb tags.
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/saltbox/categories', { credentials: 'include' })
      if (!res.ok) return
      const { tree = {}, system = [] } = await res.json()
      setCategoryTree(tree)
      setSystemTags(new Set(system))
      const map = {}
      for (const [cat, subs] of Object.entries(tree))
        for (const keys of Object.values(subs))
          for (const k of keys) map[k] = cat
      setAppCategoryMap(map)
    } catch (e) {
      console.error('Failed to fetch categories:', e)
    }
  }

  const allApps = useMemo(() => {
    const cat = (name) => appCategoryMap[norm(name)] || null
    // Hide system/utility module tags (not installable apps), but never hide a
    // tag that resolves to a real app category.
    const isSystem = (name) => systemTags.has(norm(name)) && !cat(name)
    return [
      ...apps.saltbox.map(name => ({ name, source: 'saltbox', isSandbox: false, category: cat(name) })),
      ...apps.sandbox.map(name => ({ name, source: 'sandbox', isSandbox: true, category: cat(name) })),
    ].filter(app => !isSystem(app.name))
  }, [apps, appCategoryMap, systemTags])

  useEffect(() => {
    if (allApps.length === 0) return
    const checkInstalled = async () => {
      try {
        const response = await fetch('/api/saltbox/apps/check-installed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ apps: allApps.map(app => ({ name: app.name, isSandbox: app.isSandbox })) })
        })
        if (response.ok) setInstalledApps(await response.json())
      } catch (error) {
        console.error('Failed to check installed apps:', error)
      }
    }
    checkInstalled()
  }, [allApps])

  const fetchApps = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/saltbox/apps', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setApps(data)
      }
    } catch (error) {
      console.error('Failed to fetch apps:', error)
    } finally {
      setLoading(false)
    }
  }

  const canInstall = currentUser?.permissions?.includes('appstore:install')

  const handleInstall = async (appName, isSandbox = false, instName = null) => {
    if (!canInstall) { alert('You do not have permission to install apps'); return }

    const baseAppName = isSandbox ? `sandbox-${appName}` : appName
    const trackingName = instName ? `${baseAppName}-${instName}` : baseAppName

    setInstalling(prev => ({ ...prev, [trackingName]: true }))

    try {
      let command
      if (instName) {
        const response = await fetch('/api/saltbox/create-instance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ appName: baseAppName, instanceName: instName })
        })
        if (!response.ok) {
          const error = await response.json()
          alert(`Failed to create instance: ${error.error || 'Unknown error'}`)
          return
        }
        command = `sb install ${baseAppName} -e ${appName}_name=${instName}`
      } else {
        command = `sb install ${baseAppName}`
      }

      const response = await fetch('/api/saltbox/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command }),
      })

      if (response.ok) {
        if (onInstall) onInstall()
        setShowInstanceModal(null)
        setInstanceName('')
        const checkResponse = await fetch('/api/saltbox/apps/check-installed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ apps: allApps.map(app => ({ name: app.name, isSandbox: app.isSandbox })) })
        })
        if (checkResponse.ok) setInstalledApps(await checkResponse.json())
      } else if (response.status === 403) {
        alert('You do not have permission to install apps')
      }
    } catch (error) {
      console.error(`Failed to install ${trackingName}:`, error)
      alert(`Failed to install: ${error.message}`)
    } finally {
      setInstalling(prev => ({ ...prev, [trackingName]: false }))
    }
  }

  const filteredApps = useMemo(() => allApps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSource = selectedCategory === 'all' || app.source === selectedCategory
    const matchesTaxCat = selectedTaxCat === 'all'
      || (selectedTaxCat === 'Other' ? !app.category : app.category === selectedTaxCat)
    return matchesSearch && matchesSource && matchesTaxCat
  }), [allApps, searchTerm, selectedCategory, selectedTaxCat])

  const fetchIconsBatch = useCallback(async (appNames) => {
    if (appNames.length === 0) return
    const appsToFetch = appNames.filter(name => !loadedAppsRef.current.has(`icon-${name}`))
    if (appsToFetch.length === 0) return
    try {
      const response = await fetch('/api/icons/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appNames: appsToFetch })
      })
      if (response.ok) {
        const icons = await response.json()
        const newIcons = {}
        const newResolvedIcons = {}
        Object.entries(icons).forEach(([appName, iconData]) => {
          loadedAppsRef.current.add(`icon-${appName}`)
          newIcons[appName] = iconData
          if (iconData.type === 'image') {
            const isLocalIcon = iconData.icon && iconData.icon.startsWith('/icons/custom/')
            if (isLocalIcon) {
              newResolvedIcons[appName] = iconData.icon
            } else if (iconData.fallback) {
              const primaryPromise = new Promise((resolve, reject) => {
                const img = new Image(); img.onload = () => resolve(iconData.icon); img.onerror = () => reject(new Error('Failed')); img.src = iconData.icon
              })
              const fallbackPromise = new Promise((resolve, reject) => {
                const img = new Image(); img.onload = () => resolve(iconData.fallback); img.onerror = () => reject(new Error('Failed')); img.src = iconData.fallback
              })
              Promise.race([primaryPromise, fallbackPromise])
                .then(loadedUrl => setResolvedIcons(prev => ({ ...prev, [appName]: loadedUrl })))
                .catch(() => Promise.allSettled([primaryPromise, fallbackPromise]).then(results => {
                  if (results.every(r => r.status === 'rejected')) setFailedIcons(prev => new Set(prev).add(appName))
                }))
            } else {
              newResolvedIcons[appName] = iconData.icon
            }
          }
        })
        setAppIcons(prev => ({ ...prev, ...newIcons }))
        setResolvedIcons(prev => ({ ...prev, ...newResolvedIcons }))
      }
    } catch (error) {
      console.error('Failed to fetch batch icons:', error)
    }
  }, [])

  const fetchDescriptionsBatch = useCallback(async (appsToLoad) => {
    if (appsToLoad.length === 0) return
    const appsToFetch = appsToLoad.filter(app => !loadedAppsRef.current.has(`desc-${app.name}`))
    if (appsToFetch.length === 0) return
    try {
      const response = await fetch('/api/appstore/descriptions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apps: appsToFetch.map(app => ({ name: app.name, isSandbox: app.isSandbox })) })
      })
      if (response.ok) {
        const descriptions = await response.json()
        appsToFetch.forEach(app => loadedAppsRef.current.add(`desc-${app.name}`))
        setAppDescriptions(prev => ({ ...prev, ...descriptions }))
      }
    } catch (error) {
      console.error('Failed to fetch batch descriptions:', error)
    }
  }, [])

  useEffect(() => {
    if (allApps.length === 0) return
    fetchIconsBatch(allApps.map(app => app.name))
  }, [allApps, fetchIconsBatch])

  useEffect(() => {
    if (filteredApps.length === 0) return
    loadedAppsRef.current.clear()
    fetchDescriptionsBatch(filteredApps.slice(0, 20))
    const observer = new IntersectionObserver((entries) => {
      const visibleApps = []
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const app = filteredApps.find(a => a.name === entry.target.dataset.appName)
          if (app) visibleApps.push(app)
        }
      })
      if (visibleApps.length > 0) fetchDescriptionsBatch(visibleApps)
    }, { root: null, rootMargin: '200px', threshold: 0.01 })
    observerRef.current = observer
    const timeoutId = setTimeout(() => {
      document.querySelectorAll('[data-app-name]').forEach(card => observer.observe(card))
    }, 100)
    return () => { clearTimeout(timeoutId); observer.disconnect() }
  }, [filteredApps, fetchDescriptionsBatch])

  const getAppIcon = useCallback((name) => {
    const iconInfo = appIcons[name]
    if (iconInfo && iconInfo.type === 'image' && !failedIcons.has(name)) {
      return { type: 'image', src: resolvedIcons[name] || iconInfo.icon, fallback: iconInfo.fallback }
    }
    const lowerName = name.toLowerCase()
    if (lowerName.includes('plex')) return { type: 'emoji', emoji: '🎬' }
    if (lowerName.includes('sonarr')) return { type: 'emoji', emoji: '📺' }
    if (lowerName.includes('radarr')) return { type: 'emoji', emoji: '🎥' }
    if (lowerName.includes('lidarr')) return { type: 'emoji', emoji: '🎵' }
    if (lowerName.includes('readarr')) return { type: 'emoji', emoji: '📚' }
    if (lowerName.includes('qbittorrent') || lowerName.includes('deluge') || lowerName.includes('transmission')) return { type: 'emoji', emoji: '⬇️' }
    if (lowerName.includes('sabnzbd') || lowerName.includes('nzbget')) return { type: 'emoji', emoji: '📥' }
    if (lowerName.includes('overseerr') || lowerName.includes('ombi')) return { type: 'emoji', emoji: '🎭' }
    if (lowerName.includes('tautulli')) return { type: 'emoji', emoji: '📊' }
    if (lowerName.includes('portainer')) return { type: 'emoji', emoji: '🐳' }
    if (lowerName.includes('jellyfin') || lowerName.includes('emby')) return { type: 'emoji', emoji: '📺' }
    return { type: 'emoji', emoji: '📦' }
  }, [appIcons, resolvedIcons, failedIcons])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-14 w-full rounded-xl bg-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl bg-white/5" />)}
        </div>
      </div>
    )
  }

  const filterButtons = [
    { id: 'all', label: `All (${allApps.length})`, activeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/40' },
    { id: 'saltbox', label: `Saltbox (${apps.saltbox.length})`, activeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
    { id: 'sandbox', label: `Sandbox (${apps.sandbox.length})`, activeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/40' },
  ]

  const taxCatButtons = useMemo(() => {
    const counts = {}
    for (const app of allApps) {
      const key = app.category || 'Other'
      counts[key] = (counts[key] || 0) + 1
    }
    const cats = Object.keys(categoryTree)
    const buttons = [{ id: 'all', label: `All categories (${allApps.length})` }]
    for (const c of cats) if (counts[c]) buttons.push({ id: c, label: `${c} (${counts[c]})` })
    if (counts['Other']) buttons.push({ id: 'Other', label: `Other (${counts['Other']})` })
    return buttons
  }, [allApps, categoryTree])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-1">App Store</h2>
          <p className="text-sm text-slate-500">
            {filteredApps.length} app{filteredApps.length !== 1 ? 's' : ''} available
            {searchTerm && ` · ${filteredApps.length} result${filteredApps.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </p>
        </div>
        <Button variant="outline" onClick={fetchApps} className="self-start sm:self-auto border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-slate-100">
          <Download className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="mb-8 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search apps by name..."
            className="pl-11 pr-4 py-4 sm:py-5 text-base bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500/30 focus-visible:border-violet-500/50 rounded-xl"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filter:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterButtons.map(({ id, label, activeClass }) => (
              <button
                key={id}
                onClick={() => setSelectedCategory(id)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                  selectedCategory === id
                    ? activeClass
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:bg-white/8'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {taxCatButtons.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {taxCatButtons.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedTaxCat(id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  selectedTaxCat === id
                    ? 'bg-violet-500/15 text-violet-300 border-violet-500/40'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:bg-white/8'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No apps found</p>
          <p className="text-slate-600 text-sm mt-1">Try adjusting your filters or search terms</p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5"
        >
          {filteredApps.map((app) => {
            const fullName = app.isSandbox ? `sandbox-${app.name}` : app.name
            const isInstalling = installing[fullName]
            const icon = getAppIcon(app.name)
            const description = appDescriptions[app.name]?.description
            const links = appDescriptions[app.name]?.links
            const isInstalled = installedApps[app.name]

            return (
              <motion.div key={fullName} variants={staggerItem} data-app-name={app.name}>
                <Card className="bg-white/4 border-white/8 hover:border-white/15 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 flex flex-col h-full relative group">
                  {isInstalled && (
                    <div className="absolute top-3 right-3 z-10">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shadow-md" title="Installed">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    </div>
                  )}
                  <CardContent className="p-5 flex flex-col flex-1">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {icon.type === 'image' ? (
                          <img src={icon.src} alt={app.name} className="w-10 h-10 object-contain" onError={() => setFailedIcons(prev => new Set(prev).add(app.name))} />
                        ) : (
                          <span className="text-3xl">{icon.emoji || '📦'}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-center">
                        <h3 className="font-semibold text-slate-100 text-sm mb-1.5" title={app.name}>{app.name}</h3>
                        <Badge className={cn(
                          'text-xs font-medium border',
                          app.source === 'saltbox'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        )}>
                          {app.category || app.source}
                        </Badge>
                      </div>
                    </div>

                    {description && (
                      <DescriptionText
                        description={description}
                        appName={app.name}
                        isExpanded={expandedDescriptions.has(app.name)}
                        onToggle={() => {
                          setExpandedDescriptions(prev => {
                            const next = new Set(prev)
                            if (next.has(app.name)) next.delete(app.name)
                            else next.add(app.name)
                            return next
                          })
                        }}
                      />
                    )}

                    {links && (links.projectHome || links.docs || links.github || links.docker) && (
                      <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
                        {links.projectHome && (
                          <a href={links.projectHome} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Project Home"
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center hover:scale-110">
                            <Home className="w-3.5 h-3.5 text-slate-400" />
                          </a>
                        )}
                        {links.docs && (
                          <a href={links.docs} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Documentation"
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center hover:scale-110">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                          </a>
                        )}
                        {links.github && (
                          <a href={links.github} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="GitHub"
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center hover:scale-110">
                            <Github className="w-3.5 h-3.5 text-slate-400" />
                          </a>
                        )}
                        {links.docker && (
                          <a href={links.docker} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Docker Hub"
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center hover:scale-110">
                            <Container className="w-3.5 h-3.5 text-slate-400" />
                          </a>
                        )}
                      </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-white/6">
                      {canInstall ? (
                        isInstalled ? (
                          <Button
                            variant="outline"
                            onClick={() => setShowInstanceModal({ appName: app.name, isSandbox: app.isSandbox })}
                            disabled={isInstalling}
                            className="w-full border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20 text-sm"
                          >
                            <Plus className="w-3.5 h-3.5 mr-2" />
                            Install Another Instance
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => handleInstall(app.name, app.isSandbox)}
                            disabled={isInstalling}
                            className="w-full border-white/10 bg-white/5 text-slate-300 hover:bg-violet-500/15 hover:border-violet-500/40 hover:text-violet-300 text-sm transition-all"
                          >
                            {isInstalling ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mr-2" />
                                Installing...
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5 mr-2" />
                                Install
                              </>
                            )}
                          </Button>
                        )
                      ) : (
                        <Button disabled className="w-full border-white/8 bg-white/3 text-slate-500 text-sm cursor-not-allowed opacity-60" title="You do not have permission to install apps">
                          <Download className="w-3.5 h-3.5 mr-2" />
                          Install
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Instance Modal */}
      <Dialog open={!!showInstanceModal} onOpenChange={(open) => { if (!open) { setShowInstanceModal(null); setInstanceName('') } }}>
        <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-md w-full">
          <motion.div {...scaleIn} className="bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-100">Install Another Instance</h3>
              <Button variant="ghost" size="icon" onClick={() => { setShowInstanceModal(null); setInstanceName('') }} className="h-8 w-8 text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Enter a name for the new instance of{' '}
              <span className="font-semibold text-slate-200">{showInstanceModal?.appName}</span>
            </p>
            <Input
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder={`New Instance Name (e.g., ${showInstanceModal?.appName}2)`}
              className="mb-4 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500/30 focus-visible:border-violet-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && instanceName.trim()) handleInstall(showInstanceModal.appName, showInstanceModal.isSandbox, instanceName.trim())
              }}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowInstanceModal(null); setInstanceName('') }} className="flex-1 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
                Cancel
              </Button>
              <Button
                onClick={() => { if (instanceName.trim()) handleInstall(showInstanceModal.appName, showInstanceModal.isSandbox, instanceName.trim()) }}
                disabled={!instanceName.trim() || installing[`${showInstanceModal?.isSandbox ? 'sandbox-' : ''}${showInstanceModal?.appName}-${instanceName}`]}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white border-0 disabled:opacity-50"
              >
                {installing[`${showInstanceModal?.isSandbox ? 'sandbox-' : ''}${showInstanceModal?.appName}-${instanceName}`] ? 'Installing...' : 'Install'}
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AppStore
