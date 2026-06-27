import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Input, Button, Avatar, Popover, Spin, Modal, Form, message } from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  SearchOutlined,
  SaveOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import type { ChatMessage, Node as BackendNode, ApiResponse, PaginatedResponse, Arch, ArchNodeSchema, EdgeSchema } from '@/types'
import { apiFetch } from '@/utils/api'
import ArchNode from './ArchNode'
import GroupNode from './GroupNode'

const nodeTypes = { archNode: ArchNode, groupNode: GroupNode }

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      "Hi! I'm your architecture analyst. Draw your system on the canvas and ask me anything — failure scenarios, bottlenecks, scalability, or security concerns. I'll analyse your topology in real-time.",
    timestamp: new Date().toISOString(),
  },
]

const MIN_CHAT_WIDTH = 320
const MAX_CHAT_WIDTH = 700
const DEFAULT_CHAT_WIDTH = 420

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
  const [chatWidth, setChatWidth] = useState(MAX_CHAT_WIDTH)
  const [nodePickerOpen, setNodePickerOpen] = useState(false)
  const [availableNodes, setAvailableNodes] = useState<BackendNode[]>([])
  const [nodesLoading, setNodesLoading] = useState(false)
  const [nodeSearch, setNodeSearch] = useState('')
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  const [edgeModalOpen, setEdgeModalOpen] = useState(false)
  const [edgeForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [archName, setArchName] = useState('')
  const isResizing = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const reactFlowInstance = useReactFlow()

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])

  // Load architecture on mount
  useEffect(() => {
    if (!archId) return
    async function loadArch() {
      try {
        const res = await apiFetch<ApiResponse<Arch>>(`/archs/${archId}`)
        const arch = res.data
        setArchName(arch.name)

        // Convert backend nodes to ReactFlow nodes
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
          // Sort so parent nodes come before children (ReactFlow requirement)
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
              // Circular or broken refs — push remaining as-is
              sorted.push(...remaining)
              break
            }
          }
          setNodes(sorted)
        }

        // Convert backend edges to ReactFlow edges
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
          // Items come newest-first from API, reverse to show oldest first
          const chatMessages: ChatMessage[] = []
          for (const item of [...res.data.items].reverse()) {
            chatMessages.push({
              id: `user-${item.id}`,
              role: 'user',
              content: item.question,
              timestamp: item.created_at,
            })
            chatMessages.push({
              id: item.id,
              role: 'assistant',
              content: item.answer,
              timestamp: item.created_at,
            })
          }
          setMessages([...initialMessages, ...chatMessages])
        }
      } catch {
        // Silently fail — chat history is non-critical
      }
    }
    loadChats()
  }, [archId])

  // Save architecture
  async function handleSave() {
    if (!archId) return
    setSaving(true)
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
        ...(n.type === 'groupNode' ? { width: n.measured?.width || n.style?.width || 400, height: n.measured?.height || n.style?.height || 250 } : {}),
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
      message.success('Architecture saved')
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to save architecture')
    } finally {
      setSaving(false)
    }
  }

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setPendingConnection(connection)
      setEdgeModalOpen(true)
    },
    [],
  )

  function handleEdgeConfirm() {
    edgeForm.validateFields().then((values) => {
      if (pendingConnection) {
        setEdges((eds) =>
          addEdge(
            {
              ...pendingConnection,
              label: values.label || '',
              data: { label: values.label, description: values.description },
            },
            eds,
          ),
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

  // Drag-into-group detection: when a node is dropped inside a group, reparent it
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      // Helper: compute absolute position by walking up parent chain
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

      // Helper: check if nodeId is a descendant of ancestorId (prevent circular nesting)
      const isDescendant = (ancestorId: string, nodeId: string): boolean => {
        let current = nodes.find((n) => n.id === nodeId)
        while (current?.parentId) {
          if (current.parentId === ancestorId) return true
          current = nodes.find((n) => n.id === current!.parentId)
        }
        return false
      }

      // Get candidate group nodes (exclude self, exclude descendants of dragged node)
      const groupNodes = nodes.filter(
        (n) => n.type === 'groupNode' && n.id !== draggedNode.id && !isDescendant(draggedNode.id, n.id)
      )

      const draggedAbs = getAbsolutePosition(draggedNode)

      // Find all groups the node is inside, then pick the smallest (innermost)
      let targetGroup: Node | null = null
      let targetArea = Infinity
      for (const group of groupNodes) {
        const gw = (group.measured?.width || (group.style?.width as number) || 400)
        const gh = (group.measured?.height || (group.style?.height as number) || 250)
        const groupAbs = getAbsolutePosition(group)

        if (
          draggedAbs.x >= groupAbs.x &&
          draggedAbs.x <= groupAbs.x + gw &&
          draggedAbs.y >= groupAbs.y &&
          draggedAbs.y <= groupAbs.y + gh
        ) {
          const area = gw * gh
          if (area < targetArea) {
            targetGroup = group
            targetArea = area
          }
        }
      }

      if (targetGroup && draggedNode.parentId !== targetGroup.id) {
        // Compute position relative to new parent
        const targetAbs = getAbsolutePosition(targetGroup)
        const relX = draggedAbs.x - targetAbs.x
        const relY = draggedAbs.y - targetAbs.y

        setNodes((nds) =>
          nds.map((n) =>
            n.id === draggedNode.id
              ? { ...n, parentId: targetGroup!.id, extent: 'parent' as const, position: { x: relX, y: relY } }
              : n
          )
        )
      } else if (!targetGroup && draggedNode.parentId) {
        // Dropped outside all groups — unparent
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

  // Listen for node config/label updates from custom node component
  useEffect(() => {
    function handleNodeUpdate(e: Event) {
      const detail = (e as CustomEvent).detail
      const { id, ...updates } = detail
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...updates } } : n))
      )
    }
    window.addEventListener('arch-node-update', handleNodeUpdate)
    return () => window.removeEventListener('arch-node-update', handleNodeUpdate)
  }, [setNodes])

  // Listen for node delete events from custom node components
  useEffect(() => {
    function handleNodeDelete(e: Event) {
      const { id: nodeId } = (e as CustomEvent).detail
      setNodes((nds) => nds.filter((n) => n.id !== nodeId && n.parentId !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    }
    window.addEventListener('arch-node-delete', handleNodeDelete)
    return () => window.removeEventListener('arch-node-delete', handleNodeDelete)
  }, [setNodes, setEdges])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatOpen])

  // Resize handlers
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

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

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
      .catch((err: unknown) => {
        message.error(err instanceof Error ? err.message : 'Failed to get response')
      })
      .finally(() => setLoading(false))
  }

  async function fetchAvailableNodes() {
    setNodesLoading(true)
    try {
      const res = await apiFetch<ApiResponse<PaginatedResponse<BackendNode>>>('/nodes/?page=1&limit=100')
      setAvailableNodes(res.data.items)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to fetch nodes')
    } finally {
      setNodesLoading(false)
    }
  }

  function handleNodePickerOpen(open: boolean) {
    setNodePickerOpen(open)
    if (open) {
      fetchAvailableNodes()
      setNodeSearch('')
    }
  }

  function handleDropNode(backendNode: BackendNode) {
    const viewport = reactFlowInstance.getViewport()
    const position = {
      x: (window.innerWidth / 2 - viewport.x) / viewport.zoom + (Math.random() - 0.5) * 100,
      y: (window.innerHeight / 2 - viewport.y) / viewport.zoom + (Math.random() - 0.5) * 100,
    }
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
    setNodePickerOpen(false)
  }

  const filteredNodes = availableNodes.filter((n) =>
    n.label.toLowerCase().includes(nodeSearch.toLowerCase()) ||
    n.provider.toLowerCase().includes(nodeSearch.toLowerCase())
  )

  const nodePickerContent = (
    <div className="w-64">
      <Input
        prefix={<SearchOutlined className="text-slate-400" />}
        placeholder="Search nodes..."
        size="small"
        value={nodeSearch}
        onChange={(e) => setNodeSearch(e.target.value)}
        className="mb-2"
        allowClear
      />
      {nodesLoading ? (
        <div className="flex justify-center py-4"><Spin size="small" /></div>
      ) : filteredNodes.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">No nodes found</p>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filteredNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => handleDropNode(node)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors"
            >
              <img
                src={node.icon}
                alt={node.label}
                className="w-6 h-6 rounded object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/24x24?text=N' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 font-medium truncate leading-tight">{node.label}</p>
                <p className="text-[11px] text-slate-400 truncate leading-tight">{node.provider}</p>
              </div>
              {node.node_type === 'group' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 font-medium shrink-0">Group</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="relative h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Full-width ReactFlow canvas */}
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/archs')}
            size="small"
          />
          <span className="text-sm font-medium text-slate-600">{archName || 'Back to Architectures'}</span>
          <div className="ml-auto flex items-center gap-2">
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
                    // Exclude minimap and controls from export
                    if (node?.classList?.contains('react-flow__minimap')) return false
                    if (node?.classList?.contains('react-flow__controls')) return false
                    if (node?.classList?.contains('react-flow__panel')) return false
                    return true
                  },
                }).then((dataUrl) => {
                  const a = document.createElement('a')
                  a.setAttribute('download', `${archName || 'architecture'}.png`)
                  a.setAttribute('href', dataUrl)
                  a.click()
                }).catch(() => message.error('Failed to export image'))
              }}
            >
              Export PNG
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              size="small"
              onClick={handleSave}
              loading={saving}
            >
              Save
            </Button>
          </div>
        </div>
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{ selectable: true, zIndex: 1 }}
            fitView
          >
            <Background />
            <MiniMap pannable zoomable position="bottom-left" />
            <Panel position="top-right">
              <Popover
                content={nodePickerContent}
                title="Add Node"
                trigger="click"
                open={nodePickerOpen}
                onOpenChange={handleNodePickerOpen}
                placement="bottomRight"
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                >
                  Add Node
                </Button>
              </Popover>
            </Panel>
          </ReactFlow>
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

      {/* Floating AI Agent toggle button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all cursor-pointer z-[5]"
        >
          <RobotOutlined style={{ color: 'white' }} className="text-white text-lg" />
        </button>
      )}

      {/* Resizable Chat Panel */}
      {chatOpen && (
        <div
          className="absolute top-0 right-0 h-full flex z-40"
          style={{ width: chatWidth }}
        >
          {/* Drag handle */}
          <div
            onMouseDown={handleMouseDown}
            className="w-1.5 h-full cursor-col-resize bg-slate-200 hover:bg-indigo-400 transition-colors shrink-0"
          />

          {/* Chat content */}
          <div className="flex-1 flex flex-col bg-white border-l border-slate-200 shadow-xl min-w-0">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-sm">
                  <RobotOutlined style={{ color: 'white' }} className="text-white text-sm" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 leading-tight">Arch Analyst</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <p className="text-xs text-slate-500 leading-tight">Ready</p>
                  </div>
                </div>
              </div>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setChatOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              />
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 bg-slate-50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.role === 'assistant' ? (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center flex-shrink-0 mt-1">
                      <RobotOutlined style={{ color: 'white' }} className="text-white text-xs" />
                    </div>
                  ) : (
                    <Avatar size={28} icon={<UserOutlined />} className="bg-slate-700 flex-shrink-0 mt-1" />
                  )}
                  <div
                    className={`max-w-[80%] text-xs leading-relaxed overflow-hidden ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white px-3 py-2 rounded-2xl rounded-tr-md'
                        : 'bg-white text-slate-700 px-3 py-2 rounded-2xl rounded-tl-md shadow-sm border border-slate-100'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-xs prose-slate max-w-none overflow-x-auto prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-xs prose-p:my-1 prose-p:text-xs prose-ul:my-1 prose-ul:text-xs prose-li:my-0.5 prose-strong:text-slate-800 prose-code:text-[10px] prose-code:break-all prose-pre:overflow-x-auto prose-pre:max-w-full prose-pre:text-[10px] prose-table:text-[10px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                    <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {new Date(msg.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <RobotOutlined style={{ color: 'white' }} className="text-white text-xs" />
                  </div>
                  <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-md shadow-sm border border-slate-100">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <div className="flex items-end gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <Input.TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Ask about your architecture…"
                  disabled={loading}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  variant="borderless"
                  className="flex-1 !bg-transparent !p-0 !shadow-none resize-none text-sm"
                />
                <Button
                  type="primary"
                  shape="circle"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="mb-0.5"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Shift + Enter for new line · Enter to send
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
