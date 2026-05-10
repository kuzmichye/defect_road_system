import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Defect } from '../../types'
import { api } from '../../api/client'

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

function DefectPopup({ defect }: { defect: Defect }) {
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!defect.has_crop) return
    let objUrl: string
    api.get(`/inventory/defects/${defect.id}/crop`, { responseType: 'blob' })
      .then((r) => { objUrl = URL.createObjectURL(r.data); setCropSrc(objUrl) })
      .catch(() => {})
    return () => { if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [defect.id])

  const dateStr = new Date(defect.detected_at).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{ width: 230, fontFamily: 'inherit' }}>
      <div style={{ height: 140, background: '#f1f5f9', overflow: 'hidden', flexShrink: 0 }}>
        {cropSrc ? (
          <img src={cropSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : defect.has_crop ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
            Загрузка...
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12 }}>
            Нет фото
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: TYPE_COLORS[defect.defect_type] || '#6b7280', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.2 }}>
            {TYPE_LABELS[defect.defect_type] || defect.defect_type}
          </span>
        </div>

        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Дата обнаружения</div>
          <div style={{ fontSize: 12.5, color: '#334155', fontWeight: 500 }}>{dateStr}</div>
        </div>

        {defect.lat != null && defect.lng != null && (
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Место на карте</div>
            <div style={{ fontSize: 12, color: '#334155', fontWeight: 500, fontFamily: 'monospace' }}>
              {defect.lat.toFixed(6)}, {defect.lng.toFixed(6)}
            </div>
          </div>
        )}

        {defect.address && (
          <div style={{ fontSize: 11.5, color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
            {defect.address}
          </div>
        )}
      </div>
    </div>
  )
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
              <DefectPopup defect={defect} />
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  )
}
