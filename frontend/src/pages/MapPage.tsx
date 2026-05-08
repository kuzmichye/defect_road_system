import { useEffect, useState } from 'react'
import { useDefectStore } from '../store/defectStore'
import { DefectMap } from '../components/Map/DefectMap'

const TYPE_LABELS: Record<string, string> = {
  pothole: 'Выбоина',
  longitudinal_crack: 'Продольная трещина',
  transverse_crack: 'Поперечная трещина',
  alligator_crack: 'Сетчатые трещины',
  other: 'Другое',
}

const LEGEND = [
  { label: 'Низкая', color: '#22c55e' },
  { label: 'Средняя', color: '#f59e0b' },
  { label: 'Высокая', color: '#f97316' },
  { label: 'Критическая', color: '#ef4444' },
]

export function MapPage() {
  const { defects, fetchDefects } = useDefectStore()
  const [filterType, setFilterType] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')

  useEffect(() => { fetchDefects() }, [])

  const filtered = defects.filter((d) => {
    if (filterType && d.defect_type !== filterType) return false
    if (filterSeverity && d.severity !== filterSeverity) return false
    return d.lat != null && d.lng != null
  })

  return (
    <div className="flex flex-col h-[calc(100vh-44px)] lg:h-screen">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2 sm:py-3 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-sm font-bold text-slate-800 mr-auto">Карта дефектов</h1>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все типы</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <span className="text-slate-500 text-xs sm:text-sm">{filtered.length} маркеров</span>

          {/* Legend — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-3">
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className="w-3 h-3 rounded-full border-2 border-white"
                  style={{ background: item.color, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
                />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1" style={{ isolation: 'isolate' }}>
        <DefectMap defects={filtered} height="100%" />
      </div>
    </div>
  )
}
