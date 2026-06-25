import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertCircle, Folder, FolderOpen, RefreshCw, ArrowUpRight, ChevronRight, Home, Send, CheckCircle2, Clock, Activity } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/card'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { cn } from '../../../lib/utils'

const ROOT = '/mnt'

const brandColor = {
  text: 'text-emerald-400',
}

function normalize(path) {
  if (!path || typeof path !== 'string') return ROOT
  let p = path.trim()
  if (!p.startsWith(ROOT)) return ROOT
  p = p.replace(/\/+/g, '/').replace(/\/$/, '')
  return p || ROOT
}

function timeAgo(iso) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AutoscanWidget({ widget }) {
  const [path, setPath] = useState(ROOT)
  const [pathInput, setPathInput] = useState(ROOT)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [browseError, setBrowseError] = useState(null)
  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [toast, setToast] = useState(null)
  const [iconError, setIconError] = useState(false)

  const browse = useCallback(async (target) => {
    setLoading(true)
    setBrowseError(null)
    try {
      const res = await fetch(`/api/widgets/${widget.id}/autoscan/browse?path=${encodeURIComponent(target)}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setEntries(data.entries || [])
      setPath(data.path || target)
      setPathInput(data.path || target)
    } catch (e) {
      setBrowseError(e.message)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [widget.id])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/widgets/${widget.id}/autoscan/status`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setStatus(await res.json())
      setStatusError(null)
    } catch (e) {
      setStatusError(e.message)
    }
  }, [widget.id])

  useEffect(() => { browse(ROOT) }, [browse])
  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 30000)
    return () => clearInterval(t)
  }, [fetchStatus])

  const triggerScan = async () => {
    if (scanning) return
    setScanning(true)
    setToast(null)
    try {
      const res = await fetch(`/api/widgets/${widget.id}/autoscan/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setToast({ type: 'success', msg: `Scan queued for ${path}` })
      fetchStatus()
    } catch (e) {
      setToast({ type: 'error', msg: e.message })
    } finally {
      setScanning(false)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const filterText = useMemo(() => {
    const trimmed = (pathInput || '').replace(/\/+/g, '/').replace(/\/$/, '')
    const base = path === '/' ? '' : path
    if (!trimmed || trimmed === base) return ''
    if (trimmed.startsWith(base + '/')) return trimmed.slice(base.length + 1).toLowerCase()
    return ''
  }, [pathInput, path])

  const visibleEntries = useMemo(() => {
    if (!filterText) return entries
    return entries.filter(e => e.name.toLowerCase().includes(filterText))
  }, [entries, filterText])

  const crumbs = useMemo(() => {
    const parts = path.replace(/^\/+/, '').split('/').filter(Boolean)
    const out = [{ label: 'mnt', path: ROOT }]
    let acc = ''
    for (let i = 1; i < parts.length; i++) {
      acc += '/' + parts[i]
      out.push({ label: parts[i], path: ROOT + acc })
    }
    return out
  }, [path])

  const submitPath = (e) => {
    e.preventDefault()
    const next = normalize(pathInput)
    if (next !== path) browse(next)
    else browse(path)
  }

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden flex flex-col shadow-lg">
      <CardHeader className="px-4 py-3 pb-3 border-b border-slate-800 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {!iconError ? (
                <img src="/icons/custom/autoscan.webp" alt="Autoscan" className="w-7 h-7 object-contain" onError={() => setIconError(true)} />
              ) : (
                <FolderOpen className={cn('w-5 h-5', brandColor.text)} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-100 text-sm leading-tight truncate">{widget.title || 'Autoscan'}</p>
              <p className="text-[10px] text-slate-400 truncate">Manual scan trigger</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { browse(path); fetchStatus() }} disabled={loading} className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800 shrink-0">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1 space-y-3">
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          {statusError ? (
            <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{statusError}</span>
          ) : status ? (
            <>
              <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full',
                status.reachable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                <span className={cn('w-1.5 h-1.5 rounded-full', status.reachable ? 'bg-emerald-400' : 'bg-red-400')} />
                {status.reachable ? 'Online' : 'Offline'}
              </span>
              {typeof status.targets === 'number' && (
                <span className="flex items-center gap-1 text-slate-400"><Activity className="w-3 h-3" />{status.targets} targets</span>
              )}
              {typeof status.recentCount === 'number' && (
                <span className="flex items-center gap-1 text-slate-400"><Clock className="w-3 h-3" />{status.recentCount} in last hr</span>
              )}
              {status.lastScan && (
                <span className="text-slate-500 truncate" title={status.lastScan.path}>
                  Last: {timeAgo(status.lastScan.at) || ''} · {status.lastScan.path}
                </span>
              )}
            </>
          ) : (
            <Skeleton className="h-4 w-32 bg-slate-800" />
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-xs text-slate-300 flex-wrap bg-slate-800/40 rounded-md px-2 py-1.5 border border-slate-700/40">
          <button onClick={() => browse(ROOT)} className="hover:text-emerald-400 flex items-center gap-1">
            <Home className="w-3 h-3" />
          </button>
          {crumbs.map((c, i) => (
            <span key={c.path} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <button
                onClick={() => browse(c.path)}
                className={cn('truncate hover:text-emerald-400', i === crumbs.length - 1 && 'text-emerald-400 font-medium')}
              >{c.label}</button>
            </span>
          ))}
        </div>

        {/* Path input */}
        <form onSubmit={submitPath} className="flex gap-2">
          <input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="/mnt/..."
            spellCheck={false}
            className="flex-1 min-w-0 bg-slate-800/60 border border-slate-700/60 rounded-md px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500/50"
          />
          <Button
            type="button"
            onClick={triggerScan}
            disabled={scanning || loading}
            size="sm"
            className="h-8 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-700/40 gap-1"
          >
            {scanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Scan
          </Button>
        </form>

        {/* Directory list */}
        <div className="border border-slate-800 rounded-md bg-slate-950/40 max-h-64 overflow-y-auto">
          {browseError ? (
            <div className="text-center py-4 px-3">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
              <p className="text-red-400 text-xs">{browseError}</p>
            </div>
          ) : loading ? (
            <div className="p-2 space-y-1">{[1,2,3,4].map(i => <Skeleton key={i} className="h-6 w-full bg-slate-800" />)}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-500">No subdirectories</div>
          ) : visibleEntries.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-500">No matches for "{filterText}"</div>
          ) : (
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-slate-800/60">
              {visibleEntries.map((e) => (
                <li key={e.name}>
                  <button
                    onClick={() => browse(`${path === '/' ? '' : path}/${e.name}`.replace(/\/+/g, '/'))}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800/60 text-left group"
                  >
                    <Folder className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 flex-shrink-0" />
                    <span className="truncate flex-1">{e.name}</span>
                    <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn('flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border',
                toast.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-700/40 text-emerald-300'
                  : 'bg-red-500/10 border-red-700/40 text-red-300')}
            >
              {toast.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span className="truncate">{toast.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {widget.url && (
        <CardFooter className="p-0 border-t border-slate-800">
          <a href={widget.url} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="ghost" className={cn('w-full h-9 rounded-none text-xs font-medium gap-1.5', brandColor.text, 'hover:text-slate-100 hover:bg-slate-800/60')}>
              Open Autoscan <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </CardFooter>
      )}
    </Card>
  )
}
