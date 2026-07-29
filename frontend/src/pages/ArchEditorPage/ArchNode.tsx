import { memo, useState, useMemo } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import { Modal, Descriptions, Button, Input, Dropdown, Space, Tooltip } from 'antd'
import { InfoCircleOutlined, SettingOutlined, PlusOutlined, DeleteOutlined, SearchOutlined, EditOutlined, BgColorsOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

// ─── Color palette ────────────────────────────────────────────────────────────
export const COLOR_THEMES: Record<string, { bg: string; border: string; labelBg: string; labelText: string; dot: string }> = {
  default: { bg: '#ffffff',   border: '#000000', labelBg: '#f8f8f8',   labelText: '#1e293b', dot: '#000000' },
  blue:    { bg: '#eff6ff',   border: '#3b82f6', labelBg: '#dbeafe',   labelText: '#1e40af', dot: '#2563eb' },
  green:   { bg: '#f0fdf4',   border: '#22c55e', labelBg: '#dcfce7',   labelText: '#166534', dot: '#16a34a' },
  purple:  { bg: '#faf5ff',   border: '#a855f7', labelBg: '#f3e8ff',   labelText: '#6b21a8', dot: '#9333ea' },
  orange:  { bg: '#fff7ed',   border: '#f97316', labelBg: '#ffedd5',   labelText: '#9a3412', dot: '#ea580c' },
  rose:    { bg: '#fff1f2',   border: '#f43f5e', labelBg: '#ffe4e6',   labelText: '#9f1239', dot: '#e11d48' },
  yellow:  { bg: '#fefce8',   border: '#eab308', labelBg: '#fef9c3',   labelText: '#713f12', dot: '#ca8a04' },
  slate:   { bg: '#f8fafc',   border: '#64748b', labelBg: '#e2e8f0',   labelText: '#0f172a', dot: '#475569' },
}

const FONT_SIZES = [
  { label: 'S',  value: 13 },
  { label: 'M',  value: 15 },
  { label: 'L',  value: 18 },
  { label: 'XL', value: 22 },
]

export interface ArchNodeData {
  label: string
  custom_label?: string
  icon: string
  description: string
  provider: string
  configs?: Record<string, string>[]
  color_theme?: string
  font_size?: number
  simMode?: boolean
  utilization?: number
  simReason?: string
  [key: string]: unknown
}

function ArchNode({ data, id, selected }: NodeProps) {
  const nodeData = data as ArchNodeData
  const [hovered, setHovered] = useState(false)
  const showHandles = hovered || !!selected
  const [editingLabel, setEditingLabel] = useState(false)
  const [customLabelValue, setCustomLabelValue] = useState('')
  const [infoOpen, setInfoOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [configs, setConfigs] = useState<{ key: string; value: string }[]>([])
  const [configSearch, setConfigSearch] = useState('')
  const [styleOpen, setStyleOpen] = useState(false)

  const theme = COLOR_THEMES[nodeData.color_theme || 'default'] ?? COLOR_THEMES.default
  const fontSize = nodeData.font_size ?? 15

  function handleConfigOpen() {
    const existing = (nodeData.configs || []).map((c) => {
      const entries = Object.entries(c)
      return entries.length > 0 ? { key: entries[0][0], value: String(entries[0][1]) } : { key: '', value: '' }
    })
    setConfigs(existing.length > 0 ? existing : [{ key: '', value: '' }])
    setConfigSearch('')
    setConfigOpen(true)
  }

  const filteredConfigIndices = useMemo(() => {
    if (!configSearch.trim()) return configs.map((_, i) => i)
    const term = configSearch.toLowerCase()
    return configs.reduce<number[]>((acc, c, i) => {
      if (c.key.toLowerCase().includes(term) || c.value.toLowerCase().includes(term)) acc.push(i)
      return acc
    }, [])
  }, [configs, configSearch])

  function handleAddConfig() {
    setConfigs((prev) => [...prev, { key: '', value: '' }])
  }

  function handleRemoveConfig(index: number) {
    setConfigs((prev) => prev.filter((_, i) => i !== index))
  }

  function handleConfigChange(index: number, field: 'key' | 'value', val: string) {
    setConfigs((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)))
  }

  function handleConfigSave() {
    const validConfigs = configs
      .filter((c) => c.key.trim() !== '')
      .map((c) => ({ [c.key.trim()]: c.value.trim() }))
    window.dispatchEvent(new CustomEvent('arch-node-update', { detail: { id, configs: validConfigs } }))
    setConfigOpen(false)
  }

  function applyColorTheme(key: string) {
    window.dispatchEvent(new CustomEvent('arch-node-update', { detail: { id, color_theme: key } }))
  }

  function applyFontSize(size: number) {
    window.dispatchEvent(new CustomEvent('arch-node-update', { detail: { id, font_size: size } }))
  }

  const borderStyle = nodeData.simMode && nodeData.utilization !== undefined
    ? nodeData.utilization >= 100
      ? { border: '2px solid #f87171', boxShadow: '0 0 0 4px #fee2e2' }
      : nodeData.utilization >= 70
        ? { border: '2px solid #fbbf24', boxShadow: '0 0 0 4px #fef3c7' }
        : { border: '2px solid #34d399', boxShadow: '0 0 0 4px #d1fae5' }
    : selected
      ? { border: `2px solid #6366f1`, boxShadow: '0 0 0 3px #e0e7ff', background: theme.bg }
      : { border: `1.5px solid ${theme.border}`, background: theme.bg }

  const handleDotColor = nodeData.simMode ? undefined : theme.dot

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={110}
        minHeight={90}
        lineClassName="!border-black/30"
        handleClassName="!w-4 !h-4 !bg-black !border-white !border-2 !rounded-sm"
      />
      <div
        className="relative w-full h-full flex flex-col items-center justify-center transition-all rounded-md overflow-hidden"
        style={borderStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Simulation utilization badge */}
        {nodeData.simMode && nodeData.utilization !== undefined && (
          <Tooltip
            title={nodeData.simReason || undefined}
            placement="top"
            overlayStyle={{ maxWidth: 300 }}
            overlayInnerStyle={{ fontSize: 11, lineHeight: '1.5' }}
          >
            <div className={`absolute -top-2.5 -left-2.5 min-w-10.5 text-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-sm z-10 cursor-help ${
              nodeData.utilization >= 100 ? 'bg-red-500' :
              nodeData.utilization >= 70  ? 'bg-amber-500' :
              'bg-emerald-500'
            }`}>
              {nodeData.utilization}%
            </div>
          </Tooltip>
        )}

        {/* Settings menu */}
        <Dropdown
          menu={{
            items: [
              { key: 'rename',    icon: <EditOutlined />,        label: 'Rename' },
              { key: 'details',   icon: <InfoCircleOutlined />,   label: 'Details' },
              { key: 'configure', icon: <SettingOutlined />,      label: 'Configure' },
              { key: 'style',     icon: <BgColorsOutlined />,     label: 'Style' },
              { type: 'divider' },
              { key: 'delete',    icon: <DeleteOutlined />,       label: 'Delete', danger: true },
            ] as MenuProps['items'],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation()
              if (key === 'rename') { setCustomLabelValue(nodeData.custom_label || ''); setEditingLabel(true) }
              else if (key === 'details') setInfoOpen(true)
              else if (key === 'configure') handleConfigOpen()
              else if (key === 'style') setStyleOpen(true)
              else if (key === 'delete') window.dispatchEvent(new CustomEvent('arch-node-delete', { detail: { id } }))
            },
          }}
          trigger={['click']}
          placement="topRight"
        >
          <button
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 text-slate-600 hover:text-slate-900 transition-all cursor-pointer z-10 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <SettingOutlined className="text-sm" />
          </button>
        </Dropdown>

        {/* Handles */}
        <Handle type="source" position={Position.Top}    id="top-source"    style={{ background: handleDotColor }} className={`w-4! h-4! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Top}    id="top-target"    style={{ background: handleDotColor }} className={`w-4! h-4! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ background: handleDotColor }} className={`w-4! h-4! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ background: handleDotColor }} className={`w-4! h-4! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Left}   id="left-source"   style={{ background: handleDotColor }} className={`w-4! h-4! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Left}   id="left-target"   style={{ background: handleDotColor }} className={`w-4! h-4! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Right}  id="right-source"  style={{ background: handleDotColor }} className={`w-4! h-4! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Right}  id="right-target"  style={{ background: handleDotColor }} className={`w-4! h-4! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />

        {/* Node content */}
        {nodeData.icon ? (
          <>
            <div className="w-full flex items-center justify-center pt-7 pb-3 px-4">
              <img
                src={nodeData.icon}
                alt={nodeData.label}
                className="w-12 h-12 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/48x48?text=N' }}
              />
            </div>
            <div className="w-full px-2 py-3" style={{ backgroundColor: theme.labelBg, borderTop: `1px solid ${theme.border}30` }}>
              <p className="font-medium text-center leading-tight line-clamp-2" style={{ fontSize, color: theme.labelText }}>
                {nodeData.custom_label || nodeData.label}
              </p>
            </div>
          </>
        ) : (
          <div className="w-full flex items-center justify-center px-3 py-4">
            <p className="font-semibold text-center leading-snug line-clamp-3" style={{ fontSize, color: theme.labelText }}>
              {nodeData.custom_label || nodeData.label}
            </p>
          </div>
        )}
      </div>

      {/* Style panel modal */}
      <Modal
        title="Node Style"
        open={styleOpen}
        onCancel={() => setStyleOpen(false)}
        footer={<Button onClick={() => setStyleOpen(false)}>Done</Button>}
        width={340}
        destroyOnHidden
      >
        <div className="mt-4 space-y-5">
          {/* Color themes */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COLOR_THEMES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => applyColorTheme(key)}
                  title={key.charAt(0).toUpperCase() + key.slice(1)}
                  className="w-8 h-8 rounded-full border-2 transition-all cursor-pointer"
                  style={{
                    background: t.bg,
                    borderColor: (nodeData.color_theme || 'default') === key ? t.dot : t.border,
                    boxShadow: (nodeData.color_theme || 'default') === key ? `0 0 0 2px ${t.dot}` : 'none',
                    outline: 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Font Size</p>
            <div className="flex gap-2">
              {FONT_SIZES.map((fs) => (
                <button
                  key={fs.value}
                  onClick={() => applyFontSize(fs.value)}
                  className="px-3 py-1.5 rounded border text-xs font-medium transition-all cursor-pointer"
                  style={{
                    borderColor: fontSize === fs.value ? theme.border : '#e2e8f0',
                    background: fontSize === fs.value ? theme.bg : '#fff',
                    color: fontSize === fs.value ? theme.labelText : '#64748b',
                    fontWeight: fontSize === fs.value ? 600 : 400,
                  }}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Info Modal */}
      <Modal
        title={nodeData.label}
        open={infoOpen}
        onCancel={() => setInfoOpen(false)}
        footer={<Button onClick={() => setInfoOpen(false)}>Close</Button>}
        width={400}
      >
        <div className="flex items-center gap-3 mb-4">
          {nodeData.icon && (
            <img
              src={nodeData.icon}
              alt={nodeData.label}
              className="w-10 h-10 rounded object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/40x40?text=N' }}
            />
          )}
          <div>
            <p className="font-medium text-slate-800">{nodeData.label}</p>
            <p className="text-xs text-slate-500">{nodeData.provider}</p>
          </div>
        </div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Description">{nodeData.description}</Descriptions.Item>
          <Descriptions.Item label="Provider">{nodeData.provider}</Descriptions.Item>
          {nodeData.configs?.map((config, idx) =>
            Object.entries(config).map(([key, value]) => (
              <Descriptions.Item key={`${idx}-${key}`} label={key}>{value}</Descriptions.Item>
            ))
          )}
        </Descriptions>
      </Modal>

      {/* Config Modal */}
      <Modal
        title={`Configure: ${nodeData.label}`}
        open={configOpen}
        onCancel={() => setConfigOpen(false)}
        onOk={handleConfigSave}
        okText="Save Configs"
        width={480}
      >
        <p className="text-xs text-slate-500 mb-3">
          Add key-value configuration pairs for this node. These will be stored with the architecture.
        </p>
        {configs.length > 8 && (
          <Input
            placeholder="Search configs by key or value..."
            prefix={<SearchOutlined className="text-slate-400" />}
            allowClear
            value={configSearch}
            onChange={(e) => setConfigSearch(e.target.value)}
            className="mb-3"
          />
        )}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {filteredConfigIndices.map((index) => {
            const config = configs[index]
            return (
              <Space key={index} className="w-full" align="start">
                <Input
                  placeholder="Key (e.g. instance_type)"
                  value={config.key}
                  onChange={(e) => handleConfigChange(index, 'key', e.target.value)}
                  className="w-44"
                />
                <Input
                  placeholder="Value (e.g. t3.medium)"
                  value={config.value}
                  onChange={(e) => handleConfigChange(index, 'value', e.target.value)}
                  className="w-52"
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemoveConfig(index)}
                  disabled={configs.length === 1 && !config.key && !config.value}
                />
              </Space>
            )
          })}
        </div>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddConfig}
          className="mt-3 w-full"
        >
          Add Config
        </Button>
      </Modal>

      {/* Rename Modal */}
      <Modal
        title="Set Custom Label"
        open={editingLabel}
        onCancel={() => setEditingLabel(false)}
        onOk={() => {
          window.dispatchEvent(new CustomEvent('arch-node-update', { detail: { id, custom_label: customLabelValue.trim() || undefined } }))
          setEditingLabel(false)
        }}
        okText="Save"
        width={360}
        destroyOnHidden
      >
        <p className="text-xs text-slate-500 mb-3">
          Give this node a meaningful name in the context of your architecture (e.g. "Auth Service", "User DB").
        </p>
        <Input
          placeholder="e.g. Auth Service"
          value={customLabelValue}
          onChange={(e) => setCustomLabelValue(e.target.value)}
          onPressEnter={() => {
            window.dispatchEvent(new CustomEvent('arch-node-update', { detail: { id, custom_label: customLabelValue.trim() || undefined } }))
            setEditingLabel(false)
          }}
          autoFocus
        />
        <p className="text-[11px] text-slate-400 mt-2">Technical name: {nodeData.label}</p>
      </Modal>
    </>
  )
}

export default memo(ArchNode)
