import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const auth = localStorage.getItem('auth')
  if (auth) {
    const token = JSON.parse(auth)?.state?.token
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const defectApi = {
  getAll: (params?: { defect_type?: string; severity?: string }) =>
    api.get('/inventory/defects', { params }).then((r) => r.data),

  getStats: () => api.get('/inventory/stats').then((r) => r.data),

  update: (id: number, data: object) =>
    api.put(`/inventory/defects/${id}`, data).then((r) => r.data),

  delete: (id: number) => api.delete(`/inventory/defects/${id}`),

  detectImage: (formData: FormData) =>
    api.post('/detection/image', formData).then((r) => r.data),

  detectVideo: (formData: FormData) =>
    api.post('/detection/video', formData).then((r) => r.data),

  getVideoStatus: (taskId: string) =>
    api.get(`/detection/video/status/${taskId}`).then((r) => r.data),

  exportCsv: () =>
    api.get('/export/csv', { responseType: 'blob' }).then((r) => r.data),

  exportGeoJson: () => api.get('/export/geojson').then((r) => r.data),
}
