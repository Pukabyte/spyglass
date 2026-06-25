import { useState } from 'react'
import { GripVertical, Trash2, Settings, X, Check, ArrowRightLeft } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

const DraggableWidget = ({ widget, categoryId, categories, children, onDragStart, onDragEnd, onDragOver, onDrop, isDragging, dragOver, onDelete, onEdit, onMoveWidget, currentUser }) => {
  const [isDraggingLocal, setIsDraggingLocal] = useState(false)
  const [canDrag, setCanDrag] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const canEditWidget = currentUser?.permissions?.includes('widget:edit')
  const canDeleteWidget = currentUser?.permissions?.includes('widget:delete')
  const canEditDashboard = currentUser?.permissions?.includes('dashboard:edit')
  const showControls = canEditWidget || canDeleteWidget || canEditDashboard

  const handleMouseDown = () => setCanDrag(true)
  const handleMouseUp = () => setCanDrag(false)

  const handleDragStart = (e) => {
    if (!canDrag) {
      e.preventDefault()
      return
    }
    setIsDraggingLocal(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify({ widgetId: widget.id, categoryId }))
    e.dataTransfer.setData('text/plain', widget.id)
    if (onDragStart) onDragStart(widget.id, e)
  }

  const handleDragEnd = (e) => {
    setIsDraggingLocal(false)
    setCanDrag(false)
    if (onDragEnd) onDragEnd(widget.id, e)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (onDragOver) onDragOver(widget.id, e)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDrop) onDrop(widget.id, e)
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
    setShowMoveMenu(false)
  }

  const handleConfirmDelete = () => {
    if (onDelete) onDelete(widget.id)
    setShowDeleteConfirm(false)
  }

  const handleCancelDelete = () => setShowDeleteConfirm(false)

  const handleMoveToCategory = (targetCatId) => {
    if (onMoveWidget) onMoveWidget(widget.id, targetCatId)
    setShowMoveMenu(false)
  }

  const moveTargets = (categories || []).filter(c => c.id !== categoryId)

  return (
    <div
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setShowDeleteConfirm(false)
        setShowMoveMenu(false)
      }}
      className={cn(
        'relative transition-all duration-200',
        (isDragging || isDraggingLocal) && 'opacity-50 scale-[0.98] z-50 rotate-1',
        dragOver && 'ring-2 ring-primary-400/60 ring-offset-2 ring-offset-slate-900 scale-[1.02]'
      )}
    >
      {/* Control bar */}
      {showControls && (
        <div
          className={cn(
            'absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-200 z-20 pointer-events-none',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-b-lg bg-slate-900/80 backdrop-blur-sm border-x border-b border-slate-700/60 shadow-lg pointer-events-auto">
            {/* Drag handle */}
            {canEditDashboard && (
              <div
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-slate-700/80 text-slate-500 hover:text-slate-200 transition-colors"
                title="Drag to reorder"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            )}

            <Separator orientation="vertical" className="h-4 bg-slate-700/80" />

            {showDeleteConfirm ? (
              <>
                <span className="text-xs text-slate-300 px-1.5">Delete?</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleConfirmDelete}
                  className="h-6 w-6 p-0 hover:bg-green-500/20 text-green-400"
                  title="Confirm delete"
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancelDelete}
                  className="h-6 w-6 p-0 hover:bg-slate-700/80 text-slate-400"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <>
                {canEditDashboard && moveTargets.length > 0 && (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setShowMoveMenu(!showMoveMenu); setShowDeleteConfirm(false) }}
                      className="h-6 w-6 p-0 hover:bg-slate-700/80 text-slate-500 hover:text-slate-200"
                      title="Move to category"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </Button>
                    {showMoveMenu && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-slate-800 border border-slate-700/60 rounded-lg shadow-xl py-1 min-w-[160px] z-30">
                        <div className="px-3 py-1.5 text-xs text-slate-500 font-medium">Move to...</div>
                        {moveTargets.map(cat => (
                          <Button
                            key={cat.id}
                            variant="ghost"
                            onClick={() => handleMoveToCategory(cat.id)}
                            className="w-full justify-start px-3 py-1.5 h-auto text-sm text-slate-300 hover:bg-slate-700/60 hover:text-slate-100 rounded-none"
                          >
                            {cat.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {canEditWidget && !widget.isSystemWidget && onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(widget)}
                    className="h-6 w-6 p-0 hover:bg-slate-700/80 text-slate-500 hover:text-slate-200"
                    title="Edit widget"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </Button>
                )}

                {canDeleteWidget && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeleteClick}
                    className="h-6 w-6 p-0 hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                    title="Delete widget"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        {children}
      </div>
    </div>
  )
}

export default DraggableWidget
