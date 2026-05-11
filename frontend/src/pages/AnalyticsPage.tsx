import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Activity, CalendarDays,
  ShieldAlert, AlertTriangle, Clock,
} from 'lucide-react'
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { defectApi } from '../api/client'
import { TYPE_COLORS } from '../components/Map/DefectMap'

// ─── Словари ─────────────────────────────────────────────────────────────────

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

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
}

const RISK_LABELS_RU: Record<string, string> = {
  critical: 'Критический',
  high:     'Высокий',
  medium:   'Средний',
  low:      'Низкий',
}

const RISK_BG: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-green-100 text-green-700',
}

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface ForecastData {
  history:   { date: string; count: number }[]
  forecast:  { date: string; count: number }[]
  slope:     number
  top_types: { type: string; count: number }[]
}

interface CriticalDefect {
  id:               number
  defect_type:      string
  severity:         string
  address:          string | null
  risk_score:       number
  risk_level:       string
  days_to_critical: number
}

interface RiskSummary {
  total:            number
  distribution:     Record<string, number>
  avg_risk_score:   number
  critical_defects: CriticalDefect[]
}

interface ForecastMonth {
  month:           string
  label:           string
  predicted_count: number
  season_factor:   number
  breakdown:       Record<string, number>
}

interface RiskForecast {
  months:             ForecastMonth[]
  current_daily_rate: number
}

// ─── Вспомогательные компоненты ──────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function SectionSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm animate-pulse h-48 flex items-center justify-center">
      <span className="text-slate-300 text-sm">Загрузка ML-модели...</span>
    </div>
  )
}

// ─── Страница ─────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [forecast,     setForecast]     = useState<ForecastData | null>(null)
  const [riskSummary,  setRiskSummary]  = useState<RiskSummary | null>(null)
  const [riskForecast, setRiskForecast] = useState<RiskForecast | null>(null)

  const [loadingForecast,     setLoadingForecast]     = useState(true)
  const [loadingRiskSummary,  setLoadingRiskSummary]  = useState(true)
  const [loadingRiskForecast, setLoadingRiskForecast] = useState(true)

  useEffect(() => {
    defectApi.getForecast()
      .then(setForecast)
      .finally(() => setLoadingForecast(false))

    defectApi.getRiskSummary()
      .then(setRiskSummary)
      .finally(() => setLoadingRiskSummary(false))

    defectApi.getRiskForecast()
      .then(setRiskForecast)
      .finally(() => setLoadingRiskForecast(false))
  }, [])

  // ── KPI из /forecast ──
  const total30   = forecast?.history.reduce((s, h) => s + h.count, 0) ?? 0
  const forecast7 = Math.round(forecast?.forecast.slice(0, 7).reduce((s, f) => s + f.count, 0) ?? 0)
  const slope     = forecast?.slope ?? 0
  const TrendIcon = slope > 0.05 ? TrendingUp : slope < -0.05 ? TrendingDown : Minus
  const trendLabel  = slope > 0.05 ? 'Растёт' : slope < -0.05 ? 'Снижается' : 'Стабильно'
  const trendColor  = slope > 0.05 ? 'text-red-500'     : slope < -0.05 ? 'text-emerald-500' : 'text-slate-500'
  const trendBg     = slope > 0.05 ? 'bg-red-50'        : slope < -0.05 ? 'bg-emerald-50'    : 'bg-slate-50'
  const trendIconBg = slope > 0.05 ? 'bg-red-100'       : slope < -0.05 ? 'bg-emerald-100'   : 'bg-slate-100'

  const chartData = forecast ? [
    ...forecast.history.map((h, i) => ({
      date: formatDate(h.date),
      actual: h.count,
      ...(i === forecast.history.length - 1 ? { predicted: h.count } : {}),
    })),
    ...forecast.forecast.map((f) => ({ date: formatDate(f.date), predicted: f.count })),
  ] : []
  const todayLabel = chartData[forecast?.history.length ?? 0 - 1]?.date
  const maxBar     = Math.max(...(forecast?.top_types.map((t) => t.count) ?? [1]), 1)

  // ── Donut данные ──
  const donutData = riskSummary
    ? (['critical', 'high', 'medium', 'low'] as const).map((k) => ({
        name:  RISK_LABELS_RU[k],
        value: riskSummary.distribution[k] ?? 0,
        color: RISK_COLORS[k],
      })).filter((d) => d.value > 0)
    : []

  // ── Сезонный прогноз: bar chart ──
  const seasonBar = riskForecast?.months.map((m) => ({
    label:    m.label,
    count:    m.predicted_count,
    factor:   m.season_factor,
  })) ?? []

  const seasonBarColor = (factor: number) => {
    if (factor >= 3.0) return '#ef4444'
    if (factor >= 2.0) return '#f97316'
    if (factor >= 1.5) return '#f59e0b'
    if (factor <= 0.9) return '#22c55e'
    return '#60a5fa'
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">

      {/* Заголовок */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Прогнозная аналитика</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          ML-анализ рисков · ГОСТ Р 50597-2017 · Сезонные факторы Москвы
        </p>
      </div>

      {/* ── KPI карточки ── */}
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
          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center mb-3">
            <ShieldAlert size={16} className="text-white" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {riskSummary ? riskSummary.distribution['critical'] + riskSummary.distribution['high'] : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Высокий / Критический риск</div>
        </div>
      </div>

      {/* ── ML: Распределение рисков + средний скор ── */}
      {loadingRiskSummary ? <SectionSkeleton /> : riskSummary && riskSummary.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Donut */}
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-700 mb-1">Распределение уровней риска</h3>
            <p className="text-xs text-slate-400 mb-3">
              RandomForest · {riskSummary.total} дефектов · ГОСТ Р 50597-2017
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => [v, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Средний скор + легенда */}
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">Средний индекс риска</h3>
              <p className="text-xs text-slate-400 mb-4">GradientBoosting · Шкала 0–100</p>
              <div className="flex items-end gap-3 mb-4">
                <span className="text-5xl font-bold text-slate-800">{riskSummary.avg_risk_score}</span>
                <span className="text-slate-400 text-sm mb-1">/ 100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${riskSummary.avg_risk_score}%`,
                    background: riskSummary.avg_risk_score >= 80 ? '#ef4444'
                              : riskSummary.avg_risk_score >= 60 ? '#f97316'
                              : riskSummary.avg_risk_score >= 40 ? '#f59e0b'
                              : '#22c55e',
                  }}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(['critical', 'high', 'medium', 'low'] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: RISK_COLORS[k] }} />
                  <span className="text-xs text-slate-500">{RISK_LABELS_RU[k]}</span>
                  <span className="text-xs font-semibold text-slate-700 ml-auto">
                    {riskSummary.distribution[k] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ML: Критические дефекты ── */}
      {loadingRiskSummary ? <SectionSkeleton /> : riskSummary && riskSummary.critical_defects.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="font-semibold text-slate-700">Дефекты высокого риска</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Ранжированы по ML-индексу риска · прогноз дней до критического состояния
          </p>
          <div className="space-y-2">
            {riskSummary.critical_defects.map((d, i) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="text-xs text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: TYPE_COLORS[d.defect_type] || '#6b7280' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">
                    {TYPE_LABELS[d.defect_type] || d.defect_type}
                  </div>
                  {d.address && (
                    <div className="text-xs text-slate-400 truncate">{d.address}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_BG[d.risk_level]}`}>
                    {RISK_LABELS_RU[d.risk_level]}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-800">{d.risk_score}</div>
                    <div className="flex items-center gap-0.5 text-slate-400">
                      <Clock size={10} />
                      <span className="text-xs">{d.days_to_critical}д</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Динамика + линейный прогноз ── */}
      {!loadingForecast && forecast && (
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
            <h3 className="font-semibold text-slate-700">Динамика обнаружений</h3>
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
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
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
      )}

      {/* ── ML: Сезонный прогноз на 6 месяцев ── */}
      {loadingRiskForecast ? <SectionSkeleton /> : riskForecast && (
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-1">Сезонный прогноз — следующие 6 месяцев</h3>
          <p className="text-xs text-slate-400 mb-4">
            Базовый темп {riskForecast.current_daily_rate} дефектов/день × сезонный коэффициент Москвы
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seasonBar} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v: number, _name: string, props: any) => [
                  `${v} дефектов (k=${props.payload?.factor})`,
                  'Прогноз',
                ]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {seasonBar.map((entry, i) => (
                  <Cell key={i} fill={seasonBarColor(entry.factor)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
            {[
              { color: '#ef4444', label: 'k ≥ 3.0 — пик оттепели (апр)' },
              { color: '#f97316', label: 'k ≥ 2.0 — переходный период' },
              { color: '#f59e0b', label: 'k ≥ 1.5 — заморозки' },
              { color: '#22c55e', label: 'k < 1.0 — минимальный риск' },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Топ типов дефектов ── */}
      {!loadingForecast && forecast && forecast.top_types.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">Топ типов дефектов</h3>
          <div className="space-y-3">
            {forecast.top_types.map((t) => (
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
