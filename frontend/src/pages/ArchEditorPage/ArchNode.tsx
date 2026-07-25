import { memo, useState, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Modal, Descriptions, Button, Input, Dropdown, Space, Tooltip } from 'antd'
import { InfoCircleOutlined, SettingOutlined, PlusOutlined, DeleteOutlined, SearchOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

export interface ArchNodeData {
  label: string
  custom_label?: string
  icon: string
  description: string
  provider: string
  configs?: Record<string, string>[]
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

  function handleConfigOpen() {
    // Convert stored configs to editable format
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
    // Dispatch custom event to update node configs from parent
    window.dispatchEvent(new CustomEvent('arch-node-update', { detail: { id, configs: validConfigs } }))
    setConfigOpen(false)
  }

  const simBorder = nodeData.simMode && nodeData.utilization !== undefined
    ? nodeData.utilization >= 100
      ? 'border-red-400 ring-2 ring-red-100'
      : nodeData.utilization >= 70
        ? 'border-amber-400 ring-2 ring-amber-100'
        : 'border-emerald-400 ring-2 ring-emerald-100'
    : selected
      ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-indigo-100'
      : 'border-slate-200'

  return (
    <>
      <div
        className={`relative bg-white border rounded-xl shadow-sm w-27.5 flex flex-col items-center hover:shadow-md transition-all ${simBorder}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Simulation utilization badge — top left */}
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

        {/* Three-dot menu — absolute top right */}
        <Dropdown
          menu={{
            items: [
              { key: 'rename', icon: <EditOutlined />, label: 'Rename' },
              { key: 'details', icon: <InfoCircleOutlined />, label: 'Details' },
              { key: 'configure', icon: <SettingOutlined />, label: 'Configure' },
              { type: 'divider' },
              { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true },
            ] as MenuProps['items'],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation()
              if (key === 'rename') { setCustomLabelValue(nodeData.custom_label || ''); setEditingLabel(true) }
              else if (key === 'details') setInfoOpen(true)
              else if (key === 'configure') handleConfigOpen()
              else if (key === 'delete') window.dispatchEvent(new CustomEvent('arch-node-delete', { detail: { id } }))
            },
          }}
          trigger={['click']}
          placement="bottomRight"
        >
          <button
            onClick={(e) => e.stopPropagation()}
            className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer z-10"
          >
            <MoreOutlined className="text-xs" />
          </button>
        </Dropdown>

        {/* Each side has both source + target so connections work in any direction */}
        <Handle type="source" position={Position.Top} id="top-source" className={`w-2.5! h-2.5! bg-indigo-400! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Top} id="top-target" className={`w-2.5! h-2.5! bg-indigo-400! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Bottom} id="bottom-source" className={`w-2.5! h-2.5! bg-indigo-400! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Bottom} id="bottom-target" className={`w-2.5! h-2.5! bg-indigo-400! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Left} id="left-source" className={`w-2.5! h-2.5! bg-indigo-400! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Left} id="left-target" className={`w-2.5! h-2.5! bg-indigo-400! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Right} id="right-source" className={`w-2.5! h-2.5! bg-indigo-400! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Right} id="right-target" className={`w-2.5! h-2.5! bg-indigo-400! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />

        {/* Image area */}
        {nodeData.icon ? (
          <>
            <div className="w-full flex items-center justify-center pt-5 pb-3 px-4">
              <img
                src={nodeData.icon}
                alt={nodeData.label}
                className="w-12 h-12 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/48x48?text=N' }}
              />
            </div>
            <div className="w-full border-t border-slate-100 px-2 py-1.5">
              <p className="text-[11px] font-medium text-slate-700 text-center leading-tight line-clamp-2">
                {nodeData.custom_label || nodeData.label}
              </p>
            </div>
          </>
        ) : (
          <div className="w-full flex items-center justify-center px-3 py-6">
            <p className="text-[15px] font-semibold text-slate-800 text-center leading-snug line-clamp-3">
              {nodeData.custom_label || nodeData.label}
            </p>
          </div>
        )}
      </div>

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
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
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
        destroyOnClose
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
