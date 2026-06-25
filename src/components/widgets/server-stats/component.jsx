import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Cpu, HardDrive, Activity, Wifi, Server, Clock, Thermometer, ArrowDown, ArrowUp, RefreshCw, X, Maximize2 } from 'lucide-react'
import { Dialog, DialogContent } from '../../ui/dialog'

export default function Component({ widget, onDelete }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const modalScrollRef = useRef(null)
  const scrollPositionRef = useRef(0)

  const fetchStats = useCallback(async () => {
    // Save scroll position before update
    if (modalScrollRef.current) {
      scrollPositionRef.current = modalScrollRef.current.scrollTop
    }

    try {
      const response = await fetch('/api/server/stats', { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [fetchStats])

  // Restore scroll position after stats update
  useLayoutEffect(() => {
    if (showModal && scrollPositionRef.current > 0) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        if (modalScrollRef.current) {
          modalScrollRef.current.scrollTop = scrollPositionRef.current
        }
      })
    }
  }, [stats, showModal])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStats()
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatBytesPerSec = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec === 0) return '0 B/s'
    if (bytesPerSec < 1024) return Math.round(bytesPerSec) + ' B/s'
    if (bytesPerSec < 1024 * 1024) return Math.round(bytesPerSec / 1024 * 100) / 100 + ' KB/s'
    if (bytesPerSec < 1024 * 1024 * 1024) return Math.round(bytesPerSec / (1024 * 1024) * 100) / 100 + ' MB/s'
    return Math.round(bytesPerSec / (1024 * 1024 * 1024) * 100) / 100 + ' GB/s'
  }

  const getUsageColor = (usage, thresholds = { low: 50, medium: 75, high: 90 }) => {
    if (usage < thresholds.low) return { text: 'text-green-400', bg: 'bg-green-500', bgLight: 'bg-green-500/20' }
    if (usage < thresholds.medium) return { text: 'text-yellow-400', bg: 'bg-yellow-500', bgLight: 'bg-yellow-500/20' }
    if (usage < thresholds.high) return { text: 'text-orange-400', bg: 'bg-orange-500', bgLight: 'bg-orange-500/20' }
    return { text: 'text-red-400', bg: 'bg-red-500', bgLight: 'bg-red-500/20' }
  }

  const getTempColor = (temp) => {
    if (!temp) return { text: 'text-slate-400', bg: 'bg-slate-500', bgLight: 'bg-slate-500/20' }
    if (temp < 40) return { text: 'text-blue-400', bg: 'bg-blue-500', bgLight: 'bg-blue-500/20' }
    if (temp < 60) return { text: 'text-green-400', bg: 'bg-green-500', bgLight: 'bg-green-500/20' }
    if (temp < 75) return { text: 'text-yellow-400', bg: 'bg-yellow-500', bgLight: 'bg-yellow-500/20' }
    if (temp < 85) return { text: 'text-orange-400', bg: 'bg-orange-500', bgLight: 'bg-orange-500/20' }
    return { text: 'text-red-400', bg: 'bg-red-500', bgLight: 'bg-red-500/20' }
  }

  // Render modal portal directly (not as nested component to preserve scroll)
  const renderModal = () => {
    if (!showModal || !stats) return null

    const details = stats?.details || {}
    const modalCpuColor = getUsageColor(stats?.cpu || 0)
    const modalMemColor = getUsageColor(stats?.memory || 0)
    const modalDiskColor = getUsageColor(stats?.disk || 0)
    const modalTempColor = getTempColor(details.cpu?.temperature)

    return (
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-5xl w-full">
        <div className="glass rounded-xl border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-slate-500/20 to-gray-600/20">
            <div className="flex items-center space-x-3">
              <Server className="w-6 h-6 text-slate-300" />
              <div>
                <h3 className="text-xl font-semibold text-slate-100">Server Statistics</h3>
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Uptime: {details.system?.uptimeFormatted || 'N/A'}</span>
                  {details.system?.hostname && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span>{details.system.hostname}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-slate-400 hover:text-red-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div ref={modalScrollRef} className="flex-1 overflow-y-auto p-6">
            {/* Main Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* CPU Card */}
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center space-x-2 mb-3">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium text-slate-300">CPU</span>
                </div>
                <div className={`text-3xl font-bold ${modalCpuColor.text} mb-2`}>{stats?.cpu || 0}%</div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                  <div className={`h-full ${modalCpuColor.bgLight} transition-all duration-500`} style={{ width: `${Math.min(stats?.cpu || 0, 100)}%` }} />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cores</span>
                    <span className="text-slate-300">{details.cpu?.cores || 0}</span>
                  </div>
                  {details.cpu?.temperature && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Temp</span>
                      <span className={modalTempColor.text}>{Math.round(details.cpu.temperature)}°C</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Memory Card */}
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center space-x-2 mb-3">
                  <Activity className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-medium text-slate-300">Memory</span>
                </div>
                <div className={`text-3xl font-bold ${modalMemColor.text} mb-2`}>{stats?.memory || 0}%</div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                  <div className={`h-full ${modalMemColor.bgLight} transition-all duration-500`} style={{ width: `${Math.min(stats?.memory || 0, 100)}%` }} />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Used</span>
                    <span className="text-slate-300">{details.memory?.usedGB || 0} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total</span>
                    <span className="text-slate-300">{details.memory?.totalGB || 0} GB</span>
                  </div>
                </div>
              </div>

              {/* Disk Card */}
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center space-x-2 mb-3">
                  <HardDrive className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-slate-300">Disk (/opt)</span>
                </div>
                <div className={`text-3xl font-bold ${modalDiskColor.text} mb-2`}>{stats?.disk || 0}%</div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                  <div className={`h-full ${modalDiskColor.bgLight} transition-all duration-500`} style={{ width: `${Math.min(stats?.disk || 0, 100)}%` }} />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Used</span>
                    <span className="text-slate-300">{details.disk?.usedGB || 0} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total</span>
                    <span className="text-slate-300">{details.disk?.totalGB || 0} GB</span>
                  </div>
                </div>
              </div>

              {/* Network Card */}
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center space-x-2 mb-3">
                  <Wifi className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm font-medium text-slate-300">Network</span>
                </div>
                <div className="text-3xl font-bold text-cyan-400 mb-2">
                  {formatBytesPerSec((details.network?.rx_sec || 0) + (details.network?.tx_sec || 0))}
                </div>
                <div className="space-y-1 text-xs mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center">
                      <ArrowDown className="w-3 h-3 mr-1 text-green-400" />RX
                    </span>
                    <span className="text-slate-300">{formatBytesPerSec(details.network?.rx_sec || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center">
                      <ArrowUp className="w-3 h-3 mr-1 text-blue-400" />TX
                    </span>
                    <span className="text-slate-300">{formatBytesPerSec(details.network?.tx_sec || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* System Info */}
              <div className="glass rounded-xl p-4 border border-white/10">
                <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center">
                  <Server className="w-4 h-4 mr-2 text-slate-400" />
                  System Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 text-xs">Platform</span>
                    <p className="text-slate-200">{details.system?.platform || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Distribution</span>
                    <p className="text-slate-200 truncate">{details.system?.distro || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Architecture</span>
                    <p className="text-slate-200">{details.system?.arch || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Hostname</span>
                    <p className="text-slate-200">{details.system?.hostname || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* CPU Details */}
              {details.cpu?.brand && (
                <div className="glass rounded-xl p-4 border border-white/10">
                  <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center">
                    <Cpu className="w-4 h-4 mr-2 text-blue-400" />
                    CPU Details
                  </h4>
                  <p className="text-sm text-slate-300 truncate mb-3">{details.cpu.brand}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-blue-400">{details.cpu.loadUser || 0}%</div>
                      <span className="text-xs text-slate-500">User</span>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-yellow-400">{details.cpu.loadSystem || 0}%</div>
                      <span className="text-xs text-slate-500">System</span>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-green-400">{details.cpu.loadIdle || 0}%</div>
                      <span className="text-xs text-slate-500">Idle</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Swap Memory */}
              {details.memory?.swapTotal > 0 && (
                <div className="glass rounded-xl p-4 border border-white/10">
                  <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-orange-400" />
                    Swap Memory
                  </h4>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">
                      {details.memory.swapUsedGB || 0} / {details.memory.swapTotalGB || 0} GB
                    </span>
                    <span className="text-sm font-medium text-orange-400">
                      {details.memory.swapTotal > 0 ? Math.round((details.memory.swapUsed / details.memory.swapTotal) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500/30 transition-all duration-500"
                      style={{ width: `${details.memory.swapTotal > 0 ? Math.min((details.memory.swapUsed / details.memory.swapTotal) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Disk I/O */}
              {(details.disk?.readSpeed > 0 || details.disk?.writeSpeed > 0) && (
                <div className="glass rounded-xl p-4 border border-white/10">
                  <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center">
                    <HardDrive className="w-4 h-4 mr-2 text-purple-400" />
                    Disk I/O
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-green-400">{formatBytesPerSec(details.disk.readSpeed)}</div>
                      <span className="text-xs text-slate-500">Read Speed</span>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-blue-400">{formatBytesPerSec(details.disk.writeSpeed)}</div>
                      <span className="text-xs text-slate-500">Write Speed</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Storage Section - Full Width */}
            {details.disk?.allDisks?.length > 0 && (
              <div className="glass rounded-xl p-4 border border-white/10 mt-6">
                <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center">
                  <HardDrive className="w-4 h-4 mr-2 text-purple-400" />
                  Storage ({details.disk.allDisks.length} disk{details.disk.allDisks.length !== 1 ? 's' : ''})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {details.disk.allDisks.map((disk, idx) => {
                    const diskUsage = disk.use || (disk.size > 0 ? (disk.used / disk.size) * 100 : 0)
                    const color = getUsageColor(diskUsage)
                    return (
                      <div key={idx} className="bg-slate-800/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-300 truncate flex-1 mr-2" title={disk.mount}>
                            {disk.mount}
                          </span>
                          <span className={`text-sm font-bold ${color.text}`}>{Math.round(diskUsage)}%</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                          <div className={`h-full ${color.bgLight} transition-all duration-500`} style={{ width: `${Math.min(diskUsage, 100)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{disk.usedGB} / {disk.sizeGB} GB</span>
                          <span>{disk.availableGB} GB free</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Processes Section */}
            {(details.processes?.topCpuProcesses?.length > 0 || details.processes?.topMemProcesses?.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Top CPU Processes */}
                {details.processes?.topCpuProcesses?.length > 0 && (
                  <div className="glass rounded-xl p-4 border border-white/10">
                    <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center">
                      <Cpu className="w-4 h-4 mr-2 text-blue-400" />
                      Top CPU Processes ({details.processes.total || 0} total)
                    </h4>
                    <div className="space-y-2">
                      {details.processes.topCpuProcesses.map((proc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-slate-800/30 rounded-lg px-3 py-2">
                          <span className="text-slate-300 truncate flex-1 mr-2">{proc.name}</span>
                          <span className="text-blue-400 font-medium">{proc.cpu}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Memory Processes */}
                {details.processes?.topMemProcesses?.length > 0 && (
                  <div className="glass rounded-xl p-4 border border-white/10">
                    <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center">
                      <Activity className="w-4 h-4 mr-2 text-green-400" />
                      Top Memory Processes
                    </h4>
                    <div className="space-y-2">
                      {details.processes.topMemProcesses.map((proc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-slate-800/30 rounded-lg px-3 py-2">
                          <span className="text-slate-300 truncate flex-1 mr-2">{proc.name}</span>
                          <span className="text-green-400 font-medium">{proc.mem}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (loading) {
    return (
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-slate-500/20 to-gray-600/20 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center">
              <Server className="w-6 h-6 text-slate-400" />
            </div>
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-red-500/20 to-rose-600/20 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <Server className="w-6 h-6 text-red-400" />
            <span className="font-semibold text-slate-100">Server Stats</span>
          </div>
        </div>
        <div className="p-4 text-center text-red-400">
          <p>{error}</p>
          <button onClick={handleRefresh} className="mt-2 text-sm text-slate-400 hover:text-white">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const details = stats?.details || {}
  const cpuColor = getUsageColor(stats?.cpu || 0)
  const memColor = getUsageColor(stats?.memory || 0)
  const diskColor = getUsageColor(stats?.disk || 0)
  const tempColor = getTempColor(details.cpu?.temperature)

  return (
    <>
      <div className="glass rounded-xl border border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-500/20 to-gray-600/20 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800/50 flex items-center justify-center">
                <Server className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Server Stats</h3>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{details.system?.uptimeFormatted || 'N/A'}</span>
                  {details.system?.hostname && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span>{details.system.hostname}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Show Details"
              >
                <Maximize2 className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {/* CPU */}
            <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-400">CPU</span>
                </div>
                <span className={`text-lg font-bold ${cpuColor.text}`}>{stats?.cpu || 0}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${cpuColor.bgLight} transition-all duration-500`}
                  style={{ width: `${Math.min(stats?.cpu || 0, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">{details.cpu?.cores || 0} cores</span>
                {details.cpu?.temperature && (
                  <span className={tempColor.text}>
                    <Thermometer className="w-3 h-3 inline mr-1" />
                    {Math.round(details.cpu.temperature)}°C
                  </span>
                )}
              </div>
            </div>

            {/* Memory */}
            <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-slate-400">Memory</span>
                </div>
                <span className={`text-lg font-bold ${memColor.text}`}>{stats?.memory || 0}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${memColor.bgLight} transition-all duration-500`}
                  style={{ width: `${Math.min(stats?.memory || 0, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {details.memory?.usedGB || 0} / {details.memory?.totalGB || 0} GB
              </div>
            </div>

            {/* Disk /opt */}
            <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-slate-400">/opt</span>
                </div>
                <span className={`text-lg font-bold ${diskColor.text}`}>{stats?.disk || 0}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${diskColor.bgLight} transition-all duration-500`}
                  style={{ width: `${Math.min(stats?.disk || 0, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {details.disk?.usedGB || 0} / {details.disk?.totalGB || 0} GB
              </div>
            </div>

            {/* Network */}
            <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-slate-400">Network</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center">
                    <ArrowDown className="w-3 h-3 mr-1 text-green-400" />RX
                  </span>
                  <span className="text-slate-300">{formatBytesPerSec(details.network?.rx_sec || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center">
                    <ArrowUp className="w-3 h-3 mr-1 text-blue-400" />TX
                  </span>
                  <span className="text-slate-300">{formatBytesPerSec(details.network?.tx_sec || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View Details Button */}
        <button
          onClick={() => setShowModal(true)}
          className="w-full py-2.5 text-xs font-medium text-slate-400 hover:text-white flex items-center justify-center space-x-1 transition-colors border-t border-white/5 hover:bg-white/5"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>View Details</span>
        </button>
      </div>

      {renderModal()}
    </>
  )
}
