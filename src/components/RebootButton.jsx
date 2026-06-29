import { useState } from 'react'
import { Power, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'

// Standalone host-reboot control, gated on the server:control permission so it
// can be granted independently of the Saltbox controls (update/backup).
const RebootButton = ({ currentUser }) => {
  const [loading, setLoading] = useState(false)

  if (!currentUser?.permissions?.includes('server:control')) return null

  const handleReboot = async () => {
    if (!window.confirm('Reboot the entire server?\n\nThis runs "sudo reboot" on the host. Every service and all sessions will drop until the machine comes back up.')) {
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/server/reboot', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        alert('Reboot issued. The server is going down now.')
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Reboot failed: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to reboot:', error)
      alert(`Failed to reboot: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReboot}
      disabled={loading}
      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs gap-1.5"
    >
      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{loading ? 'Rebooting…' : 'Reboot Server'}</span>
      <span className="sm:hidden">Reboot</span>
    </Button>
  )
}

export default RebootButton
