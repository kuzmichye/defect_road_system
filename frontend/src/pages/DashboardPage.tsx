import { useEffect } from 'react'
import { Activity, AlertTriangle, CalendarDays, MapPin } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useDefectStore } from '../store/defectStore'
import { StatsCard } from '../components/Dashboard/StatsCard'

const TYPE_LABELS: Record<string, string> = {
  'potholes':                  'Выбоины',
  'alligator cracks':          'Сетка трещин',
  'longitudnal_cracks':        'Прод. трещины',
  'transverse cracks':         'Поп. трещины',
  'rutting':                   'Колейность',
  'patchy road sections':      'Рем. карты',
  'lane line blurs':           'Потёртость разметки',
  'pedestrian crossing blurs': 'Пеш. переход',
  'repaired cracks':           'Заделанные',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Низкая', medium: 'Средняя', high: 'Высокая', critical: 'Критическая',
}

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

const TYPE_COLORS = [
  '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6b7280',
]

export function DashboardPage() {
  const { defects, stats, fetchDefects, fetchStats } = useDefectStore()

  useEffect(() => {
    fetchDefects()
    fetchStats()
  }, [])

  const today = new Date().toDateString()
  const todayCount = defects.filter((d) => new Date(d.detected_at).toDateString() === today).length
  const critical   = stats?.by_severity?.critical || 0
  const withCoords = defects.filter((d) => d.lat != null && d.lng != null).length
  const total      = stats?.total || 0
  const critPct    = total > 0 ? Math.round((critical / total) * 100) : 0

  // Severity donut (sorted)
  const donutData = SEVERITY_ORDER
    .filter((k) => stats?.by_severity?.[k])
    .map((k) => ({
      name: SEVERITY_LABELS[k],
      value: stats!.by_severity[k],
      fill: SEVERITY_COLORS[k],
    }))

  // Type horizontal bar (exclude manhole covers)
  const barData = stats
    ? Object.entries(stats.by_type)
        .filter(([k]) => k !== 'manhole covers')
        .sort(([, a], [, b]) => b - a)
        .map(([key, value], i) => ({
          name: TYPE_LABELS[key] || key,
          value,
          fill: TYPE_COLORS[i % TYPE_COLORS.length],
        }))
    : []

  const recentDefects = defects
    .filter((d) => d.defect_type !== 'manhole covers')
    .slice(0, 8)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Дашборд</h1>
        <p className="text-slate-500 text-sm mt-0.5">Статистика системы мониторинга дорог</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title="Всего дефектов"
          value={total}
          icon={<Activity size={20} className="text-white" />}
          color="bg-blue-600"
          sub={total > 0 ? `из них ${critPct}% критических` : undefined}
        />
        <StatsCard
          title="Критических"
          value={critical}
          icon={<AlertTriangle size={20} className="text-white" />}
          color="bg-red-500"
          sub="требуют вмешательства"
        />
        <StatsCard
          title="За сегодня"
          value={todayCount}
          icon={<CalendarDays size={20} className="text-white" />}
          color="bg-violet-500"
          sub="новых дефектов"
        />
        <StatsCard
          title="С координатами"
          value={withCoords}
          icon={<MapPin size={20} className="text-white" />}
          color="bg-emerald-500"
          sub="нанесено на карту"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        {/* Severity donut */}
        <div className="sm:col-span-2 bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">По тяжести</h3>
          {donutData.length > 0 ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      cx="50%" cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={2}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'дефектов']} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-800">{total}</span>
                  <span className="text-xs text-slate-400">всего</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {donutData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.fill }} />
                      <span className="text-slate-600">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">
                        {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                      </span>
                      <span className="font-semibold text-slate-700 w-6 text-right">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Нет данных</div>
          )}
        </div>

        {/* Type horizontal bar */}
        <div className="sm:col-span-3 bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">По типу дефекта</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={110}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={(v: number) => [v, 'дефектов']}
                />
                <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Нет данных</div>
          )}
        </div>
      </div>

      {/* Recent defects */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Последние дефекты</h3>
        </div>
        {recentDefects.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-10">Дефекты не обнаружены</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentDefects.map((defect) => (
              <div key={defect.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: SEVERITY_COLORS[defect.severity] || '#94a3b8' }}
                />
                <span className="text-sm font-medium text-slate-700 flex-1 min-w-0 truncate">
                  {TYPE_LABELS[defect.defect_type] || defect.defect_type}
                </span>
                {defect.address && (
                  <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[200px]">
                    {defect.address}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  defect.source_type === 'video'
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-blue-50 text-blue-600'
                }`}>
                  {defect.source_type === 'video' ? 'Видео' : 'Фото'}
                </span>
                <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
                  {new Date(defect.detected_at).toLocaleDateString('ru')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
