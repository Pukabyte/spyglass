import { useEffect, useState, useRef, useMemo } from 'react'
import { X, Download, RefreshCw, Maximize2, Minimize2, Search, SlidersHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent } from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import { cn } from '../lib/utils'
import { scaleIn } from '../lib/animations'

const DockerLogViewer = ({ containerId, containerName, onClose }) => {
  const [logs, setLogs] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [tail, setTail] = useState('100')
  const [follow, setFollow] = useState(true)
  const [timestamps, setTimestamps] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [fontSize, setFontSize] = useState(12)
  const [showFilters, setShowFilters] = useState(false)
  const logsRef = useRef(null)
  const wsRef = useRef(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    if (!containerId) return

    const connectLogs = () => {
      if (wsRef.current) wsRef.current.close()
      setIsConnected(false)
      setLogs('')

      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = isDev ? 'localhost:3000' : window.location.host
      const wsUrl = `${protocol}//${host}/api/docker/${containerId}/logs?tail=${tail}&follow=${follow}&timestamps=${timestamps}`

      const ws = new WebSocket(wsUrl)

      ws.onopen = () => setIsConnected(true)

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'connected') {
            setLogs(prev => prev + `${data.message}\n`)
          } else if (data.type === 'log') {
            let cleanedData = data.data
            cleanedData = cleanedData.replace(/^[%+\-()&|<>H,;:!@#$^&*=\[\]{}`~\\\/]\s*(INFO|ERROR|WARN|DEBUG|FATAL|SUCCESS)/gm, '$1')
            cleanedData = cleanedData.replace(/^[%+\-()&|<>H,;:!@#$^&*=\[\]{}`~\\\/]\s*(\[INFO\]|\[ERROR\]|\[WARN\]|\[DEBUG\]|\[FATAL\])/gm, '$1')
            cleanedData = cleanedData.replace(/^[^t\s]time=/gm, 'time=')
            cleanedData = cleanedData.replace(/^([^0-9\s])(\d{4}-\d{2}-\d{2})/gm, '$2')
            cleanedData = cleanedData.replace(/^([^0-9\s])(\d{4}\/\d{2}\/\d{2})/gm, '$2')
            cleanedData = cleanedData.replace(/^([^0-9\s])(\d{2}\/\d{2}\/\d{4})/gm, '$2')
            setLogs(prev => {
              const newLogs = prev + cleanedData
              if (autoScrollRef.current) {
                setTimeout(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight }, 10)
              }
              return newLogs
            })
          } else if (data.type === 'end') {
            setIsConnected(false)
            setLogs(prev => prev + `\n${data.message}\n`)
          } else if (data.type === 'error') {
            setLogs(prev => prev + `\n[ERROR] ${data.message}\n`)
            setIsConnected(false)
          }
        } catch (err) {
          let cleanedData = event.data
          cleanedData = cleanedData.replace(/^[%+\-()&|<>H,;:!@#$^&*=\[\]{}`~\\\/]\s*(INFO|ERROR|WARN|DEBUG|FATAL|SUCCESS)/gm, '$1')
          cleanedData = cleanedData.replace(/^[^t\s]time=/gm, 'time=')
          cleanedData = cleanedData.replace(/^([^0-9\s])(\d{4}-\d{2}-\d{2})/gm, '$2')
          cleanedData = cleanedData.replace(/^([^0-9\s])(\d{4}\/\d{2}\/\d{2})/gm, '$2')
          cleanedData = cleanedData.replace(/^([^0-9\s])(\d{2}\/\d{2}\/\d{4})/gm, '$2')
          setLogs(prev => {
            const newLogs = prev + cleanedData
            if (autoScrollRef.current) {
              setTimeout(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight }, 10)
            }
            return newLogs
          })
        }
      }

      ws.onerror = () => {
        setLogs(prev => prev + '\n[ERROR] WebSocket connection error\n')
        setIsConnected(false)
      }

      ws.onclose = () => setIsConnected(false)
      wsRef.current = ws
    }

    connectLogs()
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [containerId, tail, follow, timestamps])

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${containerName || containerId}-logs-${new Date().toISOString()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClear = () => setLogs('')

  const handleScroll = () => {
    if (logsRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsRef.current
      autoScrollRef.current = scrollTop + clientHeight >= scrollHeight - 50
    }
  }

  const formatLogLine = (line, lineNumber) => {
    if (!line && line !== '') return null
    let className = 'text-slate-300'
    const upperLine = line.toUpperCase()

    const httpStatusMatch = line.match(/\bHTTP\/[\d.]+\s+(\d{3})\b/) ||
      line.match(/\bstatus[:\s]+(\d{3})\b/i) ||
      line.match(/\bhttp\s+code[:\s]+(\d{3})\b/i) ||
      line.match(/\bresponse\s+code[:\s]+(\d{3})\b/i) ||
      line.match(/\b(\d{3})\s+(OK|Created|Accepted|Not Found|Forbidden|Unauthorized|Internal Server Error|Bad Request|Server Error|Moved|Redirect)/i)
    if (httpStatusMatch) {
      const statusCode = parseInt(httpStatusMatch[1] || httpStatusMatch[2])
      if (statusCode >= 200 && statusCode < 300) className = 'text-green-400 bg-green-500/10'
      else if (statusCode >= 300 && statusCode < 400) className = 'text-yellow-400 bg-yellow-500/10'
      else if (statusCode >= 400 && statusCode < 500) className = 'text-orange-400 bg-orange-500/10'
      else if (statusCode >= 500) className = 'text-red-400 bg-red-500/10'
    }

    const exitCodeMatch = line.match(/\bexit\s+(?:code\s+)?(\d+)\b/i) || line.match(/\bexited\s+with\s+code\s+(\d+)\b/i)
    if (exitCodeMatch) {
      const exitCode = parseInt(exitCodeMatch[1])
      className = exitCode === 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
    }

    if (className === 'text-slate-300') {
      if (upperLine.includes('[ERROR]') || upperLine.match(/\s+ERROR\s+/) || upperLine.match(/^ERROR\s+/) || upperLine.match(/\s+ERROR$/) || upperLine.match(/\bERR\b/) || upperLine.match(/\berror\b/i) || upperLine.match(/\bfailed\b/i) || upperLine.match(/\bfailure\b/i) || upperLine.match(/\bexception\b/i)) {
        className = 'text-red-400 bg-red-500/10'
      } else if (upperLine.includes('[WARN]') || upperLine.match(/\s+WARN\s+/) || upperLine.match(/^WARN\s+/) || upperLine.match(/\s+WARN$/) || upperLine.match(/\bWRN\b/) || upperLine.match(/\bwarn(ing)?\b/i) || upperLine.match(/\bcaution\b/i)) {
        className = 'text-yellow-400 bg-yellow-500/10'
      } else if (upperLine.includes('[SUCCESS]') || upperLine.match(/\s+SUCCESS\s+/) || upperLine.match(/\bsuccess\b/i) || upperLine.match(/\bsucceeded\b/i) || upperLine.match(/\bcompleted\b/i) || (upperLine.match(/\bok\b/i) && !upperLine.match(/\b(okhttp|okio|okta)\b/i))) {
        className = 'text-green-400 bg-green-500/10'
      } else if (upperLine.includes('[INFO]') || upperLine.match(/\s+INFO\s+/) || upperLine.match(/^INFO\s+/) || upperLine.match(/\s+INFO$/) || upperLine.match(/\bINF\b/) || upperLine.match(/\binfo\b/i)) {
        className = 'text-blue-400 bg-blue-500/10'
      } else if (upperLine.includes('[DEBUG]') || upperLine.match(/\s+DEBUG\s+/) || upperLine.match(/\bDBG\b/) || upperLine.match(/\bdebug\b/i)) {
        className = 'text-purple-400 bg-purple-500/10'
      } else if (upperLine.includes('[FATAL]') || upperLine.match(/\s+FATAL\s+/) || upperLine.match(/\bfatal\b/i)) {
        className = 'text-red-600 bg-red-700/20 font-semibold'
      }
    }

    if (className === 'text-slate-300') {
      if (upperLine.match(/\b(unauthorized|forbidden|not found|bad request|internal server error)\b/i) || upperLine.match(/\b(timeout|connection refused|connection reset)\b/i)) {
        className = 'text-red-400 bg-red-500/10'
      } else if (upperLine.match(/\b(created|accepted|no content)\b/i)) {
        className = 'text-green-400 bg-green-500/10'
      } else if (upperLine.match(/\b(moved|redirect|temporary redirect)\b/i)) {
        className = 'text-yellow-400 bg-yellow-500/10'
      }
    }

    return { className, content: line, lineNumber, originalLine: line }
  }

  const formattedLogs = useMemo(() => {
    if (!logs) return []
    const lines = logs.split('\n')
    return lines.map((line, index) => formatLogLine(line, index + 1)).filter(Boolean)
  }, [logs])

  const filteredLogs = useMemo(() => {
    let result = formattedLogs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      result = formattedLogs.filter(log => log.originalLine.toLowerCase().includes(searchLower))
    }
    if (searchTerm && result.length > 0) {
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      result = result.map(log => {
        const parts = log.originalLine.split(regex)
        const highlightedContent = parts.map((part, idx) => {
          if (part.toLowerCase() === searchTerm.toLowerCase()) {
            return <mark key={idx} className="bg-yellow-500/50 text-yellow-100 px-0.5 rounded">{part}</mark>
          }
          return part
        })
        return { ...log, content: highlightedContent }
      })
    }
    return result
  }, [formattedLogs, searchTerm])

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className={cn(
        'p-0 bg-transparent border-0 shadow-none',
        'fixed inset-0 translate-x-0 translate-y-0 left-0 top-0 max-w-none w-full h-full rounded-none',
        'flex items-start sm:items-center justify-center',
        'bg-black/60 sm:backdrop-blur-sm'
      )}>
      <motion.div
        {...scaleIn}
        className={cn(
          'bg-slate-900/95 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col w-full h-[95vh]',
          isMaximized ? 'sm:w-full sm:h-full sm:rounded-none sm:max-w-none sm:max-h-none' : 'sm:max-w-5xl sm:max-h-[82vh]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0 transition-colors', isConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-400')} />
            <Badge variant="secondary" className="font-mono text-xs truncate max-w-[200px] sm:max-w-xs bg-white/5 text-slate-300 border-white/10">
              {containerName || containerId}
            </Badge>
            {isConnected && <span className="text-xs text-slate-500 hidden sm:inline">Streaming live</span>}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Desktop search */}
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search logs..."
                className="bg-transparent border-0 text-slate-200 text-xs w-32 h-auto p-0 focus-visible:ring-0 placeholder:text-slate-600"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-slate-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Desktop controls */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 pl-2 border-l border-white/10">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <span>Tail:</span>
                <input
                  type="number"
                  value={tail}
                  onChange={(e) => { setTail(e.target.value); if (wsRef.current) wsRef.current.close() }}
                  onBlur={(e) => {
                    const v = Math.max(1, Math.min(10000, parseInt(e.target.value) || 100))
                    if (v.toString() !== tail) setTail(v.toString())
                  }}
                  min="1" max="10000"
                  className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-white/20"
                />
              </label>
              {[
                { label: 'Follow', checked: follow, onChange: setFollow, disabled: isConnected },
                { label: 'Timestamps', checked: timestamps, onChange: setTimestamps, disabled: isConnected },
                { label: 'Line #', checked: showLineNumbers, onChange: setShowLineNumbers },
              ].map(({ label, checked, onChange, disabled }) => (
                <label key={label} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="rounded accent-violet-500" />
                  <span>{label}</span>
                </label>
              ))}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <span>Size:</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-200 focus:outline-none"
                >
                  {[10, 12, 14, 16].map(s => <option key={s} value={s}>{s}px</option>)}
                </select>
              </label>
            </div>

            {/* Mobile filter toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden h-8 w-8 text-slate-400 hover:text-slate-200"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={handleClear} className="hidden sm:flex h-8 w-8 text-slate-400 hover:text-slate-200" title="Clear">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDownload} className="hidden sm:flex h-8 w-8 text-slate-400 hover:text-slate-200" title="Download">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsMaximized(!isMaximized)} className="hidden sm:flex h-8 w-8 text-slate-400 hover:text-slate-200">
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden border-b border-white/8 bg-slate-800/50 overflow-hidden"
            >
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search logs..."
                    className="bg-transparent text-slate-200 text-sm flex-1 outline-none placeholder:text-slate-600"
                  />
                  {searchTerm && <button onClick={() => setSearchTerm('')} className="text-slate-500"><X className="w-4 h-4" /></button>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
                  <label className="flex items-center gap-2">
                    <span>Tail:</span>
                    <input type="number" value={tail} onChange={(e) => setTail(e.target.value)} min="1" max="10000" className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-slate-200 text-sm outline-none" />
                  </label>
                  <label className="flex items-center gap-2">
                    <span>Size:</span>
                    <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-slate-200 flex-1 outline-none">
                      {[10, 12, 14, 16].map(s => <option key={s} value={s}>{s}px</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                  {[
                    { label: 'Follow', checked: follow, onChange: setFollow, disabled: isConnected },
                    { label: 'Timestamps', checked: timestamps, onChange: setTimestamps, disabled: isConnected },
                    { label: 'Line #', checked: showLineNumbers, onChange: setShowLineNumbers },
                  ].map(({ label, checked, onChange, disabled }) => (
                    <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="rounded accent-violet-500" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleClear} className="flex-1 h-9 text-sm text-slate-300 border border-white/10">
                    <RefreshCw className="w-3.5 h-3.5 mr-2" /> Clear
                  </Button>
                  <Button variant="ghost" onClick={handleDownload} className="flex-1 h-9 text-sm text-slate-300 border border-white/10">
                    <Download className="w-3.5 h-3.5 mr-2" /> Download
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Log content */}
        <div className="flex-1 overflow-hidden min-h-0">
          <div
            ref={logsRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto overscroll-contain"
            style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace', fontSize: `${fontSize}px`, lineHeight: '1.6', WebkitOverflowScrolling: 'touch' }}
          >
            {filteredLogs.length > 0 ? (
              <div className="p-3 sm:p-4">
                {filteredLogs.map((log, idx) => (
                  <div key={idx} className={cn('flex hover:bg-white/4 px-2 py-0.5 rounded transition-colors', log.className)}>
                    {showLineNumbers && (
                      <span className="text-slate-600 mr-3 sm:mr-4 select-none min-w-[36px] sm:min-w-[52px] text-right flex-shrink-0">{log.lineNumber}</span>
                    )}
                    <span className="flex-1 break-words whitespace-pre-wrap">{log.content}</span>
                  </div>
                ))}
              </div>
            ) : searchTerm ? (
              <div className="p-6 text-slate-500 text-center text-sm">No logs match &quot;{searchTerm}&quot;</div>
            ) : logs ? (
              <div className="p-6 text-slate-500 text-sm">No logs available</div>
            ) : (
              <div className="p-6 text-slate-500 text-sm">Connecting to container logs...</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/8 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 min-w-0">
            <span>{logs.split('\n').length} lines</span>
            {searchTerm && <span className="text-yellow-400">{filteredLogs.length} matched</span>}
            <span className="hidden sm:inline">{new Blob([logs]).size.toLocaleString()} bytes</span>
          </div>
          <span className="hidden sm:inline">Press ESC to close</span>
        </div>
      </motion.div>
      </DialogContent>
    </Dialog>
  )
}

export default DockerLogViewer
