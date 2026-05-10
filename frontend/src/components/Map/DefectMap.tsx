import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Defect } from '../../types'

export const TYPE_COLORS: Record<string, string> = {
  'potholes':                  '#ef4444',
  'alligator cracks':          '#f97316',
  'longitudnal_cracks':        '#f59e0b',
  'transverse cracks':         '#eab308',
  'rutting':                   '#8b5cf6',
  'patchy road sections':      '#06b6d4',
  'lane line blurs':           '#10b981',
  'pedestrian crossing blurs': '#14b8a6',
  'repaired cracks':           '#94a3b8',
}

const TYPE_LABELS: Record<string, string> = {
  'potholes':                  'Выбоины',
  'alligator cracks':          'Сетка трещин',
  'longitudnal_cracks':        'Продольные трещины',
  'transverse cracks':         'Поперечные трещины',
  'rutting':                   'Колейность',
  'patchy road sections':      'Ремонтные карты',
  'lane line blurs':           'Потёртость разметки',
  'pedestrian crossing blurs': 'Потёртость пеш. перехода',
  'manhole covers':            'Люки',
  'repaired cracks':           'Заделанные трещины',
}

function makePinSvg(color: string, size: number) {
  const r = size * 0.5
  const inner = r * 0.38
  const cx = r
  const cy = r
  const h = Math.round(size * (28 / 22))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">
    <path d="M${cx} 0C${cx - r} 0 0 ${r} 0 ${cy} 0 ${cy + r * 1.6} ${cx} ${h} ${cx} ${h} ${cx} ${h} ${size} ${cy + r * 1.6} ${size} ${cy} ${size} ${r} ${cx + r} 0 ${cx} 0z" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${inner}" fill="white" opacity="0.92"/>
  </svg>`
}

function createDefectIcon(defectType: string) {
  const color = TYPE_COLORS[defectType] || '#6b7280'
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

function jitterPositions(defects: Defect[]): Map<number, [number, number]> {
  const result = new Map<number, [number, number]>()
  const groups = new Map<string, Defect[]>()

  defects.forEach((d) => {
    if (d.lat == null || d.lng == null) return
    const key = `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(d)
  })

  groups.forEach((group) => {
    if (group.length === 1) {
      const d = group[0]
      result.set(d.id, [d.lat!, d.lng!])
    } else {
      group.forEach((d, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2
        const r = 0.00018
        result.set(d.id, [d.lat! + r * Math.cos(angle), d.lng! + r * Math.sin(angle)])
      })
    }
  })

  return result
}

function MapFlyTo({ location }: { location: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => { map.flyTo([location.lat, location.lng], 17, { duration: 1 }) }, [location.lat, location.lng])
  return null
}

interface DefectMapProps {
  defects?: Defect[]
  onMapClick?: (lat: number, lng: number) => void
  selectedCoords?: { lat: number; lng: number } | null
  focusLocation?: { lat: number; lng: number } | null
  height?: string
}

export function DefectMap({ defects = [], onMapClick, selectedCoords, focusLocation, height = '100%' }: DefectMapProps) {
  const positions = useMemo(
    () => jitterPositions(defects.filter((d) => d.lat != null && d.lng != null)),
    [defects],
  )

  return (
    <MapContainer center={[55.7558, 37.6176]} zoom={11} style={{ height, width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      {focusLocation && <MapFlyTo location={focusLocation} />}
      {selectedCoords && (
        <Marker position={[selectedCoords.lat, selectedCoords.lng]} icon={selectedIcon} />
      )}
      {defects
        .filter((d) => d.lat != null && d.lng != null && positions.has(d.id))
        .map((defect) => (
          <Marker
            key={defect.id}
            position={positions.get(defect.id)!}
            icon={createDefectIcon(defect.defect_type)}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>
                  {TYPE_LABELS[defect.defect_type] || defect.defect_type}
                </p>
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
