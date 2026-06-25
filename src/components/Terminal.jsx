import { useEffect, useRef, useState } from 'react'
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { motion } from 'framer-motion'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { cn } from '../lib/utils'
import { scaleIn } from '../lib/animations'

const Terminal = ({ onClose, initialCommand }) => {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const wsRef = useRef(null)
  const fitAddonRef = useRef(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(null)
  const commandSentRef = useRef(false)

  // Lock body scroll when terminal is open
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  // Track visual viewport height (shrinks when mobile keyboard opens)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setViewportHeight(vv.height)
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!terminalRef.current) return

    const isMobile = window.innerWidth < 640
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: isMobile ? 11 : 14,
      smoothScrollDuration: 150,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: {
        background: '#0a0f1a',
        foreground: '#e2e8f0',
        cursor: '#818cf8',
        selection: '#1e3a8a',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f1f5f9',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)
    xterm.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/terminal`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      xterm.writeln('\x1b[32mConnected to terminal\x1b[0m')
      xterm.writeln('')
      if (initialCommand && !commandSentRef.current) {
        commandSentRef.current = true
        setTimeout(() => xterm.write(initialCommand + '\r'), 500)
      }
    }

    ws.onmessage = (event) => xterm.write(event.data)
    ws.onerror = (error) => { xterm.writeln('\x1b[31mConnection error\x1b[0m'); console.error('WebSocket error:', error) }
    ws.onclose = () => xterm.writeln('\x1b[33mConnection closed\x1b[0m')

    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }))
    })

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        const dimensions = fitAddonRef.current.proposeDimensions()
        if (dimensions && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: dimensions.cols, rows: dimensions.rows }))
        }
      }
    }

    window.addEventListener('resize', handleResize)
    const vv = window.visualViewport
    if (vv) vv.addEventListener('resize', handleResize)
    wsRef.current = ws

    return () => {
      window.removeEventListener('resize', handleResize)
      if (vv) vv.removeEventListener('resize', handleResize)
      if (ws.readyState === WebSocket.OPEN) ws.close()
      xterm.dispose()
    }
  }, [])

  const handleMaximize = () => {
    setIsMaximized(!isMaximized)
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        const dimensions = fitAddonRef.current.proposeDimensions()
        if (dimensions && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols: dimensions.cols, rows: dimensions.rows }))
        }
      }
    }, 100)
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className={cn(
        'p-0 bg-transparent border-0 shadow-none',
        'fixed inset-0 translate-x-0 translate-y-0 left-0 top-0 max-w-none w-full h-full rounded-none',
        'flex items-start sm:items-center justify-center',
        'bg-slate-950 sm:bg-black/60 sm:backdrop-blur-sm overscroll-contain touch-none'
      )}>
      <motion.div
        {...scaleIn}
        className={cn(
          'flex flex-col w-full h-full',
          'sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-2xl',
          'bg-[#0a0f1a]',
          !isMaximized && 'sm:max-w-4xl sm:h-[600px]'
        )}
        style={viewportHeight && window.innerWidth < 640 ? { height: `${viewportHeight}px` } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 pt-[max(0.625rem,env(safe-area-inset-top))] sm:pt-3 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            {/* macOS-style dots */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer transition-colors" onClick={onClose} />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 cursor-pointer transition-colors" onClick={handleMaximize} />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 cursor-pointer transition-colors" onClick={handleMaximize} />
            </div>
            <div className="flex items-center gap-2 sm:pl-2">
              <TerminalIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-slate-300">Terminal</h3>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMaximize}
              className="hidden sm:flex h-7 w-7 text-slate-500 hover:text-slate-300 hover:bg-white/8"
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Terminal content */}
        <div className="flex-1 p-2 sm:p-3 overflow-hidden touch-auto">
          <div ref={terminalRef} className="w-full h-full touch-auto" />
        </div>

        {/* Footer hint */}
        <div className="hidden sm:flex items-center px-4 py-2 border-t border-white/5 text-xs text-slate-600">
          <span>Ctrl+C to cancel &nbsp;·&nbsp; type &apos;exit&apos; to close</span>
        </div>
      </motion.div>
      </DialogContent>
    </Dialog>
  )
}

export default Terminal
