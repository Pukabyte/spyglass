// Example: How to import and use Homepage widgets with different styling

import { useState, useEffect } from 'react'
import { importHomepageWidgetWithVariant, importHomepageWidget } from '../utils/homepageWidgetImporter.jsx'

/**
 * Example 1: Using a widget with a predefined style variant
 */
export function PlexWidgetWithCardStyle({ widget, onDelete, onRefresh }) {
  const [StyledWidget, setStyledWidget] = useState(null)

  useEffect(() => {
    const loadWidget = async () => {
      // Import plex widget with 'card' style variant
      const Widget = await importHomepageWidgetWithVariant('plex', 'card')
      setStyledWidget(() => Widget)
    }
    loadWidget()
  }, [])

  if (!StyledWidget) return <div>Loading widget...</div>

  return <StyledWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} />
}

/**
 * Example 2: Using a widget with custom styling
 */
export function PlexWidgetWithCustomStyle({ widget, onDelete, onRefresh }) {
  const [StyledWidget, setStyledWidget] = useState(null)

  useEffect(() => {
    const loadWidget = async () => {
      // Import plex widget with custom styling
      const Widget = await importHomepageWidget('plex/component', {
        containerClassName: 'my-custom-container bg-gradient-to-br from-purple-900 to-blue-900',
        baseWidgetClassName: 'border-2 border-purple-500',
        containerStyle: {
          borderRadius: '1rem',
          padding: '1.5rem',
        },
      })
      setStyledWidget(() => Widget)
    }
    loadWidget()
  }, [])

  if (!StyledWidget) return <div>Loading widget...</div>

  return <StyledWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} />
}

/**
 * Example 3: Using different variants dynamically
 */
export function DynamicStyledWidget({ widget, onDelete, onRefresh, variant = 'default' }) {
  const [StyledWidget, setStyledWidget] = useState(null)

  useEffect(() => {
    const loadWidget = async () => {
      // Import widget with dynamic variant
      const Widget = await importHomepageWidgetWithVariant('plex', variant)
      setStyledWidget(() => Widget)
    }
    loadWidget()
  }, [variant])

  if (!StyledWidget) return <div>Loading widget...</div>

  return <StyledWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} />
}

