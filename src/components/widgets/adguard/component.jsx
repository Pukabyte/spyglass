import GenericServiceWidget from '../GenericServiceWidget'

const brandColor = {
  gradient: 'from-green-500/20 to-green-600/20',
  text: 'text-green-400',
  bg: 'bg-green-500/10',
  bgHover: 'hover:bg-green-500/20',
}

export default function AdguardWidget({ widget, onDelete, onRefresh }) {
  return <GenericServiceWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} brandColor={brandColor} />
}
