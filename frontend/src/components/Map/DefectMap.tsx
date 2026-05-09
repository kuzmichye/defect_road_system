import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Defect } from '../../types'

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
}

const TYPE_LABELS: Record<string, string> = {
  'potholes': 'Выбоины',
  'alligator cracks': 'Сетка трещин',
  'longitudnal_cracks': 'Продольные трещины',
  'transverse cracks': 'Поперечные трещины',
  'rutting': 'Колейность',
  'patchy road sections': 'Ремонтные карты',
  'lane line blurs': 'Потёртость разметки',
  'pedestrian crossing blurs': 'Потёртость пеш. перехода',
  'manhole covers': 'Люки',
  'repaired cracks': 'Заделанные трещины',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'Критическая',
}

function makePinSvg(color: string, size: number) {
  const r = size * 0.5
  const inner = r * 0.38
  const cx = r
  const cy = r
  const h = size * (28 / 22)
  // teardrop: circle top + pointed bottom
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(h)}" viewBox="0 0 ${size} ${Math.round(h)}">
    <path d="M${cx} 0C${cx - r} 0 0 ${r} 0 ${cy} 0 ${cy + r * 1.6} ${cx} ${Math.round(h)} ${cx} ${Math.round(h)} ${cx} ${Math.round(h)} ${size} ${cy + r * 1.6} ${size} ${cy} ${size} ${r} ${cx + r} 0 ${cx} 0z" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${inner}" fill="white" opacity="0.92"/>
  </svg>`
}

function createDefectIcon(severity: string, defectType?: string) {
  const isRepaired = defectType === 'repaired cracks'
  const color = isRepaired ? '#94a3b8' : (SEVERITY_COLORS[severity] || '#6b7280')
  return L.divIcon({
    className: '',
    html: `<div style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.28))">${makePinSvg(color, 22)}</div>`,
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -30],
  })
}

const selectedIcon = L.divIcon({
  className: '',
  html: `<div style="filter:drop-shadow(0 3px 5px rgba(59,130,246,0.45))">${makePinSvg('#3b82f6', 26)}</div>`,
  iconSize: [26, 32],
  iconAnchor: [13, 32],
  popupAnchor: [0, -34],
})

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) })
  return null
}

interface DefectMapProps {
  defects?: Defect[]
  onMapClick?: (lat: number, lng: number) => void
  selectedCoords?: { lat: number; lng: number } | null
  height?: string
}

export function DefectMap({ defects = [], onMapClick, selectedCoords, height = '100%' }: DefectMapProps) {
  return (
    <MapContainer center={[55.7558, 37.6176]} zoom={11} style={{ height, width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      {selectedCoords && (
        <Marker position={[selectedCoords.lat, selectedCoords.lng]} icon={selectedIcon} />
      )}
      {defects
        .filter((d) => d.lat != null && d.lng != null)
        .map((defect) => (
          <Marker
            key={defect.id}
            position={[defect.lat!, defect.lng!]}
            icon={createDefectIcon(defect.severity, defect.defect_type)}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>
                  {TYPE_LABELS[defect.defect_type] || defect.defect_type}
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                  Тяжесть: {SEVERITY_LABELS[defect.severity] || defect.severity}
                </p>
                {defect.confidence != null && (
                  <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                    Уверенность: {(defect.confidence * 100).toFixed(0)}%
                  </p>
                )}
                {defect.address && (
                  <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 4 }}>{defect.address}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  )
}
