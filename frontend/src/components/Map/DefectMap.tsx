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
  pothole: 'Выбоина',
  longitudinal_crack: 'Продольная трещина',
  transverse_crack: 'Поперечная трещина',
  alligator_crack: 'Сетчатые трещины',
  other: 'Другое',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'Критическая',
}

function createDefectIcon(severity: string) {
  const color = SEVERITY_COLORS[severity] || '#6b7280'
  return L.divIcon({
    className: '',
    html: `<div style="width:13px;height:13px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6, 6],
  })
}

const selectedIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.6)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
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
            icon={createDefectIcon(defect.severity)}
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
