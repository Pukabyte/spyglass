import GenericServiceWidget from '../GenericServiceWidget'

const brandColor = {
  gradient: 'from-blue-500/20 to-blue-600/20',
  text: 'text-blue-400',
  bg: 'bg-blue-500/10',
  bgHover: 'hover:bg-blue-500/20',
}

export default function QbittorrentWidget({ widget, onDelete, onRefresh }) {
  return <GenericServiceWidget widget={widget} onDelete={onDelete} onRefresh={onRefresh} brandColor={brandColor} />
}
