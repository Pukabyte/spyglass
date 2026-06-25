import { useState, useEffect } from 'react'
import { Users, Plus, Edit, Trash2, Shield, Mail, User as UserIcon, Check, X, Loader2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Separator } from './ui/separator'
import { staggerContainer, staggerItem, fadeIn } from '../lib/animations'

const UserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const canView = currentUser?.permissions?.includes('users:view')
  const canCreate = currentUser?.permissions?.includes('users:create')
  const canEdit = currentUser?.permissions?.includes('users:edit')
  const canDelete = currentUser?.permissions?.includes('users:delete')

  useEffect(() => {
    if (canView) {
      fetchUsers()
      fetchRoles()
      fetchPermissions()
    }
  }, [canView])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else if (response.status === 403) {
        setError('You do not have permission to view users')
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/users/roles/list', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setRoles(data)
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error)
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

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (response.ok) {
        setSuccess('User deleted successfully')
        fetchUsers()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete user')
        setTimeout(() => setError(null), 3000)
      }
    } catch (error) {
      setError('Failed to delete user')
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditingUser(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingUser(null)
  }

  const handleFormSuccess = () => {
    setSuccess(editingUser ? 'User updated successfully' : 'User created successfully')
    setShowForm(false)
    setEditingUser(null)
    fetchUsers()
    setTimeout(() => setSuccess(null), 3000)
  }

  const getRoleDisplayName = (roleName) => {
    const role = roles.find(r => r.name === roleName)
    return role ? role.displayName : roleName
  }

  if (!canView) {
    return (
      <div className="glass rounded-xl p-8 border border-white/10 text-center">
        <Shield className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-100 mb-2">Access Denied</h3>
        <p className="text-slate-400">You do not have permission to view user management.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="glass rounded-xl p-8 border border-white/10 text-center">
        <div className="text-slate-400">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary-400" />
            <h2 className="text-2xl font-bold text-slate-100">User Management</h2>
          </div>
          {canCreate && (
            <Button
              onClick={handleCreate}
              variant="outline"
              size="sm"
              className="glass border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200 gap-2"
            >
              <Plus className="w-4 h-4" />
              Create User
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

        {/* User cards — staggered entrance */}
        {users.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No users found</p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-2"
          >
            {users.map((user) => (
              <motion.div key={user.id} variants={staggerItem}>
                <Card className="bg-slate-800/30 border-white/5 hover:border-white/10 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Avatar placeholder */}
                    <div className="w-9 h-9 rounded-full bg-primary-500/15 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-primary-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">{user.username}</p>
                        {user.email && (
                          <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />{user.email}
                          </p>
                        )}
                      </div>
                      <div>
                        <Badge className="bg-primary-500/15 text-primary-300 border-primary-500/20 hover:bg-primary-500/15 text-xs">
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </div>
                      <div>
                        <Badge className={user.active
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15 text-xs'
                          : 'bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/15 text-xs'
                        }>
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                        </button>
                      )}
                      {canDelete && user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete user"
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

      {/* User form dialog */}
      {showForm && (
        <UserForm
          user={editingUser}
          roles={roles}
          permissions={permissions}
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

const UserForm = ({ user, roles, permissions, onClose, onSuccess, onError }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    role: 'viewer',
    active: true,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '',
        email: user.email || '',
        role: user.role || 'viewer',
        active: user.active !== undefined ? user.active : true,
      })
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        role: formData.role,
        active: formData.active,
      }

      if (formData.password) {
        payload.password = formData.password
      }

      const url = user ? `/api/users/${user.id}` : '/api/users'
      const method = user ? 'PUT' : 'POST'

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
        onError(data.error || 'Failed to save user')
      }
    } catch (error) {
      onError('Failed to save user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-slate-100 sm:max-w-md gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <DialogTitle className="text-lg font-semibold text-slate-100">
            {user ? 'Edit User' : 'Create User'}
          </DialogTitle>
        </DialogHeader>

        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="px-6 py-5"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">Username</Label>
              <Input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                className="bg-slate-800/50 border-white/10 text-slate-100 focus-visible:ring-primary-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">
                {user ? 'New Password' : 'Password'}
                {user && <span className="text-slate-500 font-normal text-xs ml-1">(leave blank to keep current)</span>}
              </Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!user}
                className="bg-slate-800/50 border-white/10 text-slate-100 focus-visible:ring-primary-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-800/50 border-white/10 text-slate-100 focus-visible:ring-primary-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="bg-slate-800/50 border-white/10 text-slate-100 focus:ring-primary-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/10 text-slate-100">
                  {roles.map((role) => (
                    <SelectItem
                      key={role.name}
                      value={role.name}
                      className="focus:bg-white/10 focus:text-slate-100"
                    >
                      {role.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 rounded border-white/10 bg-slate-800 text-primary-500 focus:ring-primary-500"
              />
              <Label htmlFor="active" className="text-sm text-slate-300 cursor-pointer">Active</Label>
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
                    {user ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}

export default UserManagement
