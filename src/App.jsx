import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal } from 'lucide-react'
import Dashboard from './components/Dashboard'
import Header from './components/Header'
import Login from './components/Login'
import { pageTransition } from './lib/animations'
import { cn } from './lib/utils'

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [dockerApps, setDockerApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [precachedConfigs, setPrecachedConfigs] = useState(null)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setAuthenticated(data.authenticated)
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
    } finally {
      setCheckingAuth(false)
    }
  }

  useEffect(() => {
    if (authenticated) {
      fetchDockerApps()
      fetchConfigs()
      const interval = setInterval(() => {
        fetchDockerApps()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [authenticated])

  const fetchDockerApps = async () => {
    try {
      const response = await fetch('/api/docker/apps', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setDockerApps(data)
      }
    } catch (error) {
      console.error('Failed to fetch docker apps:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/config/all', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setPrecachedConfigs(data.configs || {})
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error)
    }
  }

  const handleRefresh = () => {
    fetchDockerApps()
  }

  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalCommand, setTerminalCommand] = useState(null)

  const handleOpenTerminal = (command = null) => {
    setTerminalCommand(command)
    setShowTerminal(true)
  }

  // Expose function globally for SaltboxControls
  useEffect(() => {
    window.openTerminal = handleOpenTerminal
    return () => {
      delete window.openTerminal
    }
  }, [])

  const handleLogin = async () => {
    setAuthenticated(true)
    await checkAuthStatus()
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      if (response.ok) {
        setAuthenticated(false)
        setCurrentUser(null)
      }
    } catch (error) {
      console.error('Logout error:', error)
      setAuthenticated(false)
      setCurrentUser(null)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      <Header currentUser={currentUser} onLogout={handleLogout} />

      <AnimatePresence mode="wait">
        <motion.main
          key="dashboard"
          initial={pageTransition.initial}
          animate={pageTransition.animate}
          exit={pageTransition.exit}
        >
          <Dashboard
            dockerApps={dockerApps}
            loading={loading}
            onRefresh={fetchDockerApps}
            showTerminal={showTerminal}
            onCloseTerminal={() => {
              setShowTerminal(false)
              setTerminalCommand(null)
            }}
            terminalCommand={terminalCommand}
            precachedConfigs={precachedConfigs}
            currentUser={currentUser}
          />
        </motion.main>
      </AnimatePresence>

      {/* Floating Terminal Button */}
      {currentUser?.permissions?.includes('terminal:view') && (
        <button
          onClick={() => handleOpenTerminal()}
          className={cn(
            'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40',
            'p-3 sm:p-3.5 rounded-full',
            'bg-slate-900 border border-slate-800',
            'shadow-lg shadow-black/40',
            'hover:bg-slate-800 hover:border-slate-700',
            'hover:scale-105 active:scale-95',
            'transition-all duration-200 group',
            showTerminal && 'bg-slate-800 border-slate-600'
          )}
          title="Open Terminal"
        >
          <Terminal
            className={cn(
              'w-4 h-4 sm:w-5 sm:h-5 transition-colors',
              showTerminal ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-200'
            )}
          />
        </button>
      )}
    </div>
  )
}

export default App
