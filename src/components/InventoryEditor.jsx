import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, FileText, Settings, User, Shield, Database, Plus, Info, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Dialog, DialogContent } from './ui/dialog'
import { cn } from '../lib/utils'
import { scaleIn, staggerContainer, staggerItem } from '../lib/animations'

const InventoryEditor = ({ onClose, precachedConfigs, inline = false, currentUser }) => {
  const [activeTab, setActiveTab] = useState('inventory')
  const [configs, setConfigs] = useState(precachedConfigs || {})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [newEntryKey, setNewEntryKey] = useState('')
  const [newEntryValue, setNewEntryValue] = useState('')
  const [newEntryType, setNewEntryType] = useState('string')
  const [multilineFields, setMultilineFields] = useState(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  const canEdit = currentUser?.permissions?.includes('config:edit')

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: FileText, file: 'inventory' },
    { id: 'settings', label: 'Settings', icon: Settings, file: 'settings' },
    { id: 'accounts', label: 'Accounts', icon: User, file: 'accounts' },
    { id: 'adv_settings', label: 'Advanced', icon: Shield, file: 'adv_settings' },
    { id: 'backup', label: 'Backup', icon: Database, file: 'backup' }
  ]

  const humanizeKey = (key) => {
    const abbreviations = ['api', 'ssh', 'dns', 'url', 'ip', 'id', 'cpu', 'ram', 'gpu', 'ssl', 'tls', 'http', 'https', 'ftp', 'smtp', 'imap', 'pop', 'sql', 'db', 'ui', 'sso', 'vpn', 'nas', 'vfs', 'hdr', 'uhd']
    return key.split('_').map(word => {
      const lower = word.toLowerCase()
      if (abbreviations.includes(lower)) return word.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }).join(' ')
  }

  const getAppNameFromKey = (key) => {
    const parts = key.split('_')
    if (parts.length < 2) return 'general'
    const firstPart = parts[0].toLowerCase()
    const systemPrefixes = ['shell', 'system', 'docker', 'traefik', 'cloudflare', 'dns', 'nvidia', 'backup', 'restore']
    if (systemPrefixes.includes(firstPart)) return firstPart
    return firstPart
  }

  const groupedSettings = useMemo(() => {
    const currentTab = tabs.find(t => t.id === activeTab)
    const currentConfig = currentTab ? configs[currentTab.file] : null
    if (!currentConfig?.data) return {}

    const groups = {}
    if (currentTab.file === 'inventory') {
      Object.entries(currentConfig.data).forEach(([key, value]) => {
        const appName = getAppNameFromKey(key)
        if (!groups[appName]) groups[appName] = []
        groups[appName].push({ key, value })
      })
    } else {
      Object.entries(currentConfig.data).forEach(([key, value]) => {
        groups[key] = [{ key, value }]
      })
    }

    const sortedGroups = {}
    Object.keys(groups).sort((a, b) => {
      if (a === 'general') return -1
      if (b === 'general') return 1
      return a.localeCompare(b)
    }).forEach(key => {
      sortedGroups[key] = groups[key].sort((a, b) => a.key.localeCompare(b.key))
    })
    return sortedGroups
  }, [configs, activeTab])

  const toggleGroup = (groupName) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) next.delete(groupName)
      else next.add(groupName)
      return next
    })
  }

  const collapseAllGroups = () => setCollapsedGroups(new Set(Object.keys(groupedSettings)))
  const expandAllGroups = () => setCollapsedGroups(new Set())

  const getVariableType = (key) => {
    if (key.endsWith('_custom')) return 'custom'
    if (key.endsWith('_default')) return 'default'
    if (key.includes('_docker_') || key.includes('_traefik_')) return 'docker'
    if (key.includes('_instances')) return 'instances'
    if (key.includes('_enabled')) return 'enabled'
    return 'standard'
  }

  const getVariableHint = (key) => {
    const hints = {
      'media_servers_enabled': 'Array of enabled media servers: ["emby", "plex", "jellyfin"]',
      'download_clients_enabled': 'Array of enabled download clients: ["deluge", "nzbget", "qbittorrent"]',
      'download_indexers_enabled': 'Array of enabled indexers: ["prowlarr", "nzbhydra2"]',
      'plex_open_main_ports': 'Boolean: true to open Plex ports for local access',
      'plex_open_local_ports': 'Boolean: true to open Plex local ports',
      'plex_docker_image_tag': 'String: Docker image tag (e.g., "beta", "release", "nightly")',
      'sonarr_docker_image_tag': 'String: Docker image tag (e.g., "release", "nightly")',
      'radarr_docker_image_tag': 'String: Docker image tag (e.g., "release", "nightly")',
      'shell_bash_bashrc_block_custom': 'Multiline: Use pipe (|) syntax for multiline shell aliases',
      'shell_zsh_zshrc_block_custom': 'Multiline: Use pipe (|) syntax for multiline shell aliases',
      'overseerr_docker_dns_servers': 'Array of DNS servers: ["8.8.8.8", "8.8.4.4"]',
      'saltbox_roles': 'Array of Saltbox roles to install',
      'sandbox_roles': 'Array of Sandbox roles to install',
    }
    if (key.endsWith('_docker_volumes_custom')) return 'Array: Add custom Docker volumes (e.g., ["/srv:/host_srv", "/home:/host_home"])'
    if (key.endsWith('_docker_envs_custom')) return 'Object: Add custom environment variables (e.g., {"KEY": "value"})'
    if (key.endsWith('_traefik_sso_middleware')) return 'String: Set to "" to disable Authelia, or "{{ traefik_default_sso_middleware }}" to enable'
    if (key.includes('_web_subdomain')) return 'String: Subdomain for the app (e.g., "stats" for stats.domain.tld)'
    if (key.includes('_web_domain')) return 'String: Base domain for the app (e.g., "example.com")'
    return hints[key] || null
  }

  const configTooltips = {
    'apprise': 'Notification services webhook URL',
    'cloudflare.email': 'Email used for the Cloudflare account',
    'cloudflare.api': 'Cloudflare Global API Key',
    'dockerhub.user': 'Docker Hub account name for increased pull capacity',
    'dockerhub.token': 'Docker Hub account token (not password)',
    'user.name': 'Username created during installation; cannot be root',
    'user.pass': 'Password for the created user account',
    'user.domain': 'Domain name for the server',
    'user.email': 'Email address for Let\'s Encrypt SSL certificates',
    'user.ssh_key': 'SSH public key or GitHub URL for authorized_keys',
    'authelia.master': 'Toggles whether Authelia is installed on current server',
    'authelia.subdomain': 'Subdomain used for Authelia access',
    'downloads': 'Folder path for docker /downloads volume',
    'rclone.enabled': 'Toggle to enable/disable Rclone deployments',
    'rclone.version': 'Rclone version (latest, beta, or specific version)',
    'rclone.remotes': 'List of Rclone remotes to configure',
    'shell': 'System shell (bash or zsh)',
    'transcodes': 'Folder path for temporary transcode files',
    'remote': 'Name of the Rclone remote to use',
    'mount': 'Toggles mounting remote into filesystem',
    'template': 'Mount template type (google, dropbox, sftp, custom)',
    'union': 'Toggles inclusion in /mnt/unionfs union',
    'upload': 'Toggles Cloudplow upload capability',
    'upload_from': 'Local path Cloudplow uses for uploads',
    'enable_refresh': 'Toggle to enable refresh functionality',
    'vfs_cache': 'VFS cache settings for Rclone',
    'enabled': 'Toggle to enable this feature',
    'max_age': 'Maximum age of cached files',
    'size': 'Maximum cache size',
    'dns.ipv4': 'Toggle Saltbox management of IPv4 A records',
    'dns.ipv6': 'Toggle Saltbox management of IPv6 AAAA records',
    'dns.proxied': 'Toggle Cloudflare CDN proxy state for records',
    'docker.json_driver': 'Change logging driver from local to json-file',
    'gpu.intel': 'Toggle Intel GPU-related tasks',
    'mounts.ipv4_only': 'Limit Rclone to IPv4 if routing issues occur',
    'system.timezone': 'Server timezone (auto or tz database value)',
    'traefik.cert.http_validation': 'Toggle HTTP-01 certificate validation',
    'traefik.cert.zerossl': 'Toggle ZeroSSL instead of Let\'s Encrypt',
    'traefik.error_pages': 'Toggle custom Traefik error pages',
    'traefik.hsts': 'Toggle HSTS security header usage',
    'traefik.metrics': 'Toggle Traefik Prometheus metrics endpoint',
    'traefik.provider': 'DNS validation provider supported by Traefik',
    'traefik.subdomains.dash': 'Subdomain for Traefik dashboard access',
    'traefik.subdomains.metrics': 'Subdomain for metrics endpoint access',
    'backup.cron': 'Cron schedule for automatic backups',
    'backup.keep': 'Number of backups to keep',
    'backup.local': 'Local backup settings',
    'backup.rclone': 'Rclone backup destination settings',
    'backup.rsync': 'Rsync backup destination settings',
    'backup.restore': 'Restore settings',
  }

  const getConfigTooltip = (key, path) => {
    const currentTab = tabs.find(t => t.id === activeTab)
    if (currentTab?.file === 'inventory') return null
    const fullPath = path ? `${path}.${key}` : key
    if (configTooltips[fullPath]) return configTooltips[fullPath]
    if (configTooltips[key]) return configTooltips[key]
    return null
  }

  useEffect(() => {
    if (!precachedConfigs || Object.keys(precachedConfigs).length === 0) {
      loadAllConfigs()
    }
  }, [])

  const loadAllConfigs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/config/all', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || {})
      } else {
        setError('Failed to load config files')
      }
    } catch (err) {
      setError(`Error loading configs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadConfig = async (file) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/config/${file}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfigs(prev => ({ ...prev, [file]: { data: data.data, raw: data.raw, exists: true } }))
      } else {
        setError(`Failed to load ${file}`)
      }
    } catch (err) {
      setError(`Error loading ${file}: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!canEdit) { alert('You do not have permission to edit configuration files'); return }
    const currentTab = tabs.find(t => t.id === activeTab)
    if (!currentTab) return
    const file = currentTab.file
    const config = configs[file]
    if (!config || !config.data) { setError('No data to save'); return }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/config/${file}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data: config.data }),
      })
      if (response.ok) {
        setSuccess('Config saved successfully')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save config')
      }
    } catch (err) {
      setError(`Error saving config: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const updateValue = (path, value) => {
    const currentTab = tabs.find(t => t.id === activeTab)
    if (!currentTab) return
    const file = currentTab.file
    const config = configs[file]
    if (!config || !config.data) return

    const keys = path.split('.')
    const newData = JSON.parse(JSON.stringify(config.data))
    let current = newData
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current)) current[key] = {}
      current = current[key]
    }
    const lastKey = keys[keys.length - 1]
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (value === '') value = null
    else if (!isNaN(value) && value !== '') value = Number(value)
    else if (value.startsWith('[') || value.startsWith('{')) {
      try { value = JSON.parse(value) } catch (e) {}
    }
    current[lastKey] = value
    setConfigs(prev => ({ ...prev, [file]: { ...config, data: newData } }))
  }

  const addArrayItem = (path) => {
    const currentTab = tabs.find(t => t.id === activeTab)
    if (!currentTab) return
    const file = currentTab.file
    const config = configs[file]
    if (!config || !config.data) return
    const keys = path.split('.')
    const newData = JSON.parse(JSON.stringify(config.data))
    let current = newData
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current)) current[key] = {}
      current = current[key]
    }
    const lastKey = keys[keys.length - 1]
    if (!Array.isArray(current[lastKey])) current[lastKey] = []
    current[lastKey].push('')
    setConfigs(prev => ({ ...prev, [file]: { ...config, data: newData } }))
  }

  const removeArrayItem = (path, index) => {
    const currentTab = tabs.find(t => t.id === activeTab)
    if (!currentTab) return
    const file = currentTab.file
    const config = configs[file]
    if (!config || !config.data) return
    const keys = path.split('.')
    const newData = JSON.parse(JSON.stringify(config.data))
    let current = newData
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]
    const lastKey = keys[keys.length - 1]
    if (Array.isArray(current[lastKey])) current[lastKey].splice(index, 1)
    setConfigs(prev => ({ ...prev, [file]: { ...config, data: newData } }))
  }

  const removeField = (path) => {
    const currentTab = tabs.find(t => t.id === activeTab)
    if (!currentTab) return
    const file = currentTab.file
    const config = configs[file]
    if (!config || !config.data) return
    const keys = path.split('.')
    const newData = JSON.parse(JSON.stringify(config.data))
    if (keys.length === 1) {
      delete newData[keys[0]]
    } else {
      let current = newData
      for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]
      delete current[keys[keys.length - 1]]
    }
    setConfigs(prev => ({ ...prev, [file]: { ...config, data: newData } }))
  }

  const handleAddCustomEntry = () => {
    if (!newEntryKey.trim()) { setError('Entry key is required'); return }
    const currentTab = tabs.find(t => t.id === activeTab)
    if (!currentTab || currentTab.file !== 'inventory') return
    const file = currentTab.file
    const config = configs[file]
    if (!config || !config.data) return
    const newData = JSON.parse(JSON.stringify(config.data))
    if (newData[newEntryKey] !== undefined) { setError(`Key "${newEntryKey}" already exists`); return }

    let value = newEntryValue
    if (newEntryType === 'boolean') value = newEntryValue === 'true' || newEntryValue === '1'
    else if (newEntryType === 'number') value = parseFloat(newEntryValue) || 0
    else if (newEntryType === 'array') {
      try { value = newEntryValue ? JSON.parse(newEntryValue) : [] }
      catch (e) { value = newEntryValue.split(',').map(v => v.trim()).filter(v => v) }
    } else if (newEntryType === 'object') {
      try { value = newEntryValue ? JSON.parse(newEntryValue) : {} }
      catch (e) { setError('Invalid JSON for object type'); return }
    }

    newData[newEntryKey] = value
    setConfigs(prev => ({ ...prev, [file]: { ...config, data: newData } }))
    setNewEntryKey('')
    setNewEntryValue('')
    setNewEntryType('string')
    setShowAddCustom(false)
    setError(null)
  }

  const toggleMultiline = (path) => {
    setMultilineFields(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const inputClass = cn(
    'bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600',
    'focus-visible:ring-violet-500/30 focus-visible:border-violet-500/50',
    !canEdit && 'opacity-50 cursor-not-allowed'
  )

  const renderField = (key, value, path = '') => {
    const fullPath = path ? `${path}.${key}` : key
    const varType = getVariableType(key)
    const currentTab = tabs.find(t => t.id === activeTab)
    const hint = currentTab?.file === 'inventory' ? getVariableHint(key) : getConfigTooltip(key, path)
    const isMultiline = multilineFields.has(fullPath)
    const isStringArray = Array.isArray(value) && value.every(item => typeof item === 'string')

    const varTypeBadge = varType === 'custom'
      ? <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-xs border h-5 px-1.5">Custom</Badge>
      : varType === 'default'
      ? <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 text-xs border h-5 px-1.5">Override</Badge>
      : null

    const hintEl = hint && (
      <div className="mb-2 p-2.5 bg-blue-500/8 border border-blue-500/15 rounded-lg text-xs text-blue-300 flex items-start gap-2">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-400" />
        <span>{hint}</span>
      </div>
    )

    const removeBtn = activeTab === 'inventory' && path === '' && canEdit && (
      <button
        onClick={() => removeField(fullPath)}
        className="text-xs px-2 py-1 rounded-md border border-red-500/25 hover:bg-red-500/15 text-red-400 transition-colors"
        title="Remove this entry"
      >
        × Remove
      </button>
    )

    if (value === null || value === undefined) {
      return (
        <div key={fullPath} className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-slate-300">{humanizeKey(key)}</Label>
              {varTypeBadge}
            </div>
            {removeBtn}
          </div>
          {hintEl}
          <Input value="" onChange={(e) => updateValue(fullPath, e.target.value)} placeholder="Enter value" disabled={!canEdit} className={inputClass} />
        </div>
      )
    }

    if (typeof value === 'boolean') {
      return (
        <div key={fullPath} className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => updateValue(fullPath, e.target.checked)}
                  disabled={!canEdit}
                  className={cn('w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500', !canEdit && 'opacity-50 cursor-not-allowed')}
                />
                <span className="text-sm font-medium text-slate-300">{humanizeKey(key)}</span>
              </Label>
              {varTypeBadge}
            </div>
            {removeBtn}
          </div>
          {hint && <div className="mt-2">{hintEl}</div>}
        </div>
      )
    }

    if (typeof value === 'number') {
      return (
        <div key={fullPath} className="mb-4">
          <Label className="text-sm font-medium text-slate-300 mb-1.5 block">{humanizeKey(key)}</Label>
          <Input type="number" value={value} onChange={(e) => updateValue(fullPath, e.target.value)} disabled={!canEdit} className={inputClass} />
        </div>
      )
    }

    if (Array.isArray(value)) {
      return (
        <div key={fullPath} className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-slate-300">{humanizeKey(key)}</Label>
              {varTypeBadge}
            </div>
            {canEdit && (
              <button
                onClick={() => addArrayItem(fullPath)}
                className="text-xs px-2 py-1 rounded-md border border-white/10 hover:bg-white/8 text-slate-400 hover:text-slate-200 transition-colors"
              >
                + Add
              </button>
            )}
          </div>
          {hintEl}
          <div className="space-y-2">
            {value.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={typeof item === 'object' ? JSON.stringify(item) : item}
                  onChange={(e) => {
                    const newArray = [...value]
                    if (isStringArray) newArray[index] = e.target.value
                    else { try { newArray[index] = JSON.parse(e.target.value) } catch { newArray[index] = e.target.value } }
                    updateValue(fullPath, newArray)
                  }}
                  disabled={!canEdit}
                  placeholder={isStringArray ? 'Enter string value' : 'Enter value or JSON'}
                  className={inputClass}
                />
                {canEdit && (
                  <button onClick={() => removeArrayItem(fullPath, index)} className="px-2 py-1.5 rounded-md border border-red-500/25 hover:bg-red-500/15 text-red-400 transition-colors text-sm flex-shrink-0">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (typeof value === 'object') {
      return (
        <div key={fullPath} className="mb-4 border-l-2 border-white/8 pl-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">{humanizeKey(key)}</h3>
          <div className="space-y-2">
            {Object.entries(value).map(([subKey, subValue]) => renderField(subKey, subValue, fullPath))}
          </div>
        </div>
      )
    }

    const shouldBeMultiline = key.includes('_block_') || (key.includes('_custom') && typeof value === 'string' && value.includes('\n'))
    const useMultiline = isMultiline || shouldBeMultiline

    return (
      <div key={fullPath} className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-slate-300">{humanizeKey(key)}</Label>
            {varTypeBadge}
          </div>
          <div className="flex items-center gap-1.5">
            {typeof value === 'string' && canEdit && (
              <button
                onClick={() => toggleMultiline(fullPath)}
                className="text-xs px-2 py-1 rounded-md border border-white/10 hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {useMultiline ? 'Single' : 'Multi'}
              </button>
            )}
            {removeBtn}
          </div>
        </div>
        {hintEl}
        {useMultiline ? (
          <textarea
            value={value}
            onChange={(e) => updateValue(fullPath, e.target.value)}
            disabled={!canEdit}
            rows={6}
            placeholder="Enter multiline value (use pipe | syntax in YAML for multiline strings)"
            className={cn(
              'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 font-mono text-sm',
              'focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30',
              !canEdit && 'opacity-50 cursor-not-allowed'
            )}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => updateValue(fullPath, e.target.value)}
            disabled={!canEdit}
            className={inputClass}
          />
        )}
      </div>
    )
  }

  const currentTab = tabs.find(t => t.id === activeTab)
  const currentConfig = currentTab ? configs[currentTab.file] : null

  const content = (
    <div className={cn(
      'bg-slate-900/98 border border-white/10 rounded-2xl flex flex-col',
      inline ? 'w-full' : 'max-w-4xl w-full max-h-[90vh]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Edit Configuration</h3>
          {!canEdit && <p className="text-xs text-slate-500 mt-0.5">Read-only access</p>}
        </div>
        {!inline && onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-white/8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 border-b border-white/8 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const config = configs[tab.file]
          const exists = config && config.exists !== false
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (!config || !config.data) loadConfig(tab.file)
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5',
                !exists && 'opacity-50'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {!exists && <span className="text-xs text-slate-600">(missing)</span>}
            </button>
          )
        })}
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {loading && !currentConfig ? (
          <div className="text-center py-10 text-slate-500 text-sm">Loading...</div>
        ) : currentConfig && currentConfig.data ? (
          <div className="space-y-3">
            {Object.keys(groupedSettings).length > 1 && (
              <div className="flex items-center justify-between pb-3 border-b border-white/8">
                <span className="text-xs text-slate-500">
                  {Object.keys(groupedSettings).length} groups · {Object.values(currentConfig.data).length} settings
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={expandAllGroups} className="text-xs h-7 px-2.5 border-white/10 hover:bg-white/8 text-slate-400 hover:text-slate-200">
                    Expand All
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAllGroups} className="text-xs h-7 px-2.5 border-white/10 hover:bg-white/8 text-slate-400 hover:text-slate-200">
                    Collapse All
                  </Button>
                </div>
              </div>
            )}

            {Object.entries(groupedSettings).map(([groupName, items]) => {
              const isCollapsed = collapsedGroups.has(groupName)
              const displayName = groupName.charAt(0).toUpperCase() + groupName.slice(1)
              return (
                <div key={groupName} className="border border-white/8 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      }
                      <span className="font-semibold text-slate-200 text-sm">{displayName}</span>
                      <Badge className="bg-white/8 text-slate-400 border-0 text-xs h-5 px-1.5">
                        {items.length}
                      </Badge>
                    </div>
                  </button>
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-4 border-t border-white/5 space-y-1">
                          {items.map(({ key, value }) => {
                            const ct = tabs.find(t => t.id === activeTab)
                            if (ct?.file !== 'inventory' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
                              return Object.entries(value).map(([subKey, subValue]) => renderField(subKey, subValue, key))
                            }
                            return renderField(key, value)
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {/* Add Custom Entry (inventory only) */}
            {activeTab === 'inventory' && canEdit && (
              <div className="mt-2 pt-4 border-t border-white/8">
                <AnimatePresence mode="wait">
                  {!showAddCustom ? (
                    <motion.div key="add-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddCustom(true)}
                        className="border-violet-500/30 bg-violet-500/8 text-violet-300 hover:bg-violet-500/15 hover:border-violet-500/50"
                      >
                        <Plus className="w-3.5 h-3.5 mr-2" />
                        Add Custom Entry
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="add-form"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-200">Add Custom Entry</h4>
                        <Button variant="ghost" size="icon" onClick={() => { setShowAddCustom(false); setNewEntryKey(''); setNewEntryValue(''); setNewEntryType('string'); setError(null) }} className="h-7 w-7 text-slate-500 hover:text-slate-300">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-400 mb-1.5 block">Key</Label>
                        <Input
                          value={newEntryKey}
                          onChange={(e) => setNewEntryKey(e.target.value)}
                          placeholder="e.g., my_custom_variable"
                          className={inputClass}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddCustomEntry() }
                            if (e.key === 'Escape') { setShowAddCustom(false); setNewEntryKey(''); setNewEntryValue(''); setNewEntryType('string') }
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-400 mb-1.5 block">Type</Label>
                        <select
                          value={newEntryType}
                          onChange={(e) => setNewEntryType(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500/50"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="array">Array</option>
                          <option value="object">Object (JSON)</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-400 mb-1.5 block">Value</Label>
                        <Input
                          type={newEntryType === 'number' ? 'number' : 'text'}
                          value={newEntryValue}
                          onChange={(e) => setNewEntryValue(e.target.value)}
                          placeholder={
                            newEntryType === 'boolean' ? 'true or false' :
                            newEntryType === 'array' ? '["item1", "item2"] or comma-separated' :
                            newEntryType === 'object' ? '{"key": "value"}' : 'Enter value'
                          }
                          className={inputClass}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddCustomEntry() } }}
                        />
                        {newEntryType === 'boolean' && (
                          <div className="mt-2 flex gap-2">
                            <button onClick={() => setNewEntryValue('true')} className="text-xs px-2.5 py-1 rounded-md border border-white/10 hover:bg-white/8 text-slate-400 hover:text-slate-200 transition-colors">Set true</button>
                            <button onClick={() => setNewEntryValue('false')} className="text-xs px-2.5 py-1 rounded-md border border-white/10 hover:bg-white/8 text-slate-400 hover:text-slate-200 transition-colors">Set false</button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button onClick={handleAddCustomEntry} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white border-0">
                          Add Entry
                        </Button>
                        <Button variant="outline" onClick={() => { setShowAddCustom(false); setNewEntryKey(''); setNewEntryValue(''); setNewEntryType('string'); setError(null) }} className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : currentConfig && currentConfig.error ? (
          <div className="text-center py-10 text-red-400 text-sm">Error: {currentConfig.error}</div>
        ) : (
          <div className="text-center py-10 text-slate-500 text-sm">File not found or empty</div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/8">
        {!inline && onClose && (
          <Button variant="outline" onClick={onClose} className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={saving || !currentConfig || !currentConfig.data || !canEdit}
          className={cn(
            'min-w-[90px]',
            canEdit
              ? 'bg-violet-600 hover:bg-violet-500 text-white border-0 disabled:opacity-50'
              : 'bg-slate-700/50 border border-slate-600/50 text-slate-400 cursor-not-allowed'
          )}
          title={!canEdit ? 'You do not have permission to edit configuration files' : undefined}
        >
          <Save className="w-3.5 h-3.5 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )

  if (inline) return content

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-4xl w-full">
        <motion.div {...scaleIn} className="w-full max-w-4xl max-h-[90vh] flex flex-col">
          {content}
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}

export default InventoryEditor
