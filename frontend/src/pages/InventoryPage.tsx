import { useEffect, useState } from 'react'
import { Trash2, Download, Filter, FileJson } from 'lucide-react'
import { useDefectStore } from '../store/defectStore'
import { defectApi } from '../api/client'
import { TYPE_COLORS } from '../components/Map/DefectMap'

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

  useEffect(() => { fetchDefects() }, [])

  const filtered = defects.filter((d) => {
    if (d.defect_type === 'manhole covers') return false
    if (filterType && d.defect_type !== filterType) return false
    return true
  })

  const handleExportCsv = async () => {
    const blob = await defectApi.exportCsv()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'defects.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportGeoJson = async () => {
    const data = await defectApi.exportGeoJson()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'defects.geojson'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Инвентаризация</h1>
          <p className="text-slate-500 text-sm mt-0.5">{filtered.length} дефектов</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleExportGeoJson}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FileJson size={15} />
            GeoJSON
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            <Download size={15} />
            CSV
          </button>
        </div>
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
                {['ID', 'Тип', 'Увер.', 'Коорд.', 'Адрес', 'Дата', 'Ист.', ''].map((h) => (
                  <th key={h} className="text-left px-2 sm:px-4 py-2 text-slate-500 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
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
                  <td className="px-2 sm:px-4 py-2 text-slate-500">
                    {d.confidence != null ? `${(d.confidence * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-slate-400 font-mono text-xs whitespace-nowrap">
                    {d.lat != null && d.lng != null
                      ? `${d.lat.toFixed(3)}, ${d.lng.toFixed(3)}`
                      : '—'}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-slate-500 max-w-[120px] sm:max-w-xs truncate">
                    {d.address || '—'}
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
                      onClick={() => deleteDefect(d.id)}
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
