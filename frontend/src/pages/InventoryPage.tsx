import { useEffect, useState } from 'react'
import { Trash2, Download, Filter, FileJson } from 'lucide-react'
import { useDefectStore } from '../store/defectStore'
import { defectApi } from '../api/client'

const TYPE_LABELS: Record<string, string> = {
  pothole: 'Выбоина',
  longitudinal_crack: 'Продольная трещина',
  transverse_crack: 'Поперечная трещина',
  alligator_crack: 'Сетчатые трещины',
  other: 'Другое',
}

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'Критическая',
}

export function InventoryPage() {
  const { defects, fetchDefects, deleteDefect } = useDefectStore()
  const [filterType, setFilterType] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')

  useEffect(() => { fetchDefects() }, [])

  const filtered = defects.filter((d) => {
    if (filterType && d.defect_type !== filterType) return false
    if (filterSeverity && d.severity !== filterSeverity) return false
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
            <span className="hidden xs:inline sm:inline">GeoJSON</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            <Download size={15} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Filters */}
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
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все тяжести</option>
          <option value="low">Низкая</option>
          <option value="medium">Средняя</option>
          <option value="high">Высокая</option>
          <option value="critical">Критическая</option>
        </select>
        {(filterType || filterSeverity) && (
          <button
            onClick={() => { setFilterType(''); setFilterSeverity('') }}
            className="text-sm text-blue-600 hover:underline"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['ID', 'Тип', 'Тяжесть', 'Уверенность', 'Координаты', 'Адрес', 'Дата', 'Источник', ''].map(
                  (h) => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">#{d.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                    {TYPE_LABELS[d.defect_type] || d.defect_type}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        SEVERITY_BADGE[d.severity] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {SEVERITY_LABELS[d.severity] || d.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {d.confidence != null ? `${(d.confidence * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                    {d.lat != null && d.lng != null
                      ? `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{d.address || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(d.detected_at).toLocaleDateString('ru')}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {d.source_type === 'video' ? 'Видео' : 'Фото'}
                  </td>
                  <td className="px-4 py-3">
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
                  <td colSpan={9} className="px-4 py-16 text-center text-slate-400 text-sm">
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
