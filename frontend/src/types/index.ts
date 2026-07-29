// Shared TypeScript types used across the application.

export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export type ArchStatus = 'active' | 'draft' | 'archived'
export type ChatRole = 'user' | 'assistant'

export type NodeType = 'standard' | 'group'

export interface Node {
  id: string
  label: string
  icon?: string
  description: string
  provider: string
  node_type: NodeType
  configs?: Record<string, unknown>[]
  created_at: string
  updated_at: string
}

export interface CreateNodePayload {
  label: string
  icon?: string
  description: string
  provider: string
  node_type: NodeType
}

export interface UpdateNodePayload {
  label?: string
  icon?: string
  description?: string
  provider?: string
  node_type?: NodeType
}

export interface ArchNodePosition {
  x: number
  y: number
}

export interface ArchNodeSchema {
  id: string
  label: string
  custom_label?: string
  icon?: string
  description?: string
  provider?: string
  position: ArchNodePosition
  node_type?: string
  configs?: Record<string, string>[]
  parent_id?: string
  width?: number
  height?: number
  color_theme?: string
  font_size?: number
}

export interface EdgeSchema {
  id?: string
  source: string
  target: string
  source_handle?: string
  target_handle?: string
  label?: string
  description?: string
}

export interface Arch {
  id: string
  name: string
  description: string
  nodes: ArchNodeSchema[]
  edges: EdgeSchema[]
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: string
}

// ─── Scenario types ───────────────────────────────────────────────────────────

export interface EntryPointPayload {
  node_id: string
  traffic_unit: string
}

export interface NodeOverridePayload {
  capacity?: number
  metric?: string
}

export interface SimNodePayload {
  canvas_node_id: string
  label: string
  icon: string
  metric: string
  capacity: number
  utilization: number
  reason?: string
}

export interface SimScenarioPayload {
  name: 'Best' | 'Mid' | 'Worst'
  entry_traffic: number
  nodes: SimNodePayload[]
}

export interface SimResultPayload {
  scenarios: [SimScenarioPayload, SimScenarioPayload, SimScenarioPayload]
}

export interface TrafficProfilePayload {
  traffic_unit: string
  best: number
  mid: number
  worst: number
}

export interface ScenarioResponse {
  id: string
  arch_id: string
  name: string
  description: string
  entry_point: EntryPointPayload | null
  traffic_profile: TrafficProfilePayload | null
  sim_result: SimResultPayload | null
  overrides: Record<string, NodeOverridePayload>
  created_at: string
  updated_at: string
}

export interface CreateScenarioPayload {
  name: string
  description: string
  entry_point: EntryPointPayload | null
}

export interface UpdateScenarioPayload {
  name?: string
  description?: string
  entry_point?: EntryPointPayload | null
  overrides?: Record<string, NodeOverridePayload>
}
