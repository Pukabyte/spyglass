import GenericServiceWidget from '../GenericServiceWidget'
import { Box } from 'lucide-react'

const brandColor = {
  gradient: 'from-slate-500/20 to-slate-600/20',
  text: 'text-slate-400',
  bg: 'bg-slate-500/10',
  bgHover: 'hover:bg-slate-500/20',
}

export default function MjpegWidget({ widget, onDelete, onRefresh }) {
  return (
    <GenericServiceWidget
      widget={widget}
      title="Mjpeg"
      icon={Box}
      endpoint="mjpeg"
      brandColor={brandColor}
      fields={[]}
    />
  )
}
