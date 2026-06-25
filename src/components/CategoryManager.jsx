import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { Separator } from './ui/separator'
import { cn } from '../lib/utils'
import { fadeIn, staggerContainer, staggerItem } from '../lib/animations'

const CategoryManager = ({ categories, onClose, onCategoriesChanged }) => {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)

  const userCategories = categories.filter(c => c.id !== '__uncategorized__')
  const uncategorized = categories.find(c => c.id === '__uncategorized__')

  const handleCreate = async () => {
    if (!newCategoryName.trim()) return
    setError(null)

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newCategoryName.trim() })
      })

      if (response.ok) {
        setNewCategoryName('')
        onCategoriesChanged()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create category')
      }
    } catch (err) {
      setError(`Failed to create category: ${err.message}`)
    }
  }

  const handleRename = async (id) => {
    if (!renameValue.trim()) return
    setError(null)

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: renameValue.trim() })
      })

      if (response.ok) {
        setRenamingId(null)
        setRenameValue('')
        onCategoriesChanged()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to rename category')
      }
    } catch (err) {
      setError(`Failed to rename category: ${err.message}`)
    }
  }

  const handleDelete = async (id) => {
    setError(null)

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        setDeletingId(null)
        onCategoriesChanged()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete category')
      }
    } catch (err) {
      setError(`Failed to delete category: ${err.message}`)
    }
  }

  const handleReorder = async (catId, direction) => {
    setError(null)

    const sorted = [...userCategories].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(c => c.id === catId)
    if (idx === -1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const newOrder = sorted.map(c => c.id)
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]

    try {
      const response = await fetch('/api/categories/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order: newOrder })
      })

      if (response.ok) {
        onCategoriesChanged()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to reorder categories')
      }
    } catch (err) {
      setError(`Failed to reorder: ${err.message}`)
    }
  }

  const sortedUserCategories = [...userCategories].sort((a, b) => a.order - b.order)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-slate-100 sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <DialogTitle className="text-lg font-semibold text-slate-100">Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <motion.div variants={fadeIn} initial="initial" animate="animate">
            {/* Error */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mb-4"
                >
                  <Badge variant="destructive" className="w-full justify-start gap-2 py-2.5 px-3 text-sm font-normal rounded-lg">
                    {error}
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add new category */}
            <div className="space-y-1.5 mb-5">
              <Label className="text-sm text-slate-300">New Category</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Category name..."
                  className="flex-1 bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary-500/50"
                />
                <Button
                  onClick={handleCreate}
                  disabled={!newCategoryName.trim()}
                  className="bg-primary-500 hover:bg-primary-600 text-white gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </div>

            <Separator className="bg-white/5 mb-5" />

            {/* Category list */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="space-y-2"
            >
              {sortedUserCategories.map((cat, idx) => {
                const widgetCount = cat.widgets?.length || 0

                return (
                  <motion.div key={cat.id} variants={staggerItem}>
                    <Card className="bg-slate-800/30 border-white/5 hover:border-white/10 transition-colors">
                      <CardContent className="p-3 flex items-center gap-2">
                        {/* Reorder arrows */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleReorder(cat.id, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleReorder(cat.id, 'down')}
                            disabled={idx === sortedUserCategories.length - 1}
                            className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Name or rename input */}
                        <div className="flex-1 min-w-0">
                          {renamingId === cat.id ? (
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(cat.id)
                                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                                }}
                                autoFocus
                                className="h-7 text-sm bg-slate-800/50 border-white/10 text-slate-100 focus-visible:ring-primary-500/50"
                              />
                              <button
                                onClick={() => handleRename(cat.id)}
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setRenamingId(null); setRenameValue('') }}
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-200 truncate">{cat.name}</span>
                              <Badge variant="secondary" className="text-xs bg-slate-700/50 text-slate-400 border-0 px-1.5 py-0">
                                {widgetCount}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {renamingId !== cat.id && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setRenamingId(cat.id); setRenameValue(cat.name); setDeletingId(null) }}
                              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                              title="Rename"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {deletingId === cat.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-amber-400 whitespace-nowrap">
                                  {widgetCount > 0 ? `${widgetCount} → Uncategorized` : 'Delete?'}
                                </span>
                                <button
                                  onClick={() => handleDelete(cat.id)}
                                  className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                                  title="Confirm delete"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="p-1 rounded hover:bg-slate-700 text-slate-400 transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setDeletingId(cat.id); setRenamingId(null) }}
                                className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                title="Delete category"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}

              {/* Uncategorized - always shown, non-editable */}
              {uncategorized && (
                <Card className="bg-slate-800/15 border-white/5 opacity-50">
                  <CardContent className="p-3 flex items-center gap-2">
                    <div className="w-7" />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-400">Uncategorized</span>
                      <Badge variant="secondary" className="text-xs bg-slate-700/40 text-slate-500 border-0 px-1.5 py-0">
                        {uncategorized.widgets?.length || 0}
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-600 italic">Always last</span>
                  </CardContent>
                </Card>
              )}

              {sortedUserCategories.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-6">
                  No custom categories yet. Add one above to organize your widgets.
                </p>
              )}
            </motion.div>
          </motion.div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex justify-end">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-white/10 bg-slate-800/50 hover:bg-white/10 text-slate-300"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CategoryManager
