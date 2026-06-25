import { useState, useEffect, useRef } from 'react'

export function useWidgetAPI(widget, endpoint = 'unified', options = {}) {
  const { refreshInterval = 30000 } = options
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  const fetchData = async () => {
    try {
      setError(null)
      const response = await fetch(`/api/widgets/${widget.id}/proxy?endpoint=${endpoint}`, {
        credentials: 'include'
      })
      const result = await response.json()

      if (response.ok && result.success) {
        setData(result.data)
      } else {
        setError(new Error(result.error || 'Failed to fetch data'))
      }
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchData, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id, endpoint, refreshInterval])

  return { data, error, loading }
}

