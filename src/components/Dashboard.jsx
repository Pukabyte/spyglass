import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DockerAppsGrid from './DockerAppsGrid'
import SaltboxControls from './SaltboxControls'
import InventoryEditor from './InventoryEditor'
import AppStore from './AppStore'
import Terminal from './Terminal'
import WidgetManager from './WidgetManager'
import CategorySection from './CategorySection'
import CategoryManager from './CategoryManager'
import { LayoutDashboard, Package, Store, Settings, Users, Shield, X, FolderCog } from 'lucide-react'
import UserManagement from './UserManagement'
import RoleManagement from './RoleManagement'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { pageTransition } from '../lib/animations'
import { cn } from '../lib/utils'

const TAB_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, permission: null },
  { id: 'docker',    label: 'Docker',    shortLabel: 'Docker', icon: Package, permission: 'docker:view' },
  { id: 'appstore',  label: 'App Store', shortLabel: 'Apps',   icon: Store,   permission: 'appstore:view' },
  { id: 'settings',  label: 'Settings',  shortLabel: 'Settings', icon: Settings,
    permission: ['config:view', 'config:edit', 'saltbox:view', 'saltbox:execute'] },
  { id: 'users',     label: 'Users',     shortLabel: 'Users',  icon: Users,   permission: 'users:view' },
  { id: 'roles',     label: 'Roles',     shortLabel: 'Roles',  icon: Shield,  permission: 'users:view' },
]

const hasPermission = (currentUser, permission) => {
  if (!permission) return true
  if (Array.isArray(permission)) {
    return permission.some(p => currentUser?.permissions?.includes(p))
  }
  return currentUser?.permissions?.includes(permission)
}

const Dashboard = ({ dockerApps, loading, onRefresh, showTerminal, onCloseTerminal, terminalCommand, precachedConfigs, currentUser }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [categories, setCategories] = useState([])
  const [allWidgets, setAllWidgets] = useState([])
  const [widgetsLoading, setWidgetsLoading] = useState(true)
  const [showCategoryManager, setShowCategoryManager] = useState(false)

  // Drag state
  const [draggedWidgetId, setDraggedWidgetId] = useState(null)
  const [dragSourceCategoryId, setDragSourceCategoryId] = useState(null)
  const [dragOverWidgetId, setDragOverWidgetId] = useState(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState(null)

  // Edit modal state
  const [editingWidget, setEditingWidget] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', url: '', apiKey: '', username: '', password: '', categoryId: '' })

  const fetchWidgets = useCallback(async () => {
    try {
      const response = await fetch('/api/widgets', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
        setAllWidgets(data.widgets || [])
      }
    } catch (error) {
      console.error('Failed to fetch widgets:', error)
    } finally {
      setWidgetsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchWidgets()
    }
  }, [activeTab, fetchWidgets])

  const handleWidgetAdded = () => fetchWidgets()

  const handleDeleteWidget = async (widgetId) => {
    // Optimistic removal - remove from UI immediately
    setAllWidgets(prev => prev.filter(w => w.id !== widgetId))
    setCategories(prev => prev.map(cat => ({
      ...cat,
      widgets: cat.widgets?.filter(w => w.id !== widgetId)
    })))
    try {
      const response = await fetch(`/api/widgets/${widgetId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) fetchWidgets() // revert on failure
    } catch (error) {
      console.error('Failed to delete widget:', error)
      fetchWidgets() // revert on error
    }
  }

  const findWidgetCategoryId = (widgetId) => {
    for (const cat of categories) {
      if (cat.widgets?.some(w => w.id === widgetId)) return cat.id
    }
    return '__uncategorized__'
  }

  const handleEditWidget = (widget) => {
    setEditingWidget(widget)
    setEditForm({
      title: widget.title || '',
      url: widget.url || '',
      apiKey: widget.apiKey || '',
      username: widget.username || '',
      password: widget.password || '',
      categoryId: findWidgetCategoryId(widget.id)
    })
  }

  const handleSaveEdit = async () => {
    if (!editingWidget) return
    try {
      const response = await fetch(`/api/widgets/${editingWidget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editForm.title,
          url: editForm.url,
          apiKey: editForm.apiKey,
          username: editForm.username || undefined,
          password: editForm.password || undefined
        })
      })
      if (response.ok) {
        const currentCatId = findWidgetCategoryId(editingWidget.id)
        if (editForm.categoryId && editForm.categoryId !== currentCatId) {
          await fetch(`/api/widgets/${editingWidget.id}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ targetCategoryId: editForm.categoryId })
          })
        }
        fetchWidgets()
        setEditingWidget(null)
      }
    } catch (error) {
      console.error('Failed to update widget:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingWidget(null)
    setEditForm({ title: '', url: '', apiKey: '', username: '', password: '', categoryId: '' })
  }

  const handleMoveWidget = async (widgetId, targetCategoryId) => {
    try {
      const response = await fetch(`/api/widgets/${widgetId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetCategoryId })
      })
      if (response.ok) fetchWidgets()
    } catch (error) {
      console.error('Failed to move widget:', error)
    }
  }

  // === Drag & Drop Handlers ===
  const handleDragStart = (widgetId, categoryId) => {
    setDraggedWidgetId(widgetId)
    setDragSourceCategoryId(categoryId)
  }

  const handleDragEnd = () => {
    setDraggedWidgetId(null)
    setDragSourceCategoryId(null)
    setDragOverWidgetId(null)
    setDragOverCategoryId(null)
  }

  const handleWidgetDragOver = (widgetId, e) => {
    e.preventDefault()
    if (widgetId !== draggedWidgetId) setDragOverWidgetId(widgetId)
  }

  const handleWidgetDrop = async (targetWidgetId, targetCategoryId, e) => {
    e.preventDefault()
    setDragOverWidgetId(null)
    setDragOverCategoryId(null)

    if (!draggedWidgetId || draggedWidgetId === targetWidgetId) return

    const sourceCatId = dragSourceCategoryId
    const targetCatId = targetCategoryId

    if (sourceCatId === targetCatId) {
      const cat = categories.find(c => c.id === targetCatId)
      if (!cat) return

      const widgetIds = cat.widgets.map(w => w.id)
      const draggedIdx = widgetIds.indexOf(draggedWidgetId)
      const targetIdx = widgetIds.indexOf(targetWidgetId)
      if (draggedIdx === -1 || targetIdx === -1) return

      const newIds = [...widgetIds]
      newIds.splice(draggedIdx, 1)
      newIds.splice(targetIdx, 0, draggedWidgetId)

      setCategories(prev => prev.map(c => {
        if (c.id !== targetCatId) return c
        const widgetMap = {}
        c.widgets.forEach(w => { widgetMap[w.id] = w })
        return { ...c, widgets: newIds.map(id => widgetMap[id]).filter(Boolean) }
      }))

      try {
        const response = await fetch('/api/widgets/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ categoryId: targetCatId, widgetIds: newIds })
        })
        if (!response.ok) fetchWidgets()
      } catch {
        fetchWidgets()
      }
    } else {
      const targetCat = categories.find(c => c.id === targetCatId)
      if (!targetCat) return
      const targetIdx = targetCat.widgets.findIndex(w => w.id === targetWidgetId)
      const position = targetIdx >= 0 ? targetIdx : undefined
      try {
        const response = await fetch(`/api/widgets/${draggedWidgetId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ targetCategoryId: targetCatId, position })
        })
        if (response.ok) fetchWidgets()
      } catch {
        fetchWidgets()
      }
    }
  }

  const handleSectionDragOver = (categoryId, e) => {
    e.preventDefault()
    setDragOverCategoryId(categoryId)
  }

  const handleSectionDragLeave = (categoryId) => {
    if (dragOverCategoryId === categoryId) setDragOverCategoryId(null)
  }

  const handleSectionDrop = async (targetCategoryId, e) => {
    e.preventDefault()
    setDragOverCategoryId(null)
    setDragOverWidgetId(null)
    if (!draggedWidgetId) return
    if (dragSourceCategoryId === targetCategoryId) return
    try {
      const response = await fetch(`/api/widgets/${draggedWidgetId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetCategoryId })
      })
      if (response.ok) fetchWidgets()
    } catch {
      fetchWidgets()
    }
  }

  const totalWidgets = allWidgets.length

  const visibleTabs = TAB_ITEMS.filter(tab => hasPermission(currentUser, tab.permission))

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto">
      {/* Tab Navigation — clean underline style */}
      <div className="mb-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-px">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 rounded-md',
                  isActive
                    ? 'text-slate-100'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-x-0 bottom-0 h-px bg-slate-300 rounded-full"
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  />
                )}
              </button>
            )
          })}
        </div>
        <Separator className="bg-slate-800" />
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={pageTransition.initial}
          animate={pageTransition.animate}
          exit={pageTransition.exit}
        >
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Dashboard</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Monitor your services and media servers</p>
                </div>
                <div className="flex items-center gap-2">
                  {currentUser?.permissions?.includes('dashboard:edit') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCategoryManager(true)}
                      className="text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 h-8 text-xs gap-1.5"
                    >
                      <FolderCog className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Manage Categories</span>
                      <span className="sm:hidden">Categories</span>
                    </Button>
                  )}
                  <WidgetManager
                    dockerApps={dockerApps}
                    onWidgetAdded={handleWidgetAdded}
                    categories={categories}
                    currentUser={currentUser}
                  />
                </div>
              </div>

              <div className="space-y-8">
                {categories.map((category) => (
                  <CategorySection
                    key={category.id}
                    category={category}
                    categories={categories}
                    isDragOver={dragOverCategoryId === category.id}
                    draggedWidgetId={draggedWidgetId}
                    dragOverWidgetId={dragOverWidgetId}
                    onDragStart={(widgetId) => handleDragStart(widgetId, category.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleWidgetDragOver}
                    onDrop={(targetWidgetId, e) => handleWidgetDrop(targetWidgetId, category.id, e)}
                    onSectionDragOver={handleSectionDragOver}
                    onSectionDragLeave={handleSectionDragLeave}
                    onSectionDrop={handleSectionDrop}
                    onDeleteWidget={handleDeleteWidget}
                    onEditWidget={handleEditWidget}
                    onMoveWidget={handleMoveWidget}
                    onRefreshWidgets={fetchWidgets}
                    currentUser={currentUser}
                  />
                ))}
              </div>

              {totalWidgets === 0 && !widgetsLoading && (
                <div className="text-center py-16 text-slate-600 text-sm">
                  No widgets added yet. Click &ldquo;Add Widget&rdquo; to get started.
                </div>
              )}
            </div>
          )}

          {activeTab === 'docker' && (
            <DockerAppsGrid apps={dockerApps} loading={loading} onRefresh={onRefresh} currentUser={currentUser} />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="max-w-2xl">
                <SaltboxControls onRefresh={onRefresh} currentUser={currentUser} />
              </div>
              <InventoryEditor
                onClose={null}
                precachedConfigs={precachedConfigs}
                inline={true}
                currentUser={currentUser}
              />
            </div>
          )}

          {activeTab === 'users' && <UserManagement currentUser={currentUser} />}

          {activeTab === 'roles' && <RoleManagement currentUser={currentUser} />}

          {activeTab === 'appstore' && <AppStore onInstall={onRefresh} currentUser={currentUser} />}
        </motion.div>
      </AnimatePresence>

      {showTerminal && <Terminal onClose={onCloseTerminal} initialCommand={terminalCommand} />}

      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onCategoriesChanged={fetchWidgets}
        />
      )}

      {/* Edit Widget Modal */}
      <AnimatePresence>
        {editingWidget && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bg-slate-900 border border-slate-800 rounded-t-xl sm:rounded-xl p-6 w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-slate-100">Edit Widget</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7 w-7 p-0 text-slate-500 hover:text-slate-200 hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="block text-xs font-medium text-slate-400 mb-1.5">Title</Label>
                  <Input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="Widget title"
                  />
                </div>

                <div>
                  <Label className="block text-xs font-medium text-slate-400 mb-1.5">Category</Label>
                  <Select
                    value={editForm.categoryId}
                    onValueChange={(val) => setEditForm(prev => ({ ...prev, categoryId: val }))}
                  >
                    <SelectTrigger className="bg-slate-800/60 border-slate-700 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!editingWidget.isSystemWidget && (
                  <>
                    <div>
                      <Label className="block text-xs font-medium text-slate-400 mb-1.5">URL</Label>
                      <Input
                        type="url"
                        value={editForm.url}
                        onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                        className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:ring-slate-500 focus:border-slate-500"
                        placeholder="https://example.com"
                      />
                    </div>

                    <div>
                      <Label className="block text-xs font-medium text-slate-400 mb-1.5">API Key</Label>
                      <Input
                        type="password"
                        value={editForm.apiKey}
                        onChange={(e) => setEditForm(prev => ({ ...prev, apiKey: e.target.value }))}
                        className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:ring-slate-500 focus:border-slate-500"
                        placeholder="Enter API key"
                      />
                    </div>

                    {editingWidget.appName?.toLowerCase() === 'emby' && (
                      <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg">
                        <p className="text-[11px] text-amber-500/80 mb-3">
                          User authentication required for Now Playing info
                        </p>
                        <div className="space-y-3">
                          <div>
                            <Label className="block text-xs font-medium text-slate-400 mb-1.5">Emby Username</Label>
                            <Input
                              type="text"
                              value={editForm.username}
                              onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                              className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:ring-slate-500 focus:border-slate-500"
                              placeholder="Admin username"
                            />
                          </div>
                          <div>
                            <Label className="block text-xs font-medium text-slate-400 mb-1.5">Emby Password</Label>
                            <Input
                              type="password"
                              value={editForm.password}
                              onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                              className="bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-600 focus:ring-slate-500 focus:border-slate-500"
                              placeholder="Password"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-slate-100 text-slate-900 hover:bg-white h-8 text-xs font-medium"
                >
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard
