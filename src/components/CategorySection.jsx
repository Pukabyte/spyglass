import { useState } from 'react'
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Separator } from './ui/separator'
import { staggerContainer, staggerItem } from '../lib/animations'
import DraggableWidget from './DraggableWidget'
import AppWidget from './AppWidget'

const CategorySection = ({
  category,
  categories,
  isDragOver,
  draggedWidgetId,
  dragOverWidgetId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onSectionDragOver,
  onSectionDragLeave,
  onSectionDrop,
  onDeleteWidget,
  onEditWidget,
  onMoveWidget,
  onRefreshWidgets,
  currentUser,
}) => {
  const [collapsed, setCollapsed] = useState(false)

  const isUncategorized = category.id === '__uncategorized__'
  const widgetCount = category.widgets?.length || 0

  if (isUncategorized && widgetCount === 0) return null

  return (
    <div
      className={`relative transition-all duration-200 ${
        isDragOver ? 'ring-2 ring-primary-400/40 rounded-xl bg-primary-500/5' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (onSectionDragOver) onSectionDragOver(category.id, e)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          if (onSectionDragLeave) onSectionDragLeave(category.id, e)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (onSectionDrop) onSectionDrop(category.id, e)
      }}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-slate-300 hover:text-slate-100 transition-colors group"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
          )}
          <h3 className="text-sm font-semibold tracking-tight">{category.name}</h3>
        </button>
        <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/50">
          {widgetCount} {widgetCount === 1 ? 'widget' : 'widgets'}
        </span>
        <div className="flex-1">
          <Separator className="bg-slate-800" />
        </div>
      </div>

      {/* Widget Grid */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {widgetCount > 0 ? (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {category.widgets.map((widget) => (
                  <motion.div
                    key={widget.id}
                    variants={staggerItem}
                    layout
                  >
                    <DraggableWidget
                      widget={widget}
                      categoryId={category.id}
                      categories={categories}
                      isDragging={draggedWidgetId === widget.id}
                      dragOver={dragOverWidgetId === widget.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      onDelete={onDeleteWidget}
                      onEdit={onEditWidget}
                      onMoveWidget={onMoveWidget}
                      currentUser={currentUser}
                    >
                      <AppWidget
                        widget={widget}
                        onRefresh={onRefreshWidgets}
                      />
                    </DraggableWidget>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl py-8 text-center transition-colors ${
                  isDragOver
                    ? 'border-primary-400/60 bg-primary-500/10 text-primary-300'
                    : 'border-slate-700/50 text-slate-600'
                }`}
              >
                <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {isDragOver ? 'Drop widget here' : 'Drag widgets here or add a new widget'}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CategorySection
