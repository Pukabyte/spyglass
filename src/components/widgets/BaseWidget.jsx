import { useState } from 'react'
import { RefreshCw, X, Box, ArrowUpRight } from 'lucide-react'
import { Card, CardHeader, CardContent, CardFooter } from '../ui/card'
import { Button } from '../ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { cn } from '../../lib/utils'

const getIconPath = (appName) => {
  if (!appName) return null
  const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `/icons/custom/${normalizedName}.webp`
}

const BaseWidget = ({ widget, onDelete, onRefresh, children, title, data, loading, error, className = '', icon }) => {
  const [iconError, setIconError] = useState(false)

  const handleRefresh = () => {
    if (onRefresh) onRefresh()
  }

  const appName = widget?.appName || title || ''
  const iconPath = icon || getIconPath(appName)
  const displayTitle = title || widget?.title || widget?.appName || ''

  return (
    <TooltipProvider>
      <Card className={cn(
        'bg-slate-900/80 border-slate-800 shadow-lg overflow-hidden flex flex-col',
        className
      )}>
        {/* Header */}
        <CardHeader className="px-4 py-3 pb-3 border-b border-slate-800 space-y-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* App Icon */}
              <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {iconPath && !iconError ? (
                  <img
                    src={iconPath}
                    alt={appName}
                    className="w-6 h-6 object-contain"
                    onError={() => setIconError(true)}
                  />
                ) : (
                  <Box className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <h3 className="text-sm font-medium text-slate-100 tracking-tight truncate">
                {displayTitle}
              </h3>
              {loading && (
                <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin shrink-0" />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {onRefresh && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefresh}
                      disabled={loading}
                      className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    >
                      <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(widget.id)}
                      className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Delete widget</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-4 flex-1">
          {children}
        </CardContent>

        {/* Footer */}
        {widget?.url && (
          <CardFooter className="p-0 border-t border-slate-800">
            <a
              href={widget.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button
                variant="ghost"
                className="w-full h-9 rounded-none text-xs font-medium gap-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              >
                Open App
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </a>
          </CardFooter>
        )}
      </Card>
    </TooltipProvider>
  )
}

export default BaseWidget
