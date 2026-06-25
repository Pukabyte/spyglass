import { motion } from 'framer-motion'
import { LogOut, User, Settings, Shield, Eye } from 'lucide-react'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import { Badge } from './ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { fadeIn } from '../lib/animations'
import { cn } from '../lib/utils'

const Header = ({ currentUser, onLogout }) => {
  return (
    <motion.header
      className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800"
      initial={fadeIn.initial}
      animate={fadeIn.animate}
      transition={fadeIn.transition}
    >
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-slate-800 border border-slate-700">
              <Eye className="w-4 h-4 text-slate-300" />
            </div>
            <span className="text-sm font-semibold text-slate-100 tracking-tight font-sans">
              Spyglass
            </span>
          </div>

          {/* Right side: user dropdown */}
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 h-8 px-2.5"
                >
                  <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-slate-400" />
                  </div>
                  <span className="hidden sm:inline text-xs font-medium">
                    {currentUser.username}
                  </span>
                  {currentUser.role === 'admin' && (
                    <Badge
                      variant="outline"
                      className="hidden sm:inline-flex text-[10px] px-1.5 py-0 h-4 border-slate-700 text-slate-500 font-normal"
                    >
                      admin
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-52 bg-slate-900 border-slate-800 text-slate-300"
              >
                <DropdownMenuLabel className="pb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-100 truncate">
                        {currentUser.username}
                      </p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Shield className="w-2.5 h-2.5" />
                        <span className="capitalize">{currentUser.role}</span>
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="bg-slate-800" />

                <DropdownMenuItem
                  className={cn(
                    'flex items-center gap-2 text-xs cursor-pointer',
                    'text-slate-400 hover:text-slate-100 focus:text-slate-100',
                    'hover:bg-slate-800 focus:bg-slate-800'
                  )}
                  onSelect={() => {
                    // placeholder for future settings modal
                  }}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-800" />

                <DropdownMenuItem
                  className={cn(
                    'flex items-center gap-2 text-xs cursor-pointer',
                    'text-red-400 hover:text-red-300 focus:text-red-300',
                    'hover:bg-red-500/10 focus:bg-red-500/10'
                  )}
                  onSelect={onLogout}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </motion.header>
  )
}

export default Header
