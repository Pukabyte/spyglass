import { useState, useEffect } from 'react'
import { Shield, Plus, Edit, Trash2, Check, X, Lock, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Separator } from './ui/separator'
import { ScrollArea } from './ui/scroll-area'
import { staggerContainer, staggerItem, fadeIn } from '../lib/animations'

const RoleManagement = ({ currentUser }) => {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const canView = currentUser?.permissions?.includes('users:view')
  const canCreate = currentUser?.permissions?.includes('users:create')
  const canEdit = currentUser?.permissions?.includes('users:edit')
  const canDelete = currentUser?.permissions?.includes('users:delete')

  useEffect(() => {
    if (canView) {
      fetchRoles()
      fetchPermissions()
    }
  }, [canView])

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setRoles(data)
      } else if (response.status === 403) {
        setError('You do not have permission to view roles')
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error)
      setError('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/users/permissions/list', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setPermissions(data)
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
    }
  }

  const handleDelete = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (response.ok) {
        setSuccess('Role deleted successfully')
        fetchRoles()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete role')
        setTimeout(() => setError(null), 3000)
      }
    } catch (error) {
      setError('Failed to delete role')
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleEdit = (role) => {
    setEditingRole(role)
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditingRole(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingRole(null)
  }

  const handleFormSuccess = () => {
    setSuccess(editingRole ? 'Role updated successfully' : 'Role created successfully')
    setShowForm(false)
    setEditingRole(null)
    fetchRoles()
    setTimeout(() => setSuccess(null), 3000)
  }

  if (!canView) {
    return (
      <div className="glass rounded-xl p-8 border border-white/10 text-center">
        <Shield className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-100 mb-2">Access Denied</h3>
        <p className="text-slate-400">You do not have permission to view role management.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="glass rounded-xl p-8 border border-white/10 text-center">
        <div className="text-slate-400">Loading roles...</div>
      </div>
    )
  }

  // Build grouped permissions (same logic as original)
  const permissionValues = Object.values(permissions)

  const groupedPermissions = permissionValues.reduce((acc, permissionValue) => {
    const category = permissionValue.split(':')[0]
    const categoryMap = {
      'dashboard': 'Dashboard',
      'server': 'Server',
      'docker': 'Docker',
      'saltbox': 'Saltbox',
      'config': 'Configuration',
      'widget': 'Widgets',
      'terminal': 'Terminal',
      'users': 'User Management',
      'appstore': 'App Store',
    }
    const categoryName = categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1)
    if (!acc[categoryName]) acc[categoryName] = []
    acc[categoryName].push({ value: permissionValue })
    return acc
  }, {})

  const categoryOrder = [
    'Dashboard', 'Server', 'Docker', 'Saltbox', 'Configuration',
    'Widgets', 'Terminal', 'User Management', 'App Store',
  ]

  const sortedGroupedPermissions = {}
  categoryOrder.forEach(category => {
    if (groupedPermissions[category]) {
      sortedGroupedPermissions[category] = groupedPermissions[category].sort((a, b) =>
        a.value.localeCompare(b.value)
      )
    }
  })
  Object.keys(groupedPermissions).forEach(category => {
    if (!sortedGroupedPermissions[category]) {
      sortedGroupedPermissions[category] = groupedPermissions[category].sort((a, b) =>
        a.value.localeCompare(b.value)
      )
    }
  })

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary-400" />
            <h2 className="text-2xl font-bold text-slate-100">Role Management</h2>
          </div>
          {canCreate && (
            <Button
              onClick={handleCreate}
              variant="outline"
              size="sm"
              className="glass border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200 gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Role
            </Button>
          )}
        </div>

        {/* Status messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-4"
            >
              <Badge variant="destructive" className="w-full justify-between py-2.5 px-3 text-sm font-normal rounded-lg">
                <span>{error}</span>
                <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
              </Badge>
            </motion.div>
          )}
          {success && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-4"
            >
              <Badge className="w-full justify-between py-2.5 px-3 text-sm font-normal rounded-lg bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">
                <span>{success}</span>
                <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Role cards */}
        {roles.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No roles found</p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-2"
          >
            {roles.map((role) => (
              <motion.div key={role.id} variants={staggerItem}>
                <Card className="bg-slate-800/30 border-white/5 hover:border-white/10 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-full bg-slate-700/50 border border-white/10 flex items-center justify-center flex-shrink-0">
                      {role.isSystem
                        ? <Lock className="w-4 h-4 text-blue-400" />
                        : <Shield className="w-4 h-4 text-slate-400" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-100">{role.displayName}</p>
                        <p className="text-xs text-slate-500 font-mono">{role.name}</p>
                      </div>
                      <p className="text-xs text-slate-400 col-span-1">{role.description || '—'}</p>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary-500/15 text-primary-300 border-primary-500/20 hover:bg-primary-500/15 text-xs">
                          {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={role.isSystem
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/20 hover:bg-blue-500/15 text-xs'
                          : 'bg-slate-700/50 text-slate-400 border-white/5 hover:bg-slate-700/50 text-xs'
                        }>
                          {role.isSystem ? 'System' : 'Custom'}
                        </Badge>
                        <span className="text-xs text-slate-600">
                          {new Date(role.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(role)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit role"
                        >
                          <Edit className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                        </button>
                      )}
                      {canDelete && !role.isSystem && (
                        <button
                          onClick={() => handleDelete(role.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete role"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Role form dialog */}
      {showForm && (
        <RoleForm
          role={editingRole}
          permissions={permissions}
          groupedPermissions={sortedGroupedPermissions}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          onError={(err) => {
            setError(err)
            setTimeout(() => setError(null), 3000)
          }}
        />
      )}
    </div>
  )
}

const RoleForm = ({ role, permissions, groupedPermissions: sortedGroupedPermissions, onClose, onSuccess, onError }) => {
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    permissions: [],
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (role) {
      setFormData({
        displayName: role.displayName || '',
        description: role.description || '',
        permissions: role.permissions || [],
      })
    }
  }, [role])

  const handlePermissionToggle = (permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }))
  }

  const handleCategoryToggle = (category) => {
    const categoryPerms = sortedGroupedPermissions[category]?.map(p => p.value) || []
    const allSelected = categoryPerms.every(p => formData.permissions.includes(p))

    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !categoryPerms.includes(p))
        : [...new Set([...prev.permissions, ...categoryPerms])]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        displayName: formData.displayName,
        description: formData.description,
        permissions: formData.permissions,
      }

      const url = role ? `/api/roles/${role.id}` : '/api/roles'
      const method = role ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        onError(data.error || 'Failed to save role')
      }
    } catch (error) {
      onError('Failed to save role')
    } finally {
      setLoading(false)
    }
  }

  const isCategorySelected = (category) => {
    const categoryPerms = sortedGroupedPermissions[category]?.map(p => p.value) || []
    return categoryPerms.length > 0 && categoryPerms.every(p => formData.permissions.includes(p))
  }

  const isCategoryPartial = (category) => {
    const categoryPerms = sortedGroupedPermissions[category]?.map(p => p.value) || []
    const selected = categoryPerms.filter(p => formData.permissions.includes(p))
    return selected.length > 0 && selected.length < categoryPerms.length
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-slate-100 sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <DialogTitle className="text-lg font-semibold text-slate-100">
            {role ? 'Edit Role' : 'Create Role'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            className="px-6 py-5"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-300">
                  Role Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                  disabled={role?.isSystem}
                  placeholder="e.g., Custom Role"
                  className="bg-slate-800/50 border-white/10 text-slate-100 focus-visible:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-500">Spaces will be converted to underscores automatically</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-slate-300">Description</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Role description..."
                  className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">Permissions</Label>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {Object.entries(sortedGroupedPermissions).map(([category, perms]) => {
                    const categorySelected = isCategorySelected(category)
                    const categoryPartial = isCategoryPartial(category)

                    return (
                      <div key={category} className="border border-white/10 rounded-lg p-3 bg-slate-800/20">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={categorySelected}
                            ref={(input) => {
                              if (input) {
                                input.indeterminate = categoryPartial && !categorySelected
                              }
                            }}
                            onChange={() => handleCategoryToggle(category)}
                            className="w-4 h-4 rounded border-white/10 bg-slate-800 text-primary-500 focus:ring-primary-500"
                          />
                          <span className="text-sm font-semibold text-slate-200">{category}</span>
                          <Badge variant="secondary" className="ml-auto text-xs bg-slate-700/50 text-slate-400 border-0 px-1.5 py-0">
                            {perms.filter(({ value }) => formData.permissions.includes(value)).length}/{perms.length}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 ml-6">
                          {perms.map(({ value }) => (
                            <label key={value} className="flex items-center gap-2 cursor-pointer text-xs group">
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(value)}
                                onChange={() => handlePermissionToggle(value)}
                                className="w-3.5 h-3.5 rounded border-white/10 bg-slate-800 text-primary-500 focus:ring-primary-500"
                              />
                              <span className="text-slate-400 group-hover:text-slate-300 transition-colors">{value}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-500">
                  {formData.permissions.length} permission{formData.permissions.length !== 1 ? 's' : ''} selected
                </p>
              </div>

              <Separator className="bg-white/5" />

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-white/10 bg-slate-800/50 hover:bg-white/10 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {role ? 'Update' : 'Create'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default RoleManagement
