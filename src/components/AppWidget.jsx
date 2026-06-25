import { useState, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import { getWidgetComponent } from './widgets'
import GenericWidget from './widgets/GenericWidget'
import { fadeIn } from '../lib/animations'

const AppWidget = ({ widget, onDelete, onRefresh }) => {
  const [WidgetComponent, setWidgetComponent] = useState(null)

  useEffect(() => {
    const Component = getWidgetComponent(widget.appName)
    if (Component) {
      setWidgetComponent(() => Component)
    }
  }, [widget.appName])

  if (!WidgetComponent) {
    return (
      <motion.div
        initial={fadeIn.initial}
        animate={fadeIn.animate}
        transition={fadeIn.transition}
      >
        <GenericWidget
          widget={widget}
          onDelete={onDelete}
          onRefresh={onRefresh}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={fadeIn.initial}
      animate={fadeIn.animate}
      transition={fadeIn.transition}
    >
      <Suspense
        fallback={
          <GenericWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} />
        }
      >
        <WidgetComponent
          widget={widget}
          onDelete={onDelete}
          onRefresh={onRefresh}
        />
      </Suspense>
    </motion.div>
  )
}

export default AppWidget
