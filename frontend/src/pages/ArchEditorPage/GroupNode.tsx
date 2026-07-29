import { memo, useState, useMemo } from 'react'
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react'
import { Modal, Descriptions, Button, Input, Dropdown, Space } from 'antd'
import { InfoCircleOutlined, SettingOutlined, PlusOutlined, DeleteOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

export interface GroupNodeData {
  label: string
  custom_label?: string
  icon: string
  description: string
  provider: string
  configs?: Record<string, string>[]
  [key: string]: unknown
}

function GroupNode({ data, id, selected }: NodeProps) {
  const nodeData = data as GroupNodeData
  const [hovered, setHovered] = useState(false)
  const showHandles = hovered || !!selected
  const [infoOpen, setInfoOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [configs, setConfigs] = useState<{ key: string; value: string }[]>([])
  const [configSearch, setConfigSearch] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)
  const [customLabelValue, setCustomLabelValue] = useState('')
  const configSummary = nodeData.configs?.length
    ? nodeData.configs.map((c) => Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(', ')).join(' | ')
    : ''

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

  return (
    <>
      {/* Resizer allows user to drag-resize the group container */}
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={200}
        lineClassName="!border-indigo-300"
        handleClassName="!w-4 !h-4 !bg-black !border-white !border-2 !rounded"
      />

      <div
        className={`w-full h-full bg-indigo-50/30 border-2 border-dashed rounded-md relative ${selected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-black'}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-200/60 bg-white/80 rounded-t-xl">
          {nodeData.icon && (
            <img
              src={nodeData.icon}
              alt={nodeData.label}
              className="w-6 h-6 rounded object-contain shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/24x24?text=G' }}
            />
          )}
          <div className="min-w-0 flex-1">
            {nodeData.custom_label ? (
              <>
                <p className="text-xs font-bold text-indigo-900 truncate leading-tight">{nodeData.custom_label}</p>
                <p className="text-[10px] text-slate-500 truncate leading-tight">{nodeData.label} · {nodeData.provider}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-indigo-800 truncate leading-tight">{nodeData.label}</p>
                <p className="text-[10px] text-slate-500 truncate leading-tight">{nodeData.provider}</p>
              </>
            )}
            {configSummary && (
              <p className="text-[9px] text-slate-400 truncate leading-tight mt-0.5">{configSummary}</p>
            )}
          </div>

          {/* Three-dot menu */}
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
            placement="rightTop"
          >
            <button
              onClick={(e) => e.stopPropagation()}
              className={`w-6 h-6 flex items-center justify-center rounded hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-all cursor-pointer shrink-0 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              <SettingOutlined className="text-sm" />
            </button>
          </Dropdown>
        </div>

        {/* Body — child nodes render inside here via ReactFlow's parentId system */}
        <div className="p-2" />

        {/* Connection handles — each side has both source + target */}
        <Handle type="source" position={Position.Top} id="top-source" className={`w-4! h-4! bg-black! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Top} id="top-target" className={`w-4! h-4! bg-black! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Bottom} id="bottom-source" className={`w-4! h-4! bg-black! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Bottom} id="bottom-target" className={`w-4! h-4! bg-black! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Left} id="left-source" className={`w-4! h-4! bg-black! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Left} id="left-target" className={`w-4! h-4! bg-black! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="source" position={Position.Right} id="right-source" className={`w-4! h-4! bg-black! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
        <Handle type="target" position={Position.Right} id="right-target" className={`w-4! h-4! bg-black! border-white! border-2! transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 pointer-events-none!'}`} />
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
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/40x40?text=G' }}
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
          <Descriptions.Item label="Type">Group (Container)</Descriptions.Item>
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
          Add key-value configuration pairs for this group node.
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
                  placeholder="Key (e.g. cidr_block)"
                  value={config.key}
                  onChange={(e) => handleConfigChange(index, 'key', e.target.value)}
                  className="w-44"
                />
                <Input
                  placeholder="Value (e.g. 10.0.0.0/16)"
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
          Give this group a meaningful name in the context of your architecture (e.g. "Production VPC", "Auth Subnet").
        </p>
        <Input
          placeholder="e.g. Production VPC"
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

export default memo(GroupNode)
