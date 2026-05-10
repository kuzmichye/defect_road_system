import { useEffect, useState } from 'react'
import { Trash2, FileSpreadsheet, Filter, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useDefectStore } from '../store/defectStore'
import { TYPE_COLORS } from '../components/Map/DefectMap'
import { api } from '../api/client'

function CropThumb({ id }: { id: number }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let objUrl: string
    api.get(`/inventory/defects/${id}/crop`, { responseType: 'blob' })
      .then((r) => { objUrl = URL.createObjectURL(r.data); setSrc(objUrl) })
      .catch(() => {})
    return () => { if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [id])
  if (!src) return <span className="text-slate-300 text-xs">—</span>
  return <img src={src} alt="crop" className="h-10 w-16 object-cover rounded border border-slate-100" />
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
  'repaired cracks':           'Заделанные трещины',
}

export function InventoryPage() {
  const { defects, fetchDefects, deleteDefect } = useDefectStore()
  const [filterType, setFilterType] = useState('')
  const [geoAddresses, setGeoAddresses] = useState<Record<number, string>>({})
  const navigate = useNavigate()

  useEffect(() => { fetchDefects() }, [])

  useEffect(() => {
    const toFetch = defects.filter(
      (d) => !d.address && d.lat != null && d.lng != null && !(d.id in geoAddresses),
    )
    if (toFetch.length === 0) return

    let cancelled = false
    ;(async () => {
      for (const d of toFetch) {
        if (cancelled) break
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${d.lat}&lon=${d.lng}&format=json&accept-language=ru`,
          )
          const data = await res.json()
          if (!cancelled) {
            const road = data.address?.road || data.address?.pedestrian || ''
            const city = data.address?.city || data.address?.town || data.address?.village || ''
            const label = [road, city].filter(Boolean).join(', ') || data.display_name || ''
            setGeoAddresses((prev) => ({ ...prev, [d.id]: label }))
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1100))
      }
    })()

    return () => { cancelled = true }
  }, [defects.map((d) => d.id).join(',')])

  const filtered = defects.filter((d) => {
    if (d.defect_type === 'manhole covers') return false
    if (filterType && d.defect_type !== filterType) return false
    return true
  })

  const handleExportExcel = () => {
    const rows = filtered.map((d) => ({
      'ID': d.id,
      'Тип дефекта': TYPE_LABELS[d.defect_type] || d.defect_type,
      'Широта': d.lat ?? '',
      'Долгота': d.lng ?? '',
      'Адрес': d.address || geoAddresses[d.id] || '',
      'Дата': new Date(d.detected_at).toLocaleDateString('ru'),
      'Источник': d.source_type === 'video' ? 'Видео' : 'Фото',
      'Фото дефекта': d.has_crop ? 'Есть' : 'Нет',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Дефекты')
    XLSX.writeFile(wb, 'defects.xlsx')
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Инвентаризация</h1>
          <p className="text-slate-500 text-sm mt-0.5">{filtered.length} дефектов</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
        >
          <FileSpreadsheet size={15} />
          Excel
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 bg-white px-3 sm:px-4 py-3 rounded-xl border border-slate-100 shadow-sm">
        <Filter size={15} className="text-slate-400 flex-shrink-0" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все типы</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {filterType && (
          <button
            onClick={() => setFilterType('')}
            className="text-sm text-blue-600 hover:underline"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['ID', 'Тип', 'Коорд.', 'Адрес', 'Фото', 'Дата', 'Ист.', ''].map((h) => (
                  <th key={h} className="text-left px-2 sm:px-4 py-2 text-slate-500 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (d.lat != null && d.lng != null) {
                      navigate('/map', { state: { focusLocation: { lat: d.lat, lng: d.lng } } })
                    }
                  }}
                >
                  <td className="px-2 sm:px-4 py-2 text-slate-400 text-xs">#{d.id}</td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: TYPE_COLORS[d.defect_type] || '#94a3b8' }}
                      />
                      <span className="font-medium text-slate-700">
                        {TYPE_LABELS[d.defect_type] || d.defect_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-slate-400 font-mono text-xs whitespace-nowrap">
                    {d.lat != null && d.lng != null
                      ? <span className="flex items-center gap-1"><MapPin size={11} className="text-slate-300" />{d.lat.toFixed(3)}, {d.lng.toFixed(3)}</span>
                      : '—'}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-slate-600 text-xs max-w-[220px] truncate">
                    {d.address || geoAddresses[d.id] || (d.lat != null ? <span className="text-slate-300">...</span> : '—')}
                  </td>
                  <td className="px-2 sm:px-4 py-2">
                    {d.has_crop ? <CropThumb id={d.id} /> : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-slate-500 whitespace-nowrap">
                    {new Date(d.detected_at).toLocaleDateString('ru')}
                  </td>
                  <td className="px-2 sm:px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.source_type === 'video'
                        ? 'bg-violet-50 text-violet-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {d.source_type === 'video' ? 'Видео' : 'Фото'}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDefect(d.id) }}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">
                    Дефекты не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
