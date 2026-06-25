import { Cpu, HardDrive, Activity, Wifi, X } from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { Dialog, DialogContent } from './ui/dialog'
import { cn } from '../lib/utils'
import { staggerContainer, staggerItem, scaleIn } from '../lib/animations'

const ServerAnalytics = ({ stats, loading }) => {
  const [selectedMetric, setSelectedMetric] = useState(null)
  const [historyData, setHistoryData] = useState([])
  const lastStatsRef = useRef(null)
  const maxHistoryLength = 60

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatBytesPerSec = (bytesPerSec) => {
    if (bytesPerSec === 0) return '0 B/s'
    if (bytesPerSec < 1024) return Math.round(bytesPerSec) + ' B/s'
    if (bytesPerSec < 1024 * 1024) return Math.round(bytesPerSec / 1024 * 100) / 100 + ' KB/s'
    if (bytesPerSec < 1024 * 1024 * 1024) return Math.round(bytesPerSec / (1024 * 1024) * 100) / 100 + ' MB/s'
    return Math.round(bytesPerSec / (1024 * 1024 * 1024) * 100) / 100 + ' GB/s'
  }

  const getTemperatureColor = (temp) => {
    if (!temp) return 'text-slate-400'
    if (temp < 40) return 'text-blue-400'
    if (temp < 60) return 'text-emerald-400'
    if (temp < 75) return 'text-yellow-400'
    if (temp < 85) return 'text-orange-400'
    return 'text-red-400'
  }

  const getTemperatureBgColor = (temp) => {
    if (!temp) return 'bg-slate-500/20'
    if (temp < 40) return 'bg-blue-500/20'
    if (temp < 60) return 'bg-emerald-500/20'
    if (temp < 75) return 'bg-yellow-500/20'
    if (temp < 85) return 'bg-orange-500/20'
    return 'bg-red-500/20'
  }

  const getDiskColor = (usage) => {
    if (usage < 50) return 'text-emerald-400'
    if (usage < 75) return 'text-yellow-400'
    if (usage < 90) return 'text-orange-400'
    return 'text-red-400'
  }

  const getDiskBadgeClass = (usage) => {
    if (usage < 50) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    if (usage < 75) return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    if (usage < 90) return 'bg-orange-500/15 text-orange-300 border-orange-500/30'
    return 'bg-red-500/15 text-red-300 border-red-500/30'
  }

  useEffect(() => {
    if (stats) {
      const statsChanged = !lastStatsRef.current ||
        lastStatsRef.current.cpu !== stats.cpu ||
        lastStatsRef.current.memory !== stats.memory ||
        lastStatsRef.current.disk !== stats.disk ||
        lastStatsRef.current.network !== stats.network

      if (statsChanged) {
        const now = new Date()
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
        setHistoryData(prev => [...prev, {
          time: timestamp,
          cpu: stats.cpu || 0,
          memory: stats.memory || 0,
          disk: stats.disk || 0,
          network: stats.network || 0,
        }].slice(-maxHistoryLength))
        lastStatsRef.current = { ...stats }
      }
    }
  }, [stats])

  const metrics = [
    { id: 'cpu', name: 'CPU Usage', value: stats?.cpu || 0, icon: Cpu, color: 'text-blue-400', bgColor: 'bg-blue-500/20', chartColor: '#60a5fa', dataKey: 'cpu', unit: '%', accentClass: 'hover:border-blue-500/30' },
    { id: 'memory', name: 'Memory', value: stats?.memory || 0, icon: Activity, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', chartColor: '#34d399', dataKey: 'memory', unit: '%', accentClass: 'hover:border-emerald-500/30' },
    { id: 'disk', name: 'Disk Usage', value: stats?.disk || 0, icon: HardDrive, color: 'text-violet-400', bgColor: 'bg-violet-500/20', chartColor: '#a78bfa', dataKey: 'disk', unit: '%', accentClass: 'hover:border-violet-500/30' },
    { id: 'network', name: 'Network', value: stats?.network || 0, icon: Wifi, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', chartColor: '#22d3ee', dataKey: 'network', unit: 'MB/s', isThroughput: true, accentClass: 'hover:border-cyan-500/30' },
  ]

  const getDetailedStats = (metricId) => {
    if (!stats) return null
    switch (metricId) {
      case 'cpu': return { current: stats.cpu || 0, unit: '%', description: 'CPU usage represents the percentage of processor capacity currently in use.' }
      case 'memory': return { current: stats.memory || 0, unit: '%', description: 'Memory usage shows the percentage of RAM currently in use.' }
      case 'disk': return { current: stats.disk || 0, unit: '%', description: 'Disk usage indicates the percentage of storage space currently occupied.' }
      case 'network': {
        const totalThroughput = (stats.details?.network?.rx_sec || 0) + (stats.details?.network?.tx_sec || 0)
        return { current: formatBytesPerSec(totalThroughput), currentValue: stats.network || 0, unit: '', description: 'Network throughput shows the total data transfer rate (RX + TX).' }
      }
      default: return null
    }
  }

  if (loading) {
    return (
      <Card className="bg-white/4 border-white/8">
        <CardHeader><Skeleton className="h-6 w-40 bg-white/5" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl bg-white/5" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectedMetricData = selectedMetric ? metrics.find(m => m.id === selectedMetric) : null
  const detailedStats = selectedMetric ? getDetailedStats(selectedMetric) : null

  const MetricDetailModal = () => {
    if (!selectedMetricData || !detailedStats) return null

    const chartData = useMemo(() => {
      if (historyData.length > 0) return historyData
      const now = new Date()
      const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      const currentValue = selectedMetricData.id === 'network'
        ? (detailedStats?.currentValue ?? stats?.network ?? 0)
        : detailedStats.current
      return [{ time: timestamp, [selectedMetricData.dataKey]: currentValue }]
    }, [historyData, selectedMetricData?.dataKey, selectedMetricData?.id, detailedStats?.current, detailedStats?.currentValue, stats?.network])

    const isNetworkMetric = selectedMetricData.id === 'network'
    const chartMaxValue = useMemo(() => {
      if (isNetworkMetric) {
        const currentValue = detailedStats?.currentValue ?? 0
        const maxValue = Math.max(...chartData.map(d => d[selectedMetricData.dataKey] || 0), currentValue)
        return Math.ceil(maxValue * 1.2) || 10
      }
      return 100
    }, [chartData, selectedMetricData?.dataKey, isNetworkMetric, detailedStats?.currentValue])

    const modalContent = (
      <Dialog open={true} onOpenChange={(open) => { if (!open) setSelectedMetric(null) }}>
        <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-4xl w-full">
        <motion.div
          {...scaleIn}
          className="bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh]"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', selectedMetricData.bgColor.replace('bg-', 'bg-').replace('/20', '/15'))}>
                <selectedMetricData.icon className={cn('w-5 h-5', selectedMetricData.color)} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{selectedMetricData.name}</h3>
                <p className="text-xs text-slate-500">{detailedStats.description}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedMetric(null)} className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="bg-white/4 border border-white/8 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-500">Current Value</span>
                <span className={cn('text-4xl font-bold tabular-nums', selectedMetricData.color)}>
                  {detailedStats.current}{detailedStats.unit}
                </span>
              </div>
              {!isNetworkMetric && (
                <Progress
                  value={Math.min(parseFloat(detailedStats.current) || 0, 100)}
                  className="h-2 bg-white/5"
                />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Historical Trend</h4>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} key={selectedMetricData.id} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`color${selectedMetricData.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selectedMetricData.chartColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={selectedMetricData.chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} interval={chartData.length > 10 ? Math.max(0, Math.floor(chartData.length / 10)) : 0} />
                  <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, chartMaxValue]} tickFormatter={isNetworkMetric ? (v) => `${v.toFixed(1)}M` : (v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#e2e8f0', fontSize: '12px' }}
                    labelStyle={{ color: '#6b7280' }}
                    formatter={isNetworkMetric ? (v) => [`${v.toFixed(2)} MB/s`, selectedMetricData.name] : (v) => [`${v}%`, selectedMetricData.name]}
                  />
                  <Area type="monotone" dataKey={selectedMetricData.dataKey} stroke={selectedMetricData.chartColor} fillOpacity={1} fill={`url(#color${selectedMetricData.id})`} strokeWidth={2} isAnimationActive={false} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
        </DialogContent>
      </Dialog>
    )

    return modalContent
  }

  const renderMetricCard = (metric) => {
    const Icon = metric.icon
    const details = stats?.details

    const cardBase = cn(
      'bg-white/4 border border-white/8 rounded-xl p-5 cursor-pointer transition-all duration-200 text-left w-full group',
      'hover:border-white/15 hover:bg-white/6 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20',
      metric.accentClass
    )

    if (metric.id === 'cpu') {
      const cores = details?.cpu?.cores || details?.cpu?.physicalCores || 0
      const temp = details?.cpu?.temperature
      return (
        <button key={metric.id} onClick={() => setSelectedMetric(metric.id)} className={cardBase}>
          <div className="flex items-start justify-between mb-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', metric.bgColor)}>
              <Icon className={cn('w-4 h-4', metric.color)} />
            </div>
            <span className={cn('text-2xl font-bold tabular-nums', metric.color)}>{metric.value}{metric.unit}</span>
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{metric.name}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Cores</span>
              <span className="text-slate-400 font-medium">{cores}</span>
            </div>
            {temp !== null && temp !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Temperature</span>
                <span className={cn('font-medium', getTemperatureColor(temp))}>{Math.round(temp)}°C</span>
              </div>
            )}
            <Progress value={Math.min(metric.value, 100)} className="h-1.5 bg-white/5 mt-1" />
          </div>
        </button>
      )
    }

    if (metric.id === 'memory') {
      const totalGB = details?.memory?.totalGB || 0
      const usedGB = details?.memory?.usedGB || 0
      const usedMB = details?.memory?.usedMB || 0
      return (
        <button key={metric.id} onClick={() => setSelectedMetric(metric.id)} className={cardBase}>
          <div className="flex items-start justify-between mb-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', metric.bgColor)}>
              <Icon className={cn('w-4 h-4', metric.color)} />
            </div>
            <span className={cn('text-2xl font-bold tabular-nums', metric.color)}>{metric.value}{metric.unit}</span>
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{metric.name}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Total</span>
              <span className="text-slate-400 font-medium">{totalGB} GB</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Used</span>
              <span className="text-slate-400 font-medium">{usedGB >= 1 ? `${usedGB} GB` : `${usedMB} MB`}</span>
            </div>
            <Progress value={Math.min(metric.value, 100)} className="h-1.5 bg-white/5 mt-1" />
          </div>
        </button>
      )
    }

    if (metric.id === 'disk') {
      const totalGB = details?.disk?.totalGB || 0
      const usedGB = details?.disk?.usedGB || 0
      return (
        <button key={metric.id} onClick={() => setSelectedMetric(metric.id)} className={cardBase}>
          <div className="flex items-start justify-between mb-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', metric.bgColor)}>
              <Icon className={cn('w-4 h-4', metric.color)} />
            </div>
            <span className={cn('text-2xl font-bold tabular-nums', getDiskColor(metric.value))}>{metric.value}{metric.unit}</span>
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{metric.name}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Total (/)</span>
              <span className="text-slate-400 font-medium">{totalGB} GB</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Used</span>
              <Badge className={cn('text-xs border h-5 px-1.5', getDiskBadgeClass(metric.value))}>{usedGB} GB</Badge>
            </div>
            <Progress value={Math.min(metric.value, 100)} className="h-1.5 bg-white/5 mt-1" />
          </div>
        </button>
      )
    }

    if (metric.id === 'network') {
      const rxSec = details?.network?.rx_sec || 0
      const txSec = details?.network?.tx_sec || 0
      const formattedValue = formatBytesPerSec(rxSec + txSec)
      return (
        <button key={metric.id} onClick={() => setSelectedMetric(metric.id)} className={cardBase}>
          <div className="flex items-start justify-between mb-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', metric.bgColor)}>
              <Icon className={cn('w-4 h-4', metric.color)} />
            </div>
            <span className={cn('text-2xl font-bold tabular-nums', metric.color)}>{formattedValue}</span>
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{metric.name}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">RX</span>
              <span className="text-slate-400 font-medium">{formatBytesPerSec(rxSec)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">TX</span>
              <span className="text-slate-400 font-medium">{formatBytesPerSec(txSec)}</span>
            </div>
          </div>
        </button>
      )
    }

    return (
      <button key={metric.id} onClick={() => setSelectedMetric(metric.id)} className={cardBase}>
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', metric.bgColor)}>
            <Icon className={cn('w-4 h-4', metric.color)} />
          </div>
          <span className={cn('text-2xl font-bold tabular-nums', metric.color)}>{metric.value}{metric.unit}</span>
        </div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{metric.name}</p>
        <Progress value={Math.min(metric.value, 100)} className="h-1.5 bg-white/5" />
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white/4 border-white/8">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-slate-100">Server Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {metrics.map((metric) => (
              <motion.div key={metric.id} variants={staggerItem}>
                {renderMetricCard(metric)}
              </motion.div>
            ))}
          </motion.div>
        </CardContent>
      </Card>
      {selectedMetric && <MetricDetailModal />}
    </div>
  )
}

export default ServerAnalytics
