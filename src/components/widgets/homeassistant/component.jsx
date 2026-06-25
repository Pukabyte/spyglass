import GenericServiceWidget from '../GenericServiceWidget'

const brandColor = {
  gradient: 'from-cyan-500/20 to-cyan-600/20',
  text: 'text-cyan-400',
  bg: 'bg-cyan-500/10',
  bgHover: 'hover:bg-cyan-500/20',
}

export default function HomeassistantWidget({ widget, onDelete, onRefresh }) {
  return <GenericServiceWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} brandColor={brandColor} />
}
