import { useEffect, useState, useRef } from 'react'
import { X, Terminal } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { ScrollArea } from './ui/scroll-area'
import { Dialog, DialogContent } from './ui/dialog'
import { cn } from '../lib/utils'
import { scaleIn } from '../lib/animations'

const CommandProgress = ({ jobId, command, onClose }) => {
  const [output, setOutput] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const outputRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!jobId) return

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = isDev ? 'localhost:3000' : window.location.host
    const wsUrl = `${protocol}//${host}/api/command/progress/${jobId}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => setOutput('Connected to command stream...\n')

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'output') {
          setOutput(prev => {
            const newOutput = prev + data.data
            setTimeout(() => {
              if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
            }, 10)
            return newOutput
          })
        } else if (data.type === 'completed') {
          setIsComplete(true)
          ws.close()
        } else if (data.type === 'error') {
          setOutput(prev => prev + `\n[ERROR] ${data.message}\n`)
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err, event.data)
        setOutput(prev => prev + '\n[ERROR] Failed to parse message\n')
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setOutput(prev => prev + '\n[ERROR] WebSocket connection error\n')
    }

    ws.onclose = () => {}
    wsRef.current = ws

    return () => { if (ws.readyState === WebSocket.OPEN) ws.close() }
  }, [jobId])

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-4xl w-full">
      <motion.div
        {...scaleIn}
        className="bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl h-[600px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
              <Terminal className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-100">Command Progress</h3>
              <p className="text-xs text-slate-500 font-mono truncate max-w-sm">{command}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={cn(
              'text-xs border font-medium',
              isComplete
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            )}>
              {isComplete ? 'Completed' : 'Running'}
            </Badge>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress indicator */}
        {!isComplete && (
          <div className="px-5 py-2 border-b border-white/5">
            <Progress value={undefined} className="h-0.5 bg-white/5" />
          </div>
        )}

        {/* Output */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={outputRef}
            className="w-full h-full bg-slate-950/60 p-5 overflow-y-auto font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed"
            style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
          >
            {output || <span className="text-slate-600">Waiting for output...</span>}
            {!isComplete && output && (
              <span className="inline-block w-1.5 h-4 bg-violet-400 ml-1 animate-pulse rounded-sm" />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between">
          <span className="text-xs text-slate-600">
            {isComplete ? 'Command finished' : 'Command running...'}
          </span>
          {isComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-slate-100 text-xs"
            >
              Close
            </Button>
          )}
        </div>
      </motion.div>
      </DialogContent>
    </Dialog>
  )
}

export default CommandProgress
