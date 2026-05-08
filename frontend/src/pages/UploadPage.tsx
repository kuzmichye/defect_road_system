import { useState, useRef } from 'react'
import { Upload, MapPin, CheckCircle, AlertCircle, Film, Image as ImageIcon } from 'lucide-react'
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

type Tab = 'photo' | 'video'

interface SectionState {
  file: File | null
  address: string
  district: string
  loading: boolean
  error: string | null
  results: any[] | null
  videoResult: { message: string; count: number } | null
  dragOver: boolean
}

const emptyState = (): SectionState => ({
  file: null,
  address: '',
  district: '',
  loading: false,
  error: null,
  results: null,
  videoResult: null,
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
    onChange({ file: f, results: null, videoResult: null, error: null })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onChange({ file: f, results: null, videoResult: null, error: null })
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Район / округ
        </label>
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
        {state.loading
          ? 'Обрабатывается...'
          : type === 'video'
          ? 'Обработать видео'
          : 'Определить дефекты'}
      </button>

      {/* Error */}
      {state.error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <AlertCircle size={15} />
          {state.error}
        </div>
      )}

      {/* Video result */}
      {state.videoResult && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
          <CheckCircle size={15} />
          {state.videoResult.message}
        </div>
      )}

      {/* Image results */}
      {state.results && state.results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <CheckCircle size={15} className="text-green-600" />
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
    patch({ loading: true, error: null, results: null, videoResult: null })
    try {
      const fd = new FormData()
      fd.append('file', state.file)
      const fullAddress = [state.district, state.address].filter(Boolean).join(', ')
      if (fullAddress) fd.append('address', fullAddress)

      if (type === 'video') {
        const r = await defectApi.detectVideo(fd)
        patch({ videoResult: r })
      } else {
        const r = await defectApi.detectImage(fd)
        patch({ results: r })
      }
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
            tab === 'photo'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ImageIcon size={16} />
          Фотография
        </button>
        <button
          onClick={() => setTab('video')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'video'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
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
