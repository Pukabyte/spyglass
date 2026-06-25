import { useState, useEffect } from 'react'

export function usePermissions() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasPermission = (permission) => {
    if (!user || !user.active) return false
    return user.permissions && user.permissions.includes(permission)
  }

  const hasAnyPermission = (permissions) => {
    if (!user || !user.active) return false
    if (!user.permissions) return false
    return permissions.some((perm) => user.permissions.includes(perm))
  }

  const hasAllPermissions = (permissions) => {
    if (!user || !user.active) return false
    if (!user.permissions) return false
    return permissions.every((perm) => user.permissions.includes(perm))
  }

  return {
    user,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refresh: fetchUser,
  }
}

