import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useDefectStore } from '../store/defectStore'
import { DefectMap, TYPE_COLORS } from '../components/Map/DefectMap'

const TYPES = [
  { key: 'potholes',                  label: 'Выбоины'          },
  { key: 'alligator cracks',          label: 'Сетка трещин'     },
  { key: 'longitudnal_cracks',        label: 'Прод. трещины'    },
  { key: 'transverse cracks',         label: 'Поп. трещины'     },
  { key: 'rutting',                   label: 'Колейность'       },
  { key: 'patchy road sections',      label: 'Рем. карты'       },
  { key: 'lane line blurs',           label: 'Потёртость'       },
  { key: 'pedestrian crossing blurs', label: 'Пеш. переход'     },
  { key: 'repaired cracks',           label: 'Заделанные'       },
]

export function MapPage() {
  const { defects, fetchDefects } = useDefectStore()
  const [filterType, setFilterType] = useState('')
  const location = useLocation()
  const focusLocation = (location.state as any)?.focusLocation ?? null

  useEffect(() => { fetchDefects() }, [])

  const filtered = defects.filter((d) => {
    if (d.defect_type === 'manhole covers') return false
    if (filterType && d.defect_type !== filterType) return false
    return d.lat != null && d.lng != null
  })

  return (
    <div className="flex flex-col h-[calc(100vh-44px)] lg:h-screen">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-slate-800 flex-shrink-0">Карта дефектов</h1>
          <span className="text-slate-400 text-xs flex-shrink-0">{filtered.length} маркеров</span>

          {/* Chip filter — scrollable */}
          <div className="flex gap-1.5 overflow-x-auto flex-1 pb-0.5" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setFilterType('')}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                !filterType
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Все
            </button>
            {TYPES.map((t) => {
              const active = filterType === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setFilterType(active ? '' : t.key)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    active ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  style={active ? { background: TYPE_COLORS[t.key] } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: TYPE_COLORS[t.key] }}
                  />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1" style={{ isolation: 'isolate' }}>
        <DefectMap defects={filtered} height="100%" focusLocation={focusLocation} />
      </div>
    </div>
  )
}
