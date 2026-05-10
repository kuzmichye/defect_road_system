import { useState, useRef, useEffect } from 'react'
import { Upload, MapPin, CheckCircle, AlertCircle, Film, Image as ImageIcon, Clock, Database, X, Search, Loader2 } from 'lucide-react'
import { defectApi } from '../api/client'
import { DefectMap } from '../components/Map/DefectMap'
import exifr from 'exifr'

const TYPE_LABELS: Record<string, string> = {
  'potholes': 'Выбоины',
  'alligator cracks': 'Сетка трещин',
  'longitudnal_cracks': 'Продольные трещины',
  'transverse cracks': 'Поперечные трещины',
  'rutting': 'Колейность',
  'patchy road sections': 'Ремонтные карты',
  'lane line blurs': 'Потёртость разметки',
  'pedestrian crossing blurs': 'Потёртость пеш. перехода',
  'manhole covers': 'Люки',
  'repaired cracks': 'Заделанные трещины',
}

type Tab = 'photo' | 'video'

interface SectionState {
  file: File | null
  loading: boolean
  loadingStartTime: number | null
  error: string | null
  results: any[] | null
  annotatedUrl: string | null
  videoResult: { message: string; count: number } | null
  annotatedVideoUrl: string | null
  dragOver: boolean
  savedAt: number | null
  lat: number | null
  lng: number | null
  geoChecked: boolean
  hasGeoTag: boolean
  searchQuery: string
  searchLocation: { lat: number; lng: number } | null
  searchLoading: boolean
}

const emptyState = (): SectionState => ({
  file: null,
  loading: false,
  loadingStartTime: null,
  error: null,
  results: null,
  annotatedUrl: null,
  videoResult: null,
  annotatedVideoUrl: null,
  dragOver: false,
  savedAt: null,
  lat: null,
  lng: null,
  geoChecked: false,
  hasGeoTag: false,
  searchQuery: '',
  searchLocation: null,
  searchLoading: false,
})

const STORAGE_KEY: Record<Tab, string> = {
  photo: 'defect_result_photo',
  video: 'defect_result_video',
}
const VIDEO_TASK_KEY = 'defect_video_pending_task'

function loadSaved(type: Tab): Partial<SectionState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY[type])
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function persistResult(type: Tab, patch: Partial<SectionState>, base: SectionState) {
  const data = {
    results: patch.results ?? base.results,
    annotatedUrl: patch.annotatedUrl ?? base.annotatedUrl,
    videoResult: patch.videoResult ?? base.videoResult,
    annotatedVideoUrl: patch.annotatedVideoUrl ?? base.annotatedVideoUrl,
    savedAt: patch.savedAt ?? Date.now(),
  }
  localStorage.setItem(STORAGE_KEY[type], JSON.stringify(data))
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`
  return `${Math.floor(diff / 86400)} д. назад`
}

function VideoProgress({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startTime) / 1000))

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startTime])

  const progress = Math.min(92, 100 * (1 - Math.exp(-elapsed / 50)))
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  const stages = [
    { label: 'Загрузка видео',         done: elapsed >= 4, active: elapsed < 4 },
    { label: 'Анализ кадров',          done: false,        active: elapsed >= 4 },
    { label: 'Сохранение результатов', done: false,        active: false        },
  ]

  return (
    <div className="space-y-5 py-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Анализ видео</p>
        <div className="flex items-center gap-1 text-slate-400 text-xs tabular-nums">
          <Clock size={11} />
          {minutes}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-[1200ms] ease-out"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse rounded-full pointer-events-none" />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>Обрабатывается...</span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              stage.done ? 'bg-green-100' : stage.active ? 'bg-blue-100' : 'bg-slate-100'
            }`}>
              {stage.done ? (
                <CheckCircle size={12} className="text-green-600" />
              ) : stage.active ? (
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              ) : (
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
              )}
            </div>
            <span className={`text-sm transition-colors ${
              stage.done   ? 'text-slate-400 line-through' :
              stage.active ? 'text-slate-700 font-medium'  :
                             'text-slate-400'
            }`}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">Не закрывайте страницу</p>
    </div>
  )
}

async function readExifGps(file: File): Promise<{ lat: number; lng: number } | null> {
  try {
    const gps = await exifr.gps(file)
    if (gps?.latitude != null && gps?.longitude != null) {
      return { lat: gps.latitude, lng: gps.longitude }
    }
    return null
  } catch {
    return null
  }
}

async function searchAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ru`,
    )
    const data = await res.json()
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
    return null
  } catch {
    return null
  }
}

function UploadSection({
  type,
  state,
  onChange,
  onSubmit,
  onReset,
}: {
  type: Tab
  state: SectionState
  onChange: (patch: Partial<SectionState>) => void
  onSubmit: () => void
  onReset: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const accept = type === 'photo' ? 'image/*' : 'video/*'
  const hasResult = state.results !== null || state.videoResult !== null || state.annotatedVideoUrl !== null
  const locationReady = type === 'video' || (state.lat != null && state.lng != null)

  const handleFileSelect = async (f: File) => {
    const valid = type === 'photo' ? f.type.startsWith('image/') : f.type.startsWith('video/')
    if (!valid) {
      onChange({ error: type === 'photo' ? 'Выберите изображение' : 'Выберите видеофайл' })
      return
    }
    onChange({
      file: f,
      results: null,
      annotatedUrl: null,
      videoResult: null,
      annotatedVideoUrl: null,
      error: null,
      geoChecked: false,
      hasGeoTag: false,
      lat: null,
      lng: null,
      searchQuery: '',
      searchLocation: null,
    })

    if (type === 'photo') {
      const gps = await readExifGps(f)
      if (gps) {
        onChange({ geoChecked: true, hasGeoTag: true, lat: gps.lat, lng: gps.lng })
      } else {
        onChange({ geoChecked: true, hasGeoTag: false })
      }
    } else {
      // Video: can't reliably read GPS from browser, require manual selection
      onChange({ geoChecked: true, hasGeoTag: false })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onChange({ dragOver: false })
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
  }

  const handleSearch = async () => {
    if (!state.searchQuery.trim()) return
    onChange({ searchLoading: true })
    const loc = await searchAddress(state.searchQuery)
    onChange({ searchLoading: false, searchLocation: loc ?? state.searchLocation })
  }

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  if (state.loading && type === 'video' && state.loadingStartTime) {
    return <VideoProgress startTime={state.loadingStartTime} />
  }

  if (state.loading && type === 'photo') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-600 font-medium">Анализ изображения...</p>
      </div>
    )
  }

  if (hasResult) {
    return (
      <div className="space-y-4">
        {state.savedAt != null && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Database size={11} />
            Сохранено в базу данных · {relativeTime(state.savedAt)}
          </div>
        )}

        {state.annotatedUrl && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <CheckCircle size={15} className="text-green-600" />
              Аннотированное изображение
            </p>
            <img
              src={state.annotatedUrl}
              alt="Результат анализа"
              className="w-full rounded-xl border border-slate-200 shadow-sm"
            />
          </div>
        )}

        {state.videoResult && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm">
            <CheckCircle size={15} />
            {state.videoResult.message}
          </div>
        )}

        {state.annotatedVideoUrl && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <CheckCircle size={15} className="text-green-600" />
              Аннотированное видео
            </p>
            <video
              src={state.annotatedVideoUrl}
              controls
              className="w-full rounded-xl border border-slate-200 shadow-sm"
              style={{ maxHeight: 360 }}
            />
          </div>
        )}

        {(state.results ?? []).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              Обнаружено дефектов: {state.results!.length}
            </p>
            {state.results!.map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">
                  {TYPE_LABELS[r.defect_type] || r.defect_type}
                </span>
                {r.confidence != null && (
                  <span className="text-slate-400 text-xs">{(r.confidence * 100).toFixed(0)}%</span>
                )}
              </div>
            ))}
          </div>
        )}

        {state.results?.length === 0 && !state.videoResult && (
          <p className="text-slate-400 text-sm text-center py-4">Дефекты не обнаружены</p>
        )}

        <button
          onClick={onReset}
          className="w-full border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          ← Загрузить новый файл
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); onChange({ dragOver: true }) }}
        onDragLeave={() => onChange({ dragOver: false })}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          state.dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
        {state.file ? (
          <div className="space-y-1.5">
            {type === 'video'
              ? <Film size={36} className="mx-auto text-blue-500" />
              : <ImageIcon size={36} className="mx-auto text-blue-500" />
            }
            <p className="font-medium text-slate-700 text-sm">{state.file.name}</p>
            <p className="text-slate-400 text-xs">{(state.file.size / 1024 / 1024).toFixed(2)} МБ</p>
            <button
              onClick={(e) => { e.stopPropagation(); onReset() }}
              className="text-xs text-blue-500 hover:underline"
            >
              Заменить файл
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {type === 'video'
              ? <Film size={36} className="mx-auto text-slate-300" />
              : <Upload size={36} className="mx-auto text-slate-300" />
            }
            <p className="text-slate-600 font-medium">Перетащите файл сюда</p>
            <p className="text-slate-400 text-xs">
              {type === 'photo' ? 'JPG, PNG, WEBP и другие форматы изображений' : 'MP4, AVI, MOV и другие видеоформаты'}
            </p>
          </div>
        )}
      </div>

      {/* Location section */}
      {state.file && (
        <>
          {/* Checking EXIF */}
          {!state.geoChecked && type === 'photo' && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={14} className="animate-spin" />
              Проверка геометки файла...
            </div>
          )}

          {/* GPS found automatically */}
          {state.geoChecked && state.hasGeoTag && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin size={14} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">Геопозиция из файла</p>
                  <p className="text-xs text-green-600 font-mono mt-0.5">
                    {state.lat?.toFixed(6)}, {state.lng?.toFixed(6)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange({ lat: null, lng: null, hasGeoTag: false })}
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* No GPS — map picker (mandatory for photo, optional for video) */}
          {state.geoChecked && !state.hasGeoTag && (
            <div className="space-y-3">
              {type === 'photo' ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-800">Геометка не найдена — укажите место на карте</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <MapPin size={15} className="text-slate-400 flex-shrink-0" />
                  <p className="text-sm text-slate-600">GPS будет извлечён из видео автоматически — или укажите на карте</p>
                </div>
              )}

              {/* Address search */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={state.searchQuery}
                  onChange={(e) => onChange({ searchQuery: e.target.value })}
                  onKeyDown={handleSearchKey}
                  placeholder="Поиск адреса..."
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={state.searchLoading}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors flex items-center"
                >
                  {state.searchLoading
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Search size={15} />
                  }
                </button>
              </div>

              {/* Map */}
              <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 280 }}>
                <DefectMap
                  height="280px"
                  onMapClick={(lat, lng) => onChange({ lat, lng })}
                  selectedCoords={state.lat != null ? { lat: state.lat, lng: state.lng! } : null}
                  focusLocation={state.searchLocation}
                />
              </div>

              {state.lat != null ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-blue-600" />
                    <span className="text-xs text-blue-700 font-mono">{state.lat.toFixed(5)}, {state.lng!.toFixed(5)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange({ lat: null, lng: null })}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center">Нажмите на карту, чтобы отметить место</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={!state.file || state.loading || !locationReady}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
      >
        {type === 'video' ? 'Обработать видео' : 'Определить дефекты'}
      </button>

      {state.error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <AlertCircle size={15} />
          {state.error}
        </div>
      )}
    </div>
  )
}

export function UploadPage() {
  const [tab, setTab] = useState<Tab>('photo')
  const [photo, setPhoto] = useState<SectionState>(() => {
    const saved = loadSaved('photo')
    return saved ? { ...emptyState(), ...saved } : emptyState()
  })
  const [video, setVideo] = useState<SectionState>(() => {
    const saved = loadSaved('video')
    return saved ? { ...emptyState(), ...saved } : emptyState()
  })

  const patchPhoto = (p: Partial<SectionState>) => setPhoto((s) => ({ ...s, ...p }))
  const patchVideo = (p: Partial<SectionState>) => setVideo((s) => ({ ...s, ...p }))

  const pollingRef = useRef(false)

  const pollVideoTask = async (task_id: string) => {
    if (pollingRef.current) return
    pollingRef.current = true
    for (;;) {
      await new Promise((res) => setTimeout(res, 3000))
      try {
        const status = await defectApi.getVideoStatus(task_id)
        if (status.status === 'done') {
          localStorage.removeItem(VIDEO_TASK_KEY)
          const savedAt = Date.now()
          const result: Partial<SectionState> = {
            videoResult: { message: status.message, count: status.count },
            annotatedVideoUrl: status.annotated_video_url ?? null,
            results: status.defects ?? [],
            loading: false,
            savedAt,
          }
          setVideo((s) => ({ ...s, ...result }))
          persistResult('video', result, emptyState())
          pollingRef.current = false
          return
        }
        if (status.status === 'error') {
          localStorage.removeItem(VIDEO_TASK_KEY)
          setVideo((s) => ({ ...s, error: status.message || 'Ошибка при обработке видео', loading: false }))
          pollingRef.current = false
          return
        }
      } catch (e: any) {
        localStorage.removeItem(VIDEO_TASK_KEY)
        setVideo((s) => ({ ...s, error: e?.response?.data?.detail || e.message || 'Ошибка', loading: false }))
        pollingRef.current = false
        return
      }
    }
  }

  // Resume polling if user navigated away during video processing
  useEffect(() => {
    const raw = localStorage.getItem(VIDEO_TASK_KEY)
    if (!raw) return
    try {
      const { task_id, loadingStartTime } = JSON.parse(raw)
      const saved = loadSaved('video')
      if (saved?.videoResult || saved?.annotatedVideoUrl) {
        localStorage.removeItem(VIDEO_TASK_KEY)
        return
      }
      setTab('video')
      setVideo((s) => ({ ...s, loading: true, loadingStartTime }))
      pollVideoTask(task_id)
    } catch {
      localStorage.removeItem(VIDEO_TASK_KEY)
    }
  }, [])

  const handleSubmit = async (type: Tab) => {
    const state = type === 'photo' ? photo : video
    const patch = type === 'photo' ? patchPhoto : patchVideo
    if (!state.file) return
    if (type === 'photo' && (state.lat == null || state.lng == null)) return

    const startTime = Date.now()
    patch({ loading: true, error: null, results: null, annotatedUrl: null, videoResult: null, annotatedVideoUrl: null, loadingStartTime: startTime, savedAt: null })

    const fd = new FormData()
    fd.append('file', state.file)
    fd.append('lat', String(state.lat))
    fd.append('lng', String(state.lng))

    if (type === 'video') {
      try {
        const { task_id } = await defectApi.detectVideo(fd)
        localStorage.setItem(VIDEO_TASK_KEY, JSON.stringify({ task_id, loadingStartTime: startTime }))
        await pollVideoTask(task_id)
      } catch (e: any) {
        patch({ error: e?.response?.data?.detail || e.message || 'Ошибка при обработке', loading: false })
      }
      return
    }

    try {
      const r = await defectApi.detectImage(fd)
      const savedAt = Date.now()
      const result: Partial<SectionState> = { results: r.defects, annotatedUrl: r.annotated_url, savedAt }
      patch(result)
      persistResult(type, result, state)
    } catch (e: any) {
      patch({ error: e?.response?.data?.detail || e.message || 'Ошибка при обработке' })
    } finally {
      patch({ loading: false })
    }
  }

  const resetSection = (type: Tab) => {
    localStorage.removeItem(STORAGE_KEY[type])
    if (type === 'video') localStorage.removeItem(VIDEO_TASK_KEY)
    if (type === 'photo') setPhoto(emptyState())
    else setVideo(emptyState())
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Загрузка и детекция</h1>
        <p className="text-slate-500 text-sm mt-0.5">Загрузите фото или видео для обнаружения дефектов дорожного покрытия</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setTab('photo')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'photo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ImageIcon size={16} />
          Фотография
        </button>
        <button
          onClick={() => setTab('video')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'video' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Film size={16} />
          Видеозапись
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        {tab === 'photo' ? (
          <UploadSection
            type="photo"
            state={photo}
            onChange={patchPhoto}
            onSubmit={() => handleSubmit('photo')}
            onReset={() => resetSection('photo')}
          />
        ) : (
          <UploadSection
            type="video"
            state={video}
            onChange={patchVideo}
            onSubmit={() => handleSubmit('video')}
            onReset={() => resetSection('video')}
          />
        )}
      </div>
    </div>
  )
}
