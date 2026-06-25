import GenericServiceWidget from '../GenericServiceWidget'

const brandColor = {
  gradient: 'from-red-500/20 to-red-600/20',
  text: 'text-red-400',
  bg: 'bg-red-500/10',
  bgHover: 'hover:bg-red-500/20',
}

export default function TransmissionWidget({ widget, onDelete, onRefresh }) {
  return <GenericServiceWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} brandColor={brandColor} />
}
