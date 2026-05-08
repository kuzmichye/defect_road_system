import { useEffect } from 'react'
import { Activity, AlertTriangle, MapPin, TrendingUp } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useDefectStore } from '../store/defectStore'
import { StatsCard } from '../components/Dashboard/StatsCard'

const TYPE_LABELS: Record<string, string> = {
  pothole: 'Выбоины',
  longitudinal_crack: 'Прод. трещины',
  transverse_crack: 'Поп. трещины',
  alligator_crack: 'Сетч. трещины',
  other: 'Другое',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'Критическая',
}

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
}

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']

export function DashboardPage() {
  const { defects, stats, fetchDefects, fetchStats } = useDefectStore()

  useEffect(() => {
    fetchDefects()
    fetchStats()
  }, [])

  const pieData = stats
    ? Object.entries(stats.by_type).map(([key, value]) => ({
        name: TYPE_LABELS[key] || key,
        value,
      }))
    : []

  const barData = stats
    ? Object.entries(stats.by_severity).map(([key, value]) => ({
        name: SEVERITY_LABELS[key] || key,
        value,
        fill: SEVERITY_COLORS[key] || '#6b7280',
      }))
    : []

  const critical = stats?.by_severity?.critical || 0
  const high = stats?.by_severity?.high || 0
  const withCoords = defects.filter((d) => d.lat != null && d.lng != null).length

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Дашборд</h1>
        <p className="text-slate-500 text-sm mt-0.5">Общая статистика системы мониторинга</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="Всего дефектов"
          value={stats?.total || 0}
          icon={<Activity size={20} className="text-white" />}
          color="bg-blue-600"
        />
        <StatsCard
          title="Критических"
          value={critical}
          icon={<AlertTriangle size={20} className="text-white" />}
          color="bg-red-500"
        />
        <StatsCard
          title="Высокий приоритет"
          value={high}
          icon={<TrendingUp size={20} className="text-white" />}
          color="bg-orange-500"
        />
        <StatsCard
          title="С координатами"
          value={withCoords}
          icon={<MapPin size={20} className="text-white" />}
          color="bg-emerald-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-700 mb-3">По типу дефекта</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">
              Нет данных
            </div>
          )}
          <div className="mt-2 space-y-1">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                {item.name}: <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-700 mb-3">По тяжести</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">
              Нет данных
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-700 mb-3">Последние дефекты</h3>
          <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: 260 }}>
            {defects.length === 0 && (
              <p className="text-slate-400 text-sm">Дефекты не обнаружены</p>
            )}
            {defects.slice(0, 10).map((defect) => (
              <div key={defect.id} className="flex items-center gap-2.5 text-sm">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: SEVERITY_COLORS[defect.severity] || '#6b7280' }}
                />
                <span className="text-slate-600 flex-1 truncate">
                  {TYPE_LABELS[defect.defect_type] || defect.defect_type}
                </span>
                <span className="text-slate-400 text-xs flex-shrink-0">
                  {new Date(defect.detected_at).toLocaleDateString('ru')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
