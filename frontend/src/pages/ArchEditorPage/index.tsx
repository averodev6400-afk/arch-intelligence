import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Input, Button, Avatar, Spin, Modal, Form, Select, message } from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  SaveOutlined,
  DownloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  EditOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  getViewportForBounds,
  type OnConnect,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import type {
  ChatMessage, Node as BackendNode, ApiResponse, PaginatedResponse,
  Arch, ArchNodeSchema, EdgeSchema,
  ScenarioResponse, CreateScenarioPayload, UpdateScenarioPayload,
} from '@/types'
import { apiFetch } from '@/utils/api'
import ArchNode from './ArchNode'
import GroupNode from './GroupNode'
import AnimatedTrafficEdge from './AnimatedTrafficEdge'

const nodeTypes = { archNode: ArchNode, groupNode: GroupNode }
const edgeTypes = { animatedEdge: AnimatedTrafficEdge }

type SimResult = import('@/types').SimResultPayload

// ScenarioItem extends the backend shape with transient UI state
interface ScenarioItem extends Omit<ScenarioResponse, 'sim_result'> {
  generating: boolean
  simResult: SimResult | null
}

function fromScenarioResponse(r: ScenarioResponse): ScenarioItem {
  return { ...r, generating: false, simResult: r.sim_result }
}

const SIM_PANEL_WIDTH = 340

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      "Hi! I'm your architecture analyst. Draw your system on the canvas and ask me anything — failure scenarios, bottlenecks, scalability, or security concerns. I'll analyse your topology in real-time.",
    timestamp: new Date().toISOString(),
  },
]

const MIN_CHAT_WIDTH = 260
const MAX_CHAT_WIDTH = 560
const DEFAULT_CHAT_WIDTH = 340

export default function ArchEditorPage() {
  return (
    <ReactFlowProvider>
      <ArchEditorInner />
    </ReactFlowProvider>
  )
}

function ArchEditorInner() {
  const { id: archId } = useParams<{ id: string }>()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH)
  const [availableNodes, setAvailableNodes] = useState<BackendNode[]>([])
  const [nodesLoading, setNodesLoading] = useState(false)
  const [toolbarSearch, setToolbarSearch] = useState('')
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  const [edgeModalOpen, setEdgeModalOpen] = useState(false)
  const [edgeForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
  const [archName, setArchName] = useState('')
  const [mode, setMode] = useState<'design' | 'simulate'>('design')
  const [simOpen, setSimOpen] = useState(false)

  // Scenario list
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([])
  const [scenariosLoading, setScenariosLoading] = useState(false)
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [addScenarioOpen, setAddScenarioOpen] = useState(false)
  const [addScenarioForm] = Form.useForm()
  const [editScenarioOpen, setEditScenarioOpen] = useState(false)
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null)
  const [editScenarioForm] = Form.useForm()

  // Detail view state (slider + Best/Mid/Worst tab)
  const [activeScenarioIdx, setActiveScenarioIdx] = useState<0 | 1 | 2>(1)
  const [entryTraffic, setEntryTraffic] = useState(0)

  // Inline override editing
  const [editingNodeOverride, setEditingNodeOverride] = useState<string | null>(null)
  const [overrideValues, setOverrideValues] = useState<{ capacity: string; metric: string }>({ capacity: '', metric: '' })

  const isResizing = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isDirty = useRef(false)
  const latestSave = useRef<(silent?: boolean) => Promise<void>>(async () => {})
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(41)
  const navigate = useNavigate()
  const reactFlowInstance = useReactFlow()

  const [nodes, setNodes, _onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, _onEdgesChange] = useEdgesState([] as Edge[])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    isDirty.current = true
    setSaveStatus('dirty')
    _onNodesChange(changes)
  }, [_onNodesChange])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    isDirty.current = true
    setSaveStatus('dirty')
    _onEdgesChange(changes)
  }, [_onEdgesChange])

  const activeItem = useMemo(
    () => scenarios.find((s) => s.id === activeScenarioId) ?? null,
    [scenarios, activeScenarioId],
  )

  // Reset slider/tab when switching scenario
  useEffect(() => {
    setEditingNodeOverride(null)
    if (!activeItem?.simResult) {
      setEntryTraffic(0)
      setActiveScenarioIdx(1)
      return
    }
    setActiveScenarioIdx(1)
    setEntryTraffic(activeItem.simResult.scenarios[1].entry_traffic)
  }, [activeScenarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load architecture on mount
  useEffect(() => {
    if (!archId) return
    async function loadArch() {
      try {
        const res = await apiFetch<ApiResponse<Arch>>(`/archs/${archId}`)
        const arch = res.data
        setArchName(arch.name)

        if (arch.nodes?.length) {
          const rfNodes: Node[] = arch.nodes.map((n: ArchNodeSchema) => ({
            id: n.id,
            type: n.node_type || 'archNode',
            position: { x: n.position.x, y: n.position.y },
            ...(n.parent_id ? { parentId: n.parent_id, extent: 'parent' as const } : {}),
            ...(n.node_type === 'groupNode' ? { style: { width: n.width || 400, height: n.height || 250 } } : {}),
            data: {
              label: n.label,
              custom_label: n.custom_label || '',
              icon: n.icon || '',
              description: n.description || '',
              provider: n.provider || '',
              configs: n.configs || [],
            },
          }))
          const sorted: Node[] = []
          const remaining = [...rfNodes]
          const placed = new Set<string>()
          while (remaining.length > 0) {
            const before = remaining.length
            for (let i = remaining.length - 1; i >= 0; i--) {
              const n = remaining[i]
              if (!n.parentId || placed.has(n.parentId)) {
                sorted.push(n)
                placed.add(n.id)
                remaining.splice(i, 1)
              }
            }
            if (remaining.length === before) {
              sorted.push(...remaining)
              break
            }
          }
          setNodes(sorted)
        }

        if (arch.edges?.length) {
          const rfEdges: Edge[] = arch.edges.map((e: EdgeSchema) => ({
            id: e.id || `e-${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            sourceHandle: e.source_handle || null,
            targetHandle: e.target_handle || null,
            label: e.label || '',
            data: { label: e.label, description: e.description },
          }))
          setEdges(rfEdges)
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : 'Failed to load architecture')
      }
    }
    loadArch()
  }, [archId])

  // Load chat history on mount
  useEffect(() => {
    if (!archId) return
    async function loadChats() {
      try {
        const res = await apiFetch<ApiResponse<{ items: { id: string; question: string; answer: string; created_at: string }[] }>>(`/archs/${archId}/chats?page=1&limit=50`)
        if (res.data.items?.length) {
          const chatMessages: ChatMessage[] = []
          for (const item of [...res.data.items].reverse()) {
            chatMessages.push({ id: `user-${item.id}`, role: 'user', content: item.question, timestamp: item.created_at })
            chatMessages.push({ id: item.id, role: 'assistant', content: item.answer, timestamp: item.created_at })
          }
          setMessages([...initialMessages, ...chatMessages])
        }
      } catch {
        // non-critical
      }
    }
    loadChats()
  }, [archId])

  // Load scenarios on mount
  useEffect(() => {
    if (!archId) return
    async function loadScenarios() {
      setScenariosLoading(true)
      try {
        const res = await apiFetch<ApiResponse<{ items: ScenarioResponse[] }>>(`/archs/${archId}/scenarios?page=1&limit=100`)
        setScenarios(res.data.items.map(fromScenarioResponse))
      } catch {
        // non-critical — panel shows empty state
      } finally {
        setScenariosLoading(false)
      }
    }
    loadScenarios()
  }, [archId])

  // Load toolbar nodes on mount
  useEffect(() => {
    async function loadNodes() {
      setNodesLoading(true)
      try {
        const res = await apiFetch<ApiResponse<PaginatedResponse<BackendNode>>>('/nodes/?page=1&limit=100')
        setAvailableNodes(res.data.items)
      } catch {
        // silently fail — toolbar is non-critical
      } finally {
        setNodesLoading(false)
      }
    }
    loadNodes()
  }, [])

  // Keep latestSave ref pointing to the current handleSave closure
  useEffect(() => {
    latestSave.current = handleSave
  })

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!archId) return
    const timer = setInterval(async () => {
      if (!isDirty.current) return
      isDirty.current = false
      setSaveStatus('saving')
      try {
        await latestSave.current(true)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('dirty')
      }
    }, 10000)
    return () => clearInterval(timer)
  }, [archId])

  // Measure header height so panels start below it
  useLayoutEffect(() => {
    if (!headerRef.current) return
    const measure = () => setHeaderHeight(headerRef.current!.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(headerRef.current)
    return () => ro.disconnect()
  }, [])

  // --- Simulation ---

  function guessTrafficUnit(label: string): string {
    const l = label.toLowerCase()
    if (/cache|redis|memcache/.test(l)) return 'Ops/s'
    if (/queue|kafka|sqs|rabbit|pubsub|mqtt/.test(l)) return 'msg/s'
    if (/db|database|rds|sql|postgres|mysql|mongo/.test(l)) return 'QPS'
    return 'RPS'
  }

  async function handleGenerateForScenario(scenarioId: string) {
    if (nodes.filter((n) => n.type === 'archNode').length === 0) {
      message.warning('Add some nodes to the canvas first')
      return
    }
    setScenarios((prev) => prev.map((s) => s.id === scenarioId ? { ...s, generating: true } : s))
    try {
      const res = await apiFetch<ApiResponse<ScenarioResponse>>(
        `/archs/${archId}/scenarios/${scenarioId}/generate`,
        { method: 'POST' },
      )
      const updated = fromScenarioResponse(res.data)
      setScenarios((prev) => prev.map((s) => s.id === scenarioId ? updated : s))
      if (activeScenarioId === scenarioId && updated.simResult) {
        setActiveScenarioIdx(1)
        setEntryTraffic(updated.simResult.scenarios[1].entry_traffic)
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to generate simulation')
      setScenarios((prev) => prev.map((s) => s.id === scenarioId ? { ...s, generating: false } : s))
    }
  }


  const currentScenarioNodes = useMemo(() => {
    if (!activeItem?.simResult) return []
    const base = activeItem.simResult.scenarios[activeScenarioIdx]
    const scale = base.entry_traffic > 0 ? entryTraffic / base.entry_traffic : 0
    return base.nodes.map((n) => {
      const override = activeItem.overrides[n.canvas_node_id]
      const capacity = Math.max(1, override?.capacity ?? n.capacity)
      const metric = override?.metric ?? n.metric
      const baseCapacity = Math.max(1, n.capacity)
      const capacityScale = baseCapacity / capacity
      const utilization = Math.min(999, Math.round(n.utilization * scale * capacityScale))
      return { ...n, capacity, metric, utilization }
    })
  }, [activeItem, activeScenarioIdx, entryTraffic])

  useEffect(() => {
    if (mode !== 'simulate' || !activeItem?.simResult || currentScenarioNodes.length === 0) {
      setNodes((nds) => nds.map((n) => {
        const data = { ...(n.data as Record<string, unknown>) }
        delete data.utilization
        delete data.simMode
        delete data.simReason
        return { ...n, data }
      }))
      setEdges((eds) => eds.map((e) => ({ ...e, type: undefined })))
      return
    }

    // Update node utilization overlays
    const uMap      = new Map(currentScenarioNodes.map((n) => [n.canvas_node_id, n.utilization]))
    const reasonMap = new Map(currentScenarioNodes.map((n) => [n.canvas_node_id, n.reason ?? '']))
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, utilization: uMap.get(n.id), simReason: reasonMap.get(n.id) ?? '', simMode: true },
    })))

    // Animate edges: BFS from entry point to find the reachable path, then assign
    // per-edge animation speed. Edges ON the path get speed based on source node
    // utilization (high load → faster dashes). Edges OFF the path still animate
    // but at a slow default so traffic clearly appears to originate from the entry.
    // BFS runs inside the setEdges callback to access latest edge list without
    // adding `edges` as a dependency (which would create an infinite loop).
    const entryNodeId = activeItem.entry_point?.node_id

    setEdges((eds) => {
      const reachable = new Set<string>()
      if (entryNodeId) {
        const visited = new Set<string>([entryNodeId])
        const queue = [entryNodeId]
        while (queue.length) {
          const nodeId = queue.shift()!
          for (const e of eds) {
            if (e.source === nodeId) {
              reachable.add(e.id)
              if (!visited.has(e.target)) {
                visited.add(e.target)
                queue.push(e.target)
              }
            }
          }
        }
      }

      return eds.map((e) => {
        const onPath = !entryNodeId || reachable.has(e.id)
        const sourceUtil = uMap.get(e.source) ?? 0
        // On-path: speed scales with source node utilization (high util → fast dashes)
        // Off-path: slow ambient animation so all edges still move
        const animDur = onPath ? Math.max(0.3, 2 - (sourceUtil / 100) * 1.8) : 2.5
        return {
          ...e,
          type: 'animatedEdge',
          data: { ...(e.data as object), animDur },
        }
      })
    })
  }, [mode, activeItem, currentScenarioNodes])

  // Override helpers
  function startEditOverride(nodeId: string, capacity: number, metric: string) {
    setEditingNodeOverride(nodeId)
    setOverrideValues({ capacity: String(capacity), metric })
  }

  async function saveOverride(nodeId: string) {
    const cap = parseFloat(overrideValues.capacity)
    if (isNaN(cap) || cap <= 0 || !activeScenarioId) { setEditingNodeOverride(null); return }
    const newOverrides = {
      ...(activeItem?.overrides ?? {}),
      [nodeId]: { capacity: cap, metric: overrideValues.metric.trim() || undefined },
    }
    // optimistic update
    setScenarios((prev) => prev.map((s) => s.id === activeScenarioId ? { ...s, overrides: newOverrides } : s))
    setEditingNodeOverride(null)
    try {
      const payload: UpdateScenarioPayload = { overrides: newOverrides }
      await apiFetch<ApiResponse<ScenarioResponse>>(`/archs/${archId}/scenarios/${activeScenarioId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to save override')
    }
  }

  async function clearOverride(nodeId: string) {
    if (!activeScenarioId) return
    const newOverrides = { ...(activeItem?.overrides ?? {}) }
    delete newOverrides[nodeId]
    // optimistic update
    setScenarios((prev) => prev.map((s) => s.id === activeScenarioId ? { ...s, overrides: newOverrides } : s))
    setEditingNodeOverride(null)
    try {
      const payload: UpdateScenarioPayload = { overrides: newOverrides }
      await apiFetch<ApiResponse<ScenarioResponse>>(`/archs/${archId}/scenarios/${activeScenarioId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to clear override')
    }
  }

  function handleDeleteScenario(scenarioId: string) {
    const scenario = scenarios.find((s) => s.id === scenarioId)
    Modal.confirm({
      title: 'Delete scenario?',
      content: scenario ? `"${scenario.name}" and its simulation data will be permanently removed.` : 'This scenario will be permanently removed.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setScenarios((prev) => prev.filter((s) => s.id !== scenarioId))
        if (activeScenarioId === scenarioId) setActiveScenarioId(null)
        try {
          await apiFetch(`/archs/${archId}/scenarios/${scenarioId}`, { method: 'DELETE' })
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : 'Failed to delete scenario')
        }
      },
    })
  }

  function handleOpenEditScenario(scenario: ScenarioItem) {
    setEditingScenarioId(scenario.id)
    editScenarioForm.setFieldsValue({
      name: scenario.name,
      description: scenario.description,
      entry_node_id: scenario.entry_point?.node_id ?? undefined,
      traffic_unit: scenario.entry_point?.traffic_unit ?? 'RPS',
    })
    setEditScenarioOpen(true)
  }

  async function handleSaveEditScenario(values: Record<string, string>) {
    if (!editingScenarioId) return
    const entryNode = nodes.find((n) => n.id === values.entry_node_id)
    const entryLabel = entryNode
      ? ((entryNode.data as Record<string, string>).custom_label || (entryNode.data as Record<string, string>).label)
      : ''
    const payload: UpdateScenarioPayload = {
      name: values.name.trim(),
      description: values.description?.trim() || '',
      entry_point: values.entry_node_id
        ? { node_id: values.entry_node_id, traffic_unit: values.traffic_unit?.trim() || guessTrafficUnit(entryLabel) }
        : null,
    }
    try {
      const res = await apiFetch<ApiResponse<ScenarioResponse>>(`/archs/${archId}/scenarios/${editingScenarioId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setScenarios((prev) => prev.map((s) => s.id === editingScenarioId ? { ...fromScenarioResponse(res.data), generating: s.generating } : s))
      setEditScenarioOpen(false)
      setEditingScenarioId(null)
      editScenarioForm.resetFields()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to update scenario')
    }
  }

  // Save architecture
  async function handleSave(silent = false) {
    if (!archId) return
    setSaving(true)
    if (!silent) setSaveStatus('saving')
    try {
      const archNodes: ArchNodeSchema[] = nodes.map((n) => ({
        id: n.id,
        label: (n.data as Record<string, string>).label || '',
        custom_label: (n.data as Record<string, string>).custom_label || undefined,
        icon: (n.data as Record<string, string>).icon || '',
        description: (n.data as Record<string, string>).description || '',
        provider: (n.data as Record<string, string>).provider || '',
        position: { x: n.position.x, y: n.position.y },
        node_type: n.type || 'archNode',
        configs: (n.data as Record<string, unknown>).configs as Record<string, string>[] | undefined,
        parent_id: n.parentId || undefined,
        ...(n.type === 'groupNode' ? { width: n.measured?.width ?? 400, height: n.measured?.height ?? 250 } : {}),
      }))
      const archEdges: EdgeSchema[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle || undefined,
        target_handle: e.targetHandle || undefined,
        label: (e.data as Record<string, string>)?.label || (e.label as string) || '',
        description: (e.data as Record<string, string>)?.description || '',
      }))
      await apiFetch(`/archs/${archId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nodes: archNodes, edges: archEdges }),
      })
      isDirty.current = false
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      if (!silent) message.success('Architecture saved')
    } catch (err: unknown) {
      setSaveStatus('dirty')
      if (!silent) message.error(err instanceof Error ? err.message : 'Failed to save architecture')
    } finally {
      setSaving(false)
    }
  }

  const onConnect: OnConnect = useCallback((connection) => {
    setPendingConnection(connection)
    setEdgeModalOpen(true)
  }, [])

  function handleEdgeConfirm() {
    edgeForm.validateFields().then((values) => {
      if (pendingConnection) {
        isDirty.current = true
        setSaveStatus('dirty')
        setEdges((eds) =>
          addEdge({ ...pendingConnection, label: values.label || '', data: { label: values.label, description: values.description } }, eds)
        )
      }
      setEdgeModalOpen(false)
      setPendingConnection(null)
      edgeForm.resetFields()
    })
  }

  function handleEdgeCancel() {
    setEdgeModalOpen(false)
    setPendingConnection(null)
    edgeForm.resetFields()
  }

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, draggedNode: Node) => {
      const getAbsolutePosition = (node: Node): { x: number; y: number } => {
        let x = node.position.x
        let y = node.position.y
        let current = node
        while (current.parentId) {
          const parent = nodes.find((n) => n.id === current.parentId)
          if (!parent) break
          x += parent.position.x
          y += parent.position.y
          current = parent
        }
        return { x, y }
      }

      const isDescendant = (ancestorId: string, nodeId: string): boolean => {
        let current = nodes.find((n) => n.id === nodeId)
        while (current?.parentId) {
          if (current.parentId === ancestorId) return true
          current = nodes.find((n) => n.id === current!.parentId)
        }
        return false
      }

      const groupNodes = nodes.filter(
        (n) => n.type === 'groupNode' && n.id !== draggedNode.id && !isDescendant(draggedNode.id, n.id)
      )
      const draggedAbs = getAbsolutePosition(draggedNode)
      let targetGroup: Node | null = null
      let targetArea = Infinity

      for (const group of groupNodes) {
        const gw = group.measured?.width || (group.style?.width as number) || 400
        const gh = group.measured?.height || (group.style?.height as number) || 250
        const groupAbs = getAbsolutePosition(group)
        if (
          draggedAbs.x >= groupAbs.x && draggedAbs.x <= groupAbs.x + gw &&
          draggedAbs.y >= groupAbs.y && draggedAbs.y <= groupAbs.y + gh
        ) {
          const area = gw * gh
          if (area < targetArea) { targetGroup = group; targetArea = area }
        }
      }

      if (targetGroup && draggedNode.parentId !== targetGroup.id) {
        const targetAbs = getAbsolutePosition(targetGroup)
        setNodes((nds) =>
          nds.map((n) =>
            n.id === draggedNode.id
              ? { ...n, parentId: targetGroup!.id, extent: 'parent' as const, position: { x: draggedAbs.x - targetAbs.x, y: draggedAbs.y - targetAbs.y } }
              : n
          )
        )
      } else if (!targetGroup && draggedNode.parentId) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === draggedNode.id
              ? { ...n, parentId: undefined, extent: undefined, position: { x: draggedAbs.x, y: draggedAbs.y } }
              : n
          )
        )
      }
    },
    [nodes, setNodes],
  )

  useEffect(() => {
    function handleNodeUpdate(e: Event) {
      const detail = (e as CustomEvent).detail
      const { id, ...updates } = detail
      isDirty.current = true
      setSaveStatus('dirty')
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...updates } } : n)))
    }
    window.addEventListener('arch-node-update', handleNodeUpdate)
    return () => window.removeEventListener('arch-node-update', handleNodeUpdate)
  }, [setNodes])

  useEffect(() => {
    function handleNodeDelete(e: Event) {
      const { id: nodeId } = (e as CustomEvent).detail
      isDirty.current = true
      setSaveStatus('dirty')
      setNodes((nds) => nds.filter((n) => n.id !== nodeId && n.parentId !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    }
    window.addEventListener('arch-node-delete', handleNodeDelete)
    return () => window.removeEventListener('arch-node-delete', handleNodeDelete)
  }, [setNodes, setEdges])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatOpen])

  const handleMouseDown = useCallback(() => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isResizing.current) return
      const newWidth = window.innerWidth - e.clientX
      setChatWidth(Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, newWidth)))
    }
    function handleMouseUp() {
      if (isResizing.current) {
        isResizing.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  function handleSend() {
    if (!input.trim() || loading || !archId) return
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    const question = input.trim()
    setInput('')
    setLoading(true)
    apiFetch<ApiResponse<{ id: string; question: string; answer: string; created_at: string }>>(`/archs/${archId}/chats`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    })
      .then((res) => {
        const reply: ChatMessage = {
          id: res.data.id || `ai-${Date.now()}`,
          role: 'assistant',
          content: res.data.answer,
          timestamp: res.data.created_at || new Date().toISOString(),
        }
        setMessages((prev) => [...prev, reply])
      })
      .catch((err: unknown) => message.error(err instanceof Error ? err.message : 'Failed to get response'))
      .finally(() => setLoading(false))
  }

  function handleAddNode(backendNode: BackendNode) {
    const viewport = reactFlowInstance.getViewport()
    const position = {
      x: (window.innerWidth / 2 - viewport.x) / viewport.zoom + (Math.random() - 0.5) * 80,
      y: (window.innerHeight / 2 - viewport.y) / viewport.zoom + (Math.random() - 0.5) * 80,
    }
    addNodeToCanvas(backendNode, position)
  }

  function handleToolbarDragStart(e: React.DragEvent, backendNode: BackendNode) {
    e.dataTransfer.setData('application/arch-node', JSON.stringify(backendNode))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData('application/arch-node')
      if (!raw) return
      const backendNode: BackendNode = JSON.parse(raw)
      const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNodeToCanvas(backendNode, position)
    },
    [reactFlowInstance],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  function addNodeToCanvas(backendNode: BackendNode, position: { x: number; y: number }) {
    isDirty.current = true
    setSaveStatus('dirty')
    const id = `node-${Date.now()}`
    const isGroup = backendNode.node_type === 'group'
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: isGroup ? 'groupNode' : 'archNode',
        position,
        ...(isGroup ? { style: { width: 400, height: 250 } } : {}),
        data: {
          label: backendNode.label,
          icon: backendNode.icon,
          description: backendNode.description,
          provider: backendNode.provider,
          configs: backendNode.configs,
        },
      },
    ])
  }

  const filteredToolbarNodes = availableNodes.filter((n) =>
    n.label.toLowerCase().includes(toolbarSearch.toLowerCase()) ||
    n.provider.toLowerCase().includes(toolbarSearch.toLowerCase())
  )

  return (
    <div className="relative h-screen overflow-hidden">
      {mode === 'simulate' && (
        <style>{`@keyframes trafficFlow { to { stroke-dashoffset: -22; } }`}</style>
      )}
      <div className="h-full flex flex-col">
        {/* Top bar */}
        <div ref={headerRef} className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200 shrink-0">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/archs')} size="small" />

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">{archName}</span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
                saveStatus === 'dirty'  ? 'bg-red-500' :
                saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' :
                saveStatus === 'saved'  ? 'bg-green-500' :
                'bg-transparent'
              }`}
            />
            {saveStatus === 'saved' && (
              <span className="text-xs text-slate-400">Auto-saved</span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                onClick={() => { setMode('design'); setSimOpen(false) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${mode === 'design' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Design
              </button>
              <button
                onClick={() => { setMode('simulate'); setSimOpen(true); setChatOpen(false) }}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${mode === 'simulate' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ThunderboltOutlined className="text-[10px]" />
                Simulate
              </button>
            </div>

            <Button
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => {
                const reactFlowEl = document.querySelector('.react-flow') as HTMLElement
                if (!reactFlowEl) return
                const nodesBounds = getNodesBounds(nodes)
                const padding = 80
                const imageWidth = nodesBounds.width + padding * 2
                const imageHeight = nodesBounds.height + padding * 2
                const transform = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.5, 2, padding)
                toPng(reactFlowEl, {
                  backgroundColor: '#ffffff',
                  width: imageWidth * 3,
                  height: imageHeight * 3,
                  pixelRatio: 3,
                  style: {
                    width: `${imageWidth}px`,
                    height: `${imageHeight}px`,
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
                  },
                  filter: (node) => {
                    if (node?.classList?.contains('react-flow__minimap')) return false
                    if (node?.classList?.contains('react-flow__controls')) return false
                    if (node?.classList?.contains('react-flow__panel')) return false
                    return true
                  },
                })
                  .then((dataUrl) => {
                    const a = document.createElement('a')
                    a.setAttribute('download', `${archName || 'architecture'}.png`)
                    a.setAttribute('href', dataUrl)
                    a.click()
                  })
                  .catch(() => message.error('Failed to export image'))
              }}
            >
              Export PNG
            </Button>
            <Button type="primary" icon={<SaveOutlined />} size="small" onClick={() => handleSave()} loading={saving}>
              Save
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{ selectable: true, zIndex: 1 }}
            fitView
            fitViewOptions={{ maxZoom: 0.75 }}
          >
            <Background />
            <MiniMap pannable zoomable position="bottom-left" />
          </ReactFlow>

          {/* Node toolbar — bottom-center */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3 mr-1">
                <SearchOutlined className="text-slate-400 text-xs" />
                <input
                  type="text"
                  value={toolbarSearch}
                  onChange={(e) => setToolbarSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-20 text-xs text-slate-700 bg-transparent outline-none placeholder:text-slate-400"
                />
              </div>

              {nodesLoading ? (
                <div className="flex items-center justify-center px-3 py-0.5">
                  <Spin size="small" />
                </div>
              ) : filteredToolbarNodes.length === 0 ? (
                <span className="text-xs text-slate-400 px-2">No nodes</span>
              ) : (
                <div className="flex items-center gap-0.5 max-w-150 overflow-x-auto scrollbar-hide">
                  {filteredToolbarNodes.map((node) => (
                    <div
                      key={node.id}
                      draggable
                      onDragStart={(e) => handleToolbarDragStart(e, node)}
                      onClick={() => handleAddNode(node)}
                      title={`${node.label}${node.provider ? ` · ${node.provider}` : ''}\nClick to add · Drag to place`}
                      className="p-1.5 rounded-lg hover:bg-indigo-50 cursor-grab active:cursor-grabbing transition-colors select-none shrink-0"
                    >
                      <img
                        src={node.icon}
                        alt={node.label}
                        className="w-5 h-5 object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edge details modal */}
      <Modal
        title="Describe this connection"
        open={edgeModalOpen}
        onOk={handleEdgeConfirm}
        onCancel={handleEdgeCancel}
        okText="Add Edge"
        width={400}
        destroyOnClose
      >
        <p className="text-xs text-slate-500 mb-3">
          What does this connection represent? This helps the AI analyst understand your architecture better.
        </p>
        <Form form={edgeForm} layout="vertical">
          <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Please provide a short label' }]}>
            <Input placeholder="e.g. REST API, gRPC, Event Stream" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="e.g. Sends user authentication tokens, Publishes order events..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Scenario modal */}
      <Modal
        title="New Scenario"
        open={addScenarioOpen}
        onCancel={() => { setAddScenarioOpen(false); addScenarioForm.resetFields() }}
        onOk={() => {
          addScenarioForm.validateFields().then(async (values) => {
            const entryNode = nodes.find((n) => n.id === values.entry_node_id)
            const entryLabel = entryNode
              ? ((entryNode.data as Record<string, string>).custom_label || (entryNode.data as Record<string, string>).label)
              : ''
            const payload: CreateScenarioPayload = {
              name: values.name.trim(),
              description: values.description?.trim() || '',
              entry_point: values.entry_node_id
                ? { node_id: values.entry_node_id, traffic_unit: values.traffic_unit?.trim() || guessTrafficUnit(entryLabel) }
                : null,
            }
            try {
              const res = await apiFetch<ApiResponse<ScenarioResponse>>(`/archs/${archId}/scenarios`, {
                method: 'POST',
                body: JSON.stringify(payload),
              })
              setScenarios((prev) => [...prev, fromScenarioResponse(res.data)])
              setAddScenarioOpen(false)
              addScenarioForm.resetFields()
            } catch (err: unknown) {
              message.error(err instanceof Error ? err.message : 'Failed to create scenario')
            }
          })
        }}
        okText="Create"
        width={440}
        destroyOnHidden
      >
        <p className="text-xs text-slate-500 mb-4">
          Define the scenario context. The AI will generate Best / Mid / Worst load simulations for each architecture component.
        </p>
        <Form form={addScenarioForm} layout="vertical">
          <Form.Item name="name" label="Scenario Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="e.g. Black Friday, Normal Load, IoT Storm" autoFocus />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={2}
              placeholder="e.g. 10x traffic spike for 6 hours, all regions active, cache warm..."
            />
          </Form.Item>
          <div className="flex gap-3">
            <Form.Item
              name="entry_node_id"
              label="Entry Point Node"
              className="flex-1"
              rules={[{ required: true, message: 'Select the node where traffic enters' }]}
            >
              <Select
                placeholder="Select entry node…"
                onChange={(nodeId: string) => {
                  const n = nodes.find((nd) => nd.id === nodeId)
                  if (n) {
                    const label = (n.data as Record<string, string>).custom_label || (n.data as Record<string, string>).label
                    addScenarioForm.setFieldValue('traffic_unit', guessTrafficUnit(label))
                  }
                }}
                options={nodes
                  .filter((n) => n.type === 'archNode')
                  .map((n) => ({
                    value: n.id,
                    label: (n.data as Record<string, string>).custom_label || (n.data as Record<string, string>).label,
                  }))}
              />
            </Form.Item>
            <Form.Item name="traffic_unit" label="Traffic Unit" style={{ width: 110 }}>
              <Select
                placeholder="Unit"
                options={[
                  { value: 'RPS', label: 'RPS' },
                  { value: 'QPS', label: 'QPS' },
                  { value: 'msg/s', label: 'msg/s' },
                  { value: 'Ops/s', label: 'Ops/s' },
                  { value: 'req/s', label: 'req/s' },
                ]}
              />
            </Form.Item>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">
            The node where external traffic first enters your architecture.
          </p>
        </Form>
      </Modal>

      {/* Edit Scenario modal */}
      <Modal
        title="Edit Scenario"
        open={editScenarioOpen}
        onCancel={() => { setEditScenarioOpen(false); setEditingScenarioId(null); editScenarioForm.resetFields() }}
        onOk={() => editScenarioForm.validateFields().then(handleSaveEditScenario)}
        okText="Save"
        width={440}
        destroyOnHidden
      >
        <Form form={editScenarioForm} layout="vertical" className="mt-4">
          <Form.Item name="name" label="Scenario Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="e.g. Black Friday, Normal Load, IoT Storm" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="e.g. 10x traffic spike for 6 hours, all regions active..." />
          </Form.Item>
          <div className="flex gap-3">
            <Form.Item name="entry_node_id" label="Entry Point Node" className="flex-1">
              <Select
                placeholder="Select entry node…"
                allowClear
                onChange={(nodeId: string) => {
                  if (nodeId) {
                    const n = nodes.find((nd) => nd.id === nodeId)
                    if (n) {
                      const label = (n.data as Record<string, string>).custom_label || (n.data as Record<string, string>).label
                      editScenarioForm.setFieldValue('traffic_unit', guessTrafficUnit(label))
                    }
                  }
                }}
                options={nodes.filter((n) => n.type === 'archNode').map((n) => ({
                  value: n.id,
                  label: (n.data as Record<string, string>).custom_label || (n.data as Record<string, string>).label,
                }))}
              />
            </Form.Item>
            <Form.Item name="traffic_unit" label="Traffic Unit" style={{ width: 110 }}>
              <Select
                placeholder="Unit"
                options={[
                  { value: 'RPS', label: 'RPS' },
                  { value: 'QPS', label: 'QPS' },
                  { value: 'msg/s', label: 'msg/s' },
                  { value: 'Ops/s', label: 'Ops/s' },
                  { value: 'req/s', label: 'req/s' },
                ]}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Floating AI Agent toggle — design mode only */}
      {!chatOpen && mode === 'design' && (
        <button
          onClick={() => setChatOpen(true)}
          className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-linear-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all cursor-pointer z-5"
        >
          <RobotOutlined style={{ color: 'white' }} className="text-white text-lg" />
        </button>
      )}

      {/* Floating Simulate toggle — simulate mode only */}
      {!simOpen && mode === 'simulate' && (
        <button
          onClick={() => setSimOpen(true)}
          className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-linear-to-br from-violet-600 to-violet-500 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all cursor-pointer z-5"
        >
          <ThunderboltOutlined style={{ color: 'white' }} className="text-white text-lg" />
        </button>
      )}

      {/* ═══════════════ Simulate Panel ═══════════════ */}
      {simOpen && mode === 'simulate' && (
        <div
          className="absolute right-0 bottom-0 bg-white border-l border-slate-200 shadow-xl flex flex-col z-40"
          style={{ top: headerHeight, width: SIM_PANEL_WIDTH }}
        >
          {/* ── LIST VIEW ── */}
          {activeScenarioId === null && (
            <>
              {/* Header */}
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-linear-to-br from-violet-600 to-violet-500 flex items-center justify-center shadow-sm">
                    <ThunderboltOutlined style={{ color: 'white' }} className="text-[11px]" />
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Capability Simulator</p>
                </div>
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setSimOpen(false)} className="text-slate-400 hover:text-slate-600" />
              </div>

              {/* Add button */}
              <div className="px-3 py-2.5 border-b border-slate-100 shrink-0">
                <button
                  onClick={() => setAddScenarioOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <PlusOutlined />
                  Add Scenario
                </button>
              </div>

              {/* Scenarios list */}
              <div className="flex-1 overflow-y-auto">
                {scenariosLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Spin size="small" />
                  </div>
                ) : scenarios.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-3">
                      <ThunderboltOutlined className="text-violet-400 text-xl" />
                    </div>
                    <p className="text-xs font-medium text-slate-700 mb-1">No scenarios yet</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Add a scenario to start simulating load on your architecture components.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {scenarios.map((scenario) => (
                      <div
                        key={scenario.id}
                        onClick={() => setActiveScenarioId(scenario.id)}
                        className="group relative rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm bg-white cursor-pointer transition-all p-3"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-xs font-semibold text-slate-800 leading-tight flex-1 min-w-0 truncate">{scenario.name}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenEditScenario(scenario) }}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                              title="Edit scenario"
                            >
                              <EditOutlined className="text-[10px]" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteScenario(scenario.id) }}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                              title="Delete scenario"
                            >
                              <DeleteOutlined className="text-[10px]" />
                            </button>
                            {scenario.simResult ? (
                              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                Generated
                              </span>
                            ) : scenario.generating ? (
                              <span className="text-[10px] font-medium text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                                Running…
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                                Not run
                              </span>
                            )}
                          </div>
                        </div>
                        {scenario.description && (
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-1">{scenario.description}</p>
                        )}
                        {scenario.entry_point && (() => {
                          const entryNode = nodes.find((n) => n.id === scenario.entry_point!.node_id)
                          const entryLabel = entryNode
                            ? ((entryNode.data as Record<string, string>).custom_label || (entryNode.data as Record<string, string>).label)
                            : scenario.entry_point.node_id
                          return (
                            <p className="text-[10px] text-violet-600 mb-1">
                              ⤷ Entry: <span className="font-medium">{entryLabel}</span>
                              <span className="text-slate-400 ml-1">({scenario.entry_point.traffic_unit})</span>
                            </p>
                          )
                        })()}
                        <div className="mt-1.5 flex items-center justify-between">
                          {scenario.simResult ? (
                            <div className="flex gap-1">
                              {(['Best', 'Mid', 'Worst'] as const).map((name, idx) => {
                                const overloadedCount = scenario.simResult!.scenarios[idx].nodes.filter((n) => n.utilization >= 100).length
                                return (
                                  <span
                                    key={name}
                                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                                      idx === 0 ? 'text-emerald-700 bg-emerald-50' :
                                      idx === 1 ? 'text-amber-700 bg-amber-50' :
                                      'text-red-700 bg-red-50'
                                    }`}
                                  >
                                    {name}{overloadedCount > 0 ? ` · ${overloadedCount}⚠` : ''}
                                  </span>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">Click to open & generate</span>
                          )}
                          <span className="text-[10px] text-violet-500 group-hover:text-violet-700 font-medium transition-colors">
                            Open →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── DETAIL VIEW ── */}
          {activeScenarioId !== null && activeItem && (
            <>
              {/* Header */}
              <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setActiveScenarioId(null); setEditingNodeOverride(null) }}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeftOutlined className="text-xs" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{activeItem.name}</p>
                  {activeItem.description && (
                    <p className="text-[10px] text-slate-400 truncate leading-tight">{activeItem.description}</p>
                  )}
                </div>
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setSimOpen(false)} className="text-slate-400 hover:text-slate-600 shrink-0" />
              </div>

              {/* Generate button + entry point info */}
              <div className="px-3 py-2 border-b border-slate-100 shrink-0">
                {activeItem.entry_point && (() => {
                  const entryNode = nodes.find((n) => n.id === activeItem.entry_point!.node_id)
                  const entryLabel = entryNode
                    ? ((entryNode.data as Record<string, string>).custom_label || (entryNode.data as Record<string, string>).label)
                    : activeItem.entry_point.node_id
                  return (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md bg-violet-50 border border-violet-100">
                      <span className="text-[10px] text-violet-500 font-medium shrink-0">Entry</span>
                      <span className="text-[10px] text-violet-800 font-semibold truncate">{entryLabel}</span>
                      <span className="text-[10px] text-violet-400 shrink-0 ml-auto">{activeItem.entry_point.traffic_unit}</span>
                    </div>
                  )
                })()}
                <button
                  onClick={() => handleGenerateForScenario(activeItem.id)}
                  disabled={activeItem.generating}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ThunderboltOutlined className={activeItem.generating ? 'animate-pulse' : ''} />
                  {activeItem.generating ? 'Analysing architecture…' : activeItem.simResult ? 'Regenerate with AI' : 'Generate with AI'}
                </button>
              </div>

              {/* Empty / generating state */}
              {!activeItem.simResult && !activeItem.generating && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center mb-2">
                    <ThunderboltOutlined className="text-violet-400 text-base" />
                  </div>
                  <p className="text-xs font-medium text-slate-700 mb-0.5">No simulation yet</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Click "Generate with AI" to analyse your architecture for this scenario.
                  </p>
                </div>
              )}

              {/* Scenario content */}
              {activeItem.simResult && (
                <div className="flex-1 overflow-y-auto">
                  {/* Best / Mid / Worst tabs */}
                  <div className="px-3 pt-2 pb-1.5">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">Load Level</p>
                    <div className="flex gap-1">
                      {(['Best', 'Mid', 'Worst'] as const).map((name, idx) => (
                        <button
                          key={name}
                          onClick={() => {
                            setActiveScenarioIdx(idx as 0 | 1 | 2)
                            setEntryTraffic(activeItem.simResult!.scenarios[idx].entry_traffic)
                            setEditingNodeOverride(null)
                          }}
                          className={`flex-1 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                            activeScenarioIdx === idx
                              ? idx === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : idx === 1 ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Entry traffic slider */}
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Entry Traffic</p>
                      <span className="text-sm font-semibold text-slate-800">
                        {entryTraffic.toLocaleString()}
                        <span className="text-[10px] font-normal text-slate-500 ml-1">
                          {activeItem.entry_point?.traffic_unit ?? currentScenarioNodes[0]?.metric ?? 'RPS'}
                        </span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={activeItem.simResult.scenarios[2].entry_traffic * 2}
                      value={entryTraffic}
                      onChange={(e) => setEntryTraffic(Number(e.target.value))}
                      className="w-full accent-violet-600"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                      <span>0</span>
                      <span>{(activeItem.simResult.scenarios[2].entry_traffic * 2).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Node breakdown */}
                  <div className="px-3 py-2">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Node Breakdown
                      <span className="ml-1 normal-case font-normal text-slate-400">· edit to override</span>
                    </p>
                    <div className="space-y-1.5">
                      {currentScenarioNodes.map((node) => {
                        const hasOverride = !!activeItem.overrides[node.canvas_node_id]
                        const isEditing = editingNodeOverride === node.canvas_node_id
                        const status = node.utilization >= 100 ? 'critical' : node.utilization >= 70 ? 'warning' : 'healthy'
                        const barColor = status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        const textColor = status === 'critical' ? 'text-red-600' : status === 'warning' ? 'text-amber-600' : 'text-emerald-600'

                        return (
                          <div key={node.canvas_node_id} className="rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5">
                            {/* Row: icon + label + util% + edit */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <img
                                src={node.icon} alt={node.label}
                                className="w-4 h-4 object-contain shrink-0"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                              />
                              <span className="text-xs text-slate-700 flex-1 truncate font-medium">{node.label}</span>
                              {hasOverride && (
                                <span className="text-[9px] text-violet-600 bg-violet-50 border border-violet-200 px-1 rounded shrink-0">
                                  overridden
                                </span>
                              )}
                              <span className={`text-xs font-semibold shrink-0 ${textColor}`}>{node.utilization}%</span>
                              <button
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingNodeOverride(null)
                                  } else {
                                    startEditOverride(node.canvas_node_id, node.capacity, node.metric)
                                  }
                                }}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                                title="Override values"
                              >
                                <EditOutlined className="text-[10px]" />
                              </button>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1 bg-slate-200 rounded-full overflow-hidden mb-0.5">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                style={{ width: `${Math.min(100, node.utilization)}%` }}
                              />
                            </div>

                            <div className="flex justify-between text-[9px] text-slate-400">
                              <span>{status === 'critical' ? 'Overloaded' : status === 'warning' ? 'Under pressure' : 'Healthy'}</span>
                              <span>{node.capacity.toLocaleString()} {node.metric}</span>
                            </div>

                            {/* Inline override form */}
                            {isEditing && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                                <p className="text-[10px] text-slate-500 mb-1 font-medium">Override capacity</p>
                                <div className="flex gap-1 mb-1.5">
                                  <input
                                    type="number"
                                    value={overrideValues.capacity}
                                    onChange={(e) => setOverrideValues((v) => ({ ...v, capacity: e.target.value }))}
                                    placeholder="Capacity"
                                    className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md border border-slate-300 focus:outline-none focus:border-violet-400 bg-white"
                                  />
                                  <input
                                    type="text"
                                    value={overrideValues.metric}
                                    onChange={(e) => setOverrideValues((v) => ({ ...v, metric: e.target.value }))}
                                    placeholder="Metric"
                                    className="w-16 text-xs px-2 py-1 rounded-md border border-slate-300 focus:outline-none focus:border-violet-400 bg-white"
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => saveOverride(node.canvas_node_id)}
                                    className="flex-1 flex items-center justify-center gap-1 py-0.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-medium transition-colors cursor-pointer"
                                  >
                                    <CheckOutlined className="text-[10px]" />
                                    Save
                                  </button>
                                  {hasOverride && (
                                    <button
                                      onClick={() => { clearOverride(node.canvas_node_id); setEditingNodeOverride(null) }}
                                      className="px-2 py-0.5 rounded-md border border-slate-300 hover:bg-slate-100 text-[11px] text-slate-600 transition-colors cursor-pointer"
                                    >
                                      Reset
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setEditingNodeOverride(null)}
                                    className="px-2 py-0.5 rounded-md border border-slate-300 hover:bg-slate-100 text-[11px] text-slate-600 transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Resizable Chat Panel */}
      {chatOpen && (
        <div className="absolute right-0 bottom-0 flex z-40" style={{ top: headerHeight, width: chatWidth }}>
          <div
            onMouseDown={handleMouseDown}
            className="w-1.5 h-full cursor-col-resize bg-slate-200 hover:bg-indigo-400 transition-colors shrink-0"
          />
          <div className="flex-1 flex flex-col bg-white border-l border-slate-200 shadow-xl min-w-0">
            {/* Chat header */}
            <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-linear-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-sm">
                  <RobotOutlined style={{ color: 'white' }} className="text-white text-[11px]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-slate-900">Arch Analyst</p>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                </div>
              </div>
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-slate-600" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.role === 'assistant' ? (
                    <div className="w-5 h-5 rounded-md bg-linear-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                      <RobotOutlined style={{ color: 'white' }} className="text-white text-[9px]" />
                    </div>
                  ) : (
                    <Avatar size={20} icon={<UserOutlined />} className="bg-slate-700 shrink-0 mt-0.5" />
                  )}
                  <div
                    className={`max-w-[82%] text-xs leading-relaxed overflow-hidden ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white px-2.5 py-1.5 rounded-xl rounded-tr-sm'
                        : 'bg-white text-slate-700 px-2.5 py-1.5 rounded-xl rounded-tl-sm shadow-sm border border-slate-100'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-xs prose-slate max-w-none overflow-x-auto prose-headings:mt-1.5 prose-headings:mb-1 prose-headings:text-xs prose-p:my-0.5 prose-p:text-xs prose-ul:my-0.5 prose-ul:text-xs prose-li:my-0 prose-strong:text-slate-800 prose-code:text-[10px] prose-code:break-all prose-pre:overflow-x-auto prose-pre:max-w-full prose-pre:text-[10px] prose-table:text-[10px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-md bg-linear-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                    <RobotOutlined style={{ color: 'white' }} className="text-white text-[9px]" />
                  </div>
                  <div className="bg-white px-3 py-2 rounded-xl rounded-tl-sm shadow-sm border border-slate-100">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-2.5 py-2 border-t border-slate-200 bg-white">
              <div className="flex items-end gap-1.5 bg-slate-50 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <Input.TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Ask about your architecture…"
                  disabled={loading}
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  variant="borderless"
                  className="flex-1 bg-transparent! p-0! shadow-none! resize-none text-xs"
                />
                <Button
                  type="primary"
                  shape="circle"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
