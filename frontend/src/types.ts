export type DefectType =
  | 'potholes'
  | 'alligator cracks'
  | 'longitudnal_cracks'
  | 'transverse cracks'
  | 'rutting'
  | 'patchy road sections'
  | 'lane line blurs'
  | 'pedestrian crossing blurs'
  | 'manhole covers'
  | 'repaired cracks'
  | string

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface Defect {
  id: number
  defect_type: DefectType
  severity: Severity
  confidence: number | null
  lat: number | null
  lng: number | null
  address: string | null
  photo_path: string | null
  source_type: 'image' | 'video'
  description: string | null
  detected_at: string
}

export interface Stats {
  total: number
  by_type: Record<string, number>
  by_severity: Record<string, number>
}
