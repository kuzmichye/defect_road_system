import { useState, useRef } from 'react'
import { Upload, MapPin, CheckCircle, AlertCircle, Film, Image as ImageIcon } from 'lucide-react'
import { defectApi } from '../api/client'

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

type Tab = 'photo' | 'video'

interface SectionState {
  file: File | null
  address: string
  district: string
  loading: boolean
  error: string | null
  results: any[] | null
  annotatedUrl: string | null
  videoResult: { message: string; count: number } | null
  frameUrls: string[]
  dragOver: boolean
}

const emptyState = (): SectionState => ({
  file: null,
  address: '',
  district: '',
  loading: false,
  error: null,
  results: null,
  annotatedUrl: null,
  videoResult: null,
  frameUrls: [],
  dragOver: false,
})

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
  const hasResult = state.results !== null || state.videoResult !== null

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onChange({ dragOver: false })
    const f = e.dataTransfer.files[0]
    if (!f) return
    const valid = type === 'photo' ? f.type.startsWith('image/') : f.type.startsWith('video/')
    if (!valid) {
      onChange({ error: type === 'photo' ? 'Выберите изображение' : 'Выберите видеофайл' })
      return
    }
    onChange({ file: f, results: null, annotatedUrl: null, videoResult: null, frameUrls: [], error: null })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onChange({ file: f, results: null, annotatedUrl: null, videoResult: null, frameUrls: [], error: null })
  }

  if (hasResult) {
    return (
      <div className="space-y-4">
        {/* Annotated image */}
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

        {/* Video result message */}
        {state.videoResult && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm">
            <CheckCircle size={15} />
            {state.videoResult.message}
          </div>
        )}

        {/* Video frames */}
        {state.frameUrls.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Кадры с дефектами:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {state.frameUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Дефект ${i + 1}`}
                  className="w-full rounded-xl border border-slate-200 shadow-sm"
                />
              ))}
            </div>
          </div>
        )}

        {/* Defect list */}
        {state.results && state.results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              Обнаружено дефектов: {state.results.length}
            </p>
            {state.results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-700">
                  {TYPE_LABELS[r.defect_type] || r.defect_type}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">
                    {r.confidence != null ? `${(r.confidence * 100).toFixed(0)}%` : ''}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[r.severity] || 'bg-slate-100 text-slate-600'}`}>
                    {SEVERITY_LABELS[r.severity] || r.severity}
                  </span>
                </div>
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
          ← Вернуться к загрузке
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
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />
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

      {/* District */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Район / округ</label>
        <input
          type="text"
          value={state.district}
          onChange={(e) => onChange({ district: e.target.value })}
          placeholder="Например: САО, Химки, Одинцово"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
          <MapPin size={13} className="text-slate-400" />
          Адрес / описание места
        </label>
        <input
          type="text"
          value={state.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Например: ул. Тверская, 10"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={!state.file || state.loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
      >
        {state.loading ? 'Обрабатывается...' : type === 'video' ? 'Обработать видео' : 'Определить дефекты'}
      </button>
      {state.loading && type === 'video' && (
        <p className="text-xs text-slate-400 text-center">
          Видео анализируется в фоне — не закрывайте страницу
        </p>
      )}

      {/* Error */}
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
  const [photo, setPhoto] = useState<SectionState>(emptyState())
  const [video, setVideo] = useState<SectionState>(emptyState())

  const patchPhoto = (p: Partial<SectionState>) => setPhoto((s) => ({ ...s, ...p }))
  const patchVideo = (p: Partial<SectionState>) => setVideo((s) => ({ ...s, ...p }))

  const handleSubmit = async (type: Tab) => {
    const state = type === 'photo' ? photo : video
    const patch = type === 'photo' ? patchPhoto : patchVideo
    if (!state.file) return

    patch({ loading: true, error: null, results: null, annotatedUrl: null, videoResult: null, frameUrls: [] })

    const fd = new FormData()
    fd.append('file', state.file)
    const fullAddress = [state.district, state.address].filter(Boolean).join(', ')
    if (fullAddress) fd.append('address', fullAddress)

    if (type === 'video') {
      try {
        const { task_id } = await defectApi.detectVideo(fd)
        for (;;) {
          await new Promise((res) => setTimeout(res, 3000))
          const status = await defectApi.getVideoStatus(task_id)
          if (status.status === 'done') {
            patch({
              videoResult: { message: status.message, count: status.count },
              frameUrls: status.frame_urls || [],
              loading: false,
            })
            return
          }
          if (status.status === 'error') {
            patch({ error: status.message || 'Ошибка при обработке видео', loading: false })
            return
          }
        }
      } catch (e: any) {
        patch({ error: e?.response?.data?.detail || e.message || 'Ошибка при обработке', loading: false })
      }
      return
    }

    try {
      const r = await defectApi.detectImage(fd)
      patch({ results: r.defects, annotatedUrl: r.annotated_url })
    } catch (e: any) {
      patch({ error: e?.response?.data?.detail || e.message || 'Ошибка при обработке' })
    } finally {
      patch({ loading: false })
    }
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
            onReset={() => patchPhoto(emptyState())}
          />
        ) : (
          <UploadSection
            type="video"
            state={video}
            onChange={patchVideo}
            onSubmit={() => handleSubmit('video')}
            onReset={() => patchVideo(emptyState())}
          />
        )}
      </div>
    </div>
  )
}
