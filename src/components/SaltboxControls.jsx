import { Terminal, RefreshCw, Download, Upload } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'
import { staggerContainer, staggerItem } from '../lib/animations'
import CommandProgress from './CommandProgress'

const SaltboxControls = ({ onRefresh, currentUser }) => {
  const [loading, setLoading] = useState({})
  const [updateLogs, setUpdateLogs] = useState({})
  const [updateJobId, setUpdateJobId] = useState(null)
  const wsRef = useRef(null)

  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [])

  useEffect(() => {
    if (!updateJobId) return

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = isDev ? 'localhost:3000' : window.location.host
    const wsUrl = `${protocol}//${host}/api/command/progress/${updateJobId}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => console.log('Connected to command stream...')

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'output') {
          setUpdateLogs(prev => ({ ...prev, [updateJobId]: (prev[updateJobId] || '') + message.data }))
        } else if (message.type === 'completed' || message.type === 'error') {
          setLoading(prev => ({ ...prev, 'sb update': false }))
          if (message.type === 'completed' && onRefresh) onRefresh()
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
      }
    }

    ws.onerror = (error) => console.error('WebSocket error:', error)
    ws.onclose = () => { wsRef.current = null }

    return () => { if (ws.readyState === WebSocket.OPEN) ws.close() }
  }, [updateJobId, onRefresh])

  const canExecute = currentUser?.permissions?.includes('saltbox:execute')

  const handleSaltboxCommand = async (command) => {
    if (!canExecute) {
      alert('You do not have permission to execute Saltbox commands')
      return
    }

    setLoading(prev => ({ ...prev, [command]: true }))

    try {
      const response = await fetch('/api/saltbox/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.jobId && command.startsWith('sb update')) {
          setUpdateJobId(data.jobId)
          setUpdateLogs(prev => ({ ...prev, [data.jobId]: '' }))
        } else if (data.message && data.message.includes('background')) {
          alert(`Command started in background (PID: ${data.pid || 'N/A'})\n\nThis may take several minutes to complete.`)
          setLoading(prev => ({ ...prev, [command]: false }))
        } else if (data.output) {
          setLoading(prev => ({ ...prev, [command]: false }))
        }
        if (onRefresh && !command.startsWith('sb update')) onRefresh()
      } else {
        const errorData = await response.json()
        alert(`Command failed: ${errorData.error || errorData.details || 'Unknown error'}`)
        setLoading(prev => ({ ...prev, [command]: false }))
      }
    } catch (error) {
      console.error(`Failed to execute ${command}:`, error)
      alert(`Failed to execute command: ${error.message}`)
      setLoading(prev => ({ ...prev, [command]: false }))
    }
  }

  const commands = [
    {
      id: 'update',
      label: 'Update Saltbox',
      description: 'Update Saltbox files (not containers)',
      icon: Download,
      accentClass: 'hover:border-blue-500/40 hover:bg-blue-500/8',
      iconClass: 'text-blue-400',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      command: 'sb update',
    },
    {
      id: 'backup',
      label: 'Backup',
      description: 'Create system backup',
      icon: Upload,
      accentClass: 'hover:border-emerald-500/40 hover:bg-emerald-500/8',
      iconClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      command: 'sb backup',
    },
  ]

  return (
    <Card className="bg-white/4 border-white/8">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg text-slate-100">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-violet-400" />
          </div>
          Saltbox Controls
          {!canExecute && (
            <Badge className="ml-auto bg-slate-700/50 text-slate-400 border-slate-600/50 text-xs font-normal">
              Read Only
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {commands.map((cmd) => {
            const Icon = cmd.icon
            const isDisabled = loading[cmd.command] || !canExecute
            const isUpdateCommand = cmd.command === 'sb update'
            const hasLogs = isUpdateCommand && updateLogs[updateJobId]

            return (
              <motion.div
                key={cmd.id}
                variants={staggerItem}
                className={isUpdateCommand && hasLogs ? 'md:col-span-2' : ''}
              >
                <button
                  onClick={() => handleSaltboxCommand(cmd.command)}
                  disabled={isDisabled}
                  title={!canExecute ? 'You do not have permission to execute Saltbox commands' : undefined}
                  className={cn(
                    'w-full p-4 rounded-xl border border-white/8 bg-white/3 transition-all duration-200 text-left group',
                    !isDisabled && cn('hover:scale-[1.01] hover:shadow-md hover:shadow-black/20', cmd.accentClass),
                    isDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 transition-colors group-hover:border-white/15', !isDisabled && 'group-hover:bg-white/8')}>
                      <Icon className={cn('w-4.5 h-4.5', cmd.iconClass)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-100 text-sm">{cmd.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{cmd.description}</div>
                    </div>
                    {loading[cmd.command] && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                        <span className="text-xs text-slate-500">Running...</span>
                      </div>
                    )}
                    {!loading[cmd.command] && canExecute && (
                      <Badge className={cn('text-xs border opacity-0 group-hover:opacity-100 transition-opacity', cmd.badgeClass)}>
                        Run
                      </Badge>
                    )}
                  </div>
                </button>

                {isUpdateCommand && hasLogs && (
                  <div className="mt-2 bg-slate-950/80 border border-white/8 rounded-xl p-4 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                      {updateLogs[updateJobId]}
                    </pre>
                  </div>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      </CardContent>
    </Card>
  )
}

export default SaltboxControls
