import GenericServiceWidget from '../GenericServiceWidget'

const brandColor = {
  gradient: 'from-orange-500/20 to-orange-600/20',
  text: 'text-orange-400',
  bg: 'bg-orange-500/10',
  bgHover: 'hover:bg-orange-500/20',
}

export default function ProxmoxWidget({ widget, onDelete, onRefresh }) {
  return <GenericServiceWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} brandColor={brandColor} />
}
