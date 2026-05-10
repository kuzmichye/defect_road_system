import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Activity, CalendarDays, BarChart2 } from 'lucide-react'
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { defectApi } from '../api/client'
import { TYPE_COLORS } from '../components/Map/DefectMap'

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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface ForecastData {
  history: { date: string; count: number }[]
  forecast: { date: string; count: number }[]
  slope: number
  top_types: { type: string; count: number }[]
}

export function AnalyticsPage() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    defectApi.getForecast().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Загрузка...</div>
  }
  if (!data) return null

  const total30 = data.history.reduce((s, h) => s + h.count, 0)
  const forecast7 = Math.round(data.forecast.slice(0, 7).reduce((s, f) => s + f.count, 0))
  const topType = data.top_types[0]
  const slope = data.slope

  const TrendIcon = slope > 0.05 ? TrendingUp : slope < -0.05 ? TrendingDown : Minus
  const trendLabel = slope > 0.05 ? 'Растёт' : slope < -0.05 ? 'Снижается' : 'Стабильно'
  const trendColor = slope > 0.05 ? 'text-red-500' : slope < -0.05 ? 'text-emerald-500' : 'text-slate-500'
  const trendBg = slope > 0.05 ? 'bg-red-50' : slope < -0.05 ? 'bg-emerald-50' : 'bg-slate-50'
  const trendIconBg = slope > 0.05 ? 'bg-red-100' : slope < -0.05 ? 'bg-emerald-100' : 'bg-slate-100'

  const chartData = [
    ...data.history.map((h, i) => ({
      date: formatDate(h.date),
      actual: h.count,
      ...(i === data.history.length - 1 ? { predicted: h.count } : {}),
    })),
    ...data.forecast.map((f) => ({
      date: formatDate(f.date),
      predicted: f.count,
    })),
  ]

  const todayLabel = chartData[data.history.length - 1]?.date
  const maxBar = Math.max(...data.top_types.map((t) => t.count), 1)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Прогнозная аналитика</h1>
        <p className="text-slate-500 text-sm mt-0.5">История и прогноз обнаружения дефектов</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mb-3">
            <Activity size={16} className="text-white" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{total30}</div>
          <div className="text-xs text-slate-500 mt-0.5">За последние 30 дней</div>
        </div>

        <div className={`rounded-xl p-4 border border-slate-100 shadow-sm ${trendBg}`}>
          <div className={`w-8 h-8 ${trendIconBg} rounded-lg flex items-center justify-center mb-3`}>
            <TrendIcon size={16} className={trendColor} />
          </div>
          <div className={`text-2xl font-bold ${trendColor}`}>{trendLabel}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {slope >= 0 ? `+${slope.toFixed(2)}` : slope.toFixed(2)} дефектов/день
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center mb-3">
            <CalendarDays size={16} className="text-white" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{forecast7}</div>
          <div className="text-xs text-slate-500 mt-0.5">Прогноз на 7 дней</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mb-3">
            <BarChart2 size={16} className="text-white" />
          </div>
          <div className="text-base font-bold text-slate-800 leading-snug">
            {topType ? (TYPE_LABELS[topType.type] || topType.type) : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {topType ? `${topType.count} обнаружений` : 'Нет данных'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <h3 className="font-semibold text-slate-700">Динамика и прогноз</h3>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-blue-500 inline-block rounded" />
              История (факт)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 inline-block border-t-2 border-dashed border-orange-400" />
              Прогноз
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4">30 дней истории + 14 дней линейного прогноза</p>

        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              formatter={(v: number, name: string) => [v, name === 'actual' ? 'Факт' : 'Прогноз']}
            />
            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                stroke="#cbd5e1"
                strokeDasharray="4 3"
                label={{ value: 'сегодня', position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }}
              />
            )}
            <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="predicted" stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Top types */}
      {data.top_types.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">Топ типов дефектов</h3>
          <div className="space-y-3">
            {data.top_types.map((t) => (
              <div key={t.type} className="flex items-center gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: TYPE_COLORS[t.type] || '#6b7280' }}
                />
                <span className="text-sm text-slate-600 w-28 sm:w-40 flex-shrink-0">
                  {TYPE_LABELS[t.type] || t.type}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${(t.count / maxBar) * 100}%`, background: TYPE_COLORS[t.type] || '#6b7280' }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700 w-6 text-right">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
