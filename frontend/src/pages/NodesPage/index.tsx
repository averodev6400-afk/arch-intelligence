import { useEffect, useState, useCallback, useRef } from 'react'
import { Table, Typography, Button, Space, Popconfirm, Input, message } from 'antd'
import { EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import type { Node, ApiResponse, PaginatedResponse } from '@/types'
import { apiFetch } from '@/utils/api'
import NodeFormModal from './NodeFormModal'

const { Title } = Typography

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<Node | null>(null)

  const fetchNodes = useCallback(async (page = pagination.current, limit = pagination.pageSize, searchTerm = search) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (searchTerm) params.set('search', searchTerm)
      const res = await apiFetch<ApiResponse<PaginatedResponse<Node>>>(`/nodes/?${params}`)
      setNodes(res.data.items)
      setPagination((prev) => ({ ...prev, current: res.data.page, total: res.data.total }))
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to fetch nodes')
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, search])

  useEffect(() => {
    fetchNodes()
  }, [])

  async function handleDelete(nodeId: string) {
    try {
      await apiFetch(`/nodes/${nodeId}`, { method: 'DELETE' })
      message.success('Node deleted successfully')
      fetchNodes()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to delete node')
    }
  }

  function handleEdit(node: Node) {
    setEditingNode(node)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditingNode(null)
    setModalOpen(true)
  }

  function handleModalClose(refresh?: boolean) {
    setModalOpen(false)
    setEditingNode(null)
    if (refresh) fetchNodes()
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchNodes(1, pagination.pageSize, value)
    }, 400)
  }

  const columns: ColumnType<Node>[] = [
    {
      title: 'Icon',
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (icon: string) => (
        <img
          src={icon}
          alt="node icon"
          className="w-8 h-8 rounded object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/32x32?text=N'
          }}
        />
      ),
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      width: 150,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      width: 130,
    },
    {
      title: 'Type',
      dataIndex: 'node_type',
      key: 'node_type',
      width: 110,
      render: (value: string) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${value === 'group' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
          {value === 'group' ? 'Group' : 'Standard'}
        </span>
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (value: string) => value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="Delete this node?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <Title level={3} className="!mb-1">Nodes</Title>
          <span className="text-sm text-slate-500">Manage and monitor all system nodes</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Node
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by label, description, or provider..."
          allowClear
          prefix={<SearchOutlined className="text-slate-400" />}
          value={search}
          onChange={handleSearchChange}
          className="max-w-md"
        />
      </div>

      <Table<Node>
        rowKey="id"
        dataSource={nodes}
        columns={columns}
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} nodes`,
          position: ['bottomRight'],
          onChange: (page, pageSize) => {
            setPagination((prev) => ({ ...prev, current: page, pageSize }))
            fetchNodes(page, pageSize)
          },
        }}
        className="bg-white rounded-xl shadow-sm [&_.ant-pagination]{justify-end}"
      />

      <NodeFormModal
        open={modalOpen}
        node={editingNode}
        onClose={handleModalClose}
      />
    </div>
  )
}
