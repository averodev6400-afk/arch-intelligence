import { useEffect, useState, useCallback } from 'react'
import { Typography, Card, Row, Col, Button, Spin, Empty, Modal, Form, Input, Dropdown, message } from 'antd'
import { PlusOutlined, NodeIndexOutlined, MoreOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { Arch, ApiResponse, PaginatedResponse } from '@/types'
import { apiFetch } from '@/utils/api'

const { Title, Text, Paragraph } = Typography
const { confirm } = Modal

export default function ArchsListPage() {
  const navigate = useNavigate()
  const [archs, setArchs] = useState<Arch[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingArch, setEditingArch] = useState<Arch | null>(null)
  const [form] = Form.useForm()

  const fetchArchs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<ApiResponse<PaginatedResponse<Arch>>>('/archs/?page=1&limit=50')
      setArchs(res.data.items)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to fetch architectures')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArchs()
  }, [])

  async function handleCreate() {
    try {
      const values = await form.validateFields()
      setCreating(true)
      if (editingArch) {
        await apiFetch<ApiResponse<Arch>>(`/archs/${editingArch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: values.name, description: values.description }),
        })
        message.success('Architecture updated successfully')
        setModalOpen(false)
        setEditingArch(null)
        form.resetFields()
        fetchArchs()
      } else {
        const res = await apiFetch<ApiResponse<Arch>>('/archs/', {
          method: 'POST',
          body: JSON.stringify({ name: values.name, description: values.description }),
        })
        message.success('Architecture created successfully')
        setModalOpen(false)
        form.resetFields()
        navigate(`/archs/${res.data.id}`)
      }
    } catch (err: unknown) {
      if (err instanceof Error) message.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  function handleEdit(arch: Arch) {
    setEditingArch(arch)
    form.setFieldsValue({ name: arch.name, description: arch.description })
    setModalOpen(true)
  }

  function handleDelete(arch: Arch) {
    confirm({
      title: `Delete "${arch.name}"?`,
      icon: <ExclamationCircleOutlined />,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await apiFetch(`/archs/${arch.id}`, { method: 'DELETE' })
          message.success('Architecture deleted successfully')
          fetchArchs()
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : 'Failed to delete architecture')
        }
      },
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Title level={3} className="!mb-1">Architectures</Title>
          <Text className="text-slate-500 text-sm">Select an architecture to open the editor and AI analysis</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          New Architecture
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : archs.length === 0 ? (
        <Empty description="No architectures found" className="py-20" />
      ) : (
        <Row gutter={[16, 16]}>
          {archs.map((arch) => (
            <Col key={arch.id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                hoverable
                onClick={() => navigate(`/archs/${arch.id}`)}
                className="h-full border-slate-200 hover:border-indigo-300 transition-all hover:shadow-md !p-0"
                styles={{ body: { padding: 16 } }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-sm">
                    <NodeIndexOutlined className="text-white text-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Text strong className="text-sm text-slate-900 block truncate">{arch.name}</Text>
                    <Paragraph className="!mb-0 text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {arch.description}
                    </Paragraph>
                  </div>
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'edit', icon: <EditOutlined />, label: 'Edit' },
                        { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true },
                      ],
                      onClick: ({ key, domEvent }) => {
                        domEvent.stopPropagation()
                        if (key === 'edit') handleEdit(arch)
                        if (key === 'delete') handleDelete(arch)
                      },
                    }}
                    trigger={['click']}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      className="shrink-0 text-slate-400 hover:text-slate-600"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Dropdown>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2.5 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <NodeIndexOutlined className="text-[10px]" />
                    {arch.nodes.length} nodes · {arch.edges.length} edges
                  </span>
                  <span>{new Date(arch.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title={editingArch ? 'Edit Architecture' : 'New Architecture'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingArch(null); form.resetFields() }}
        onOk={handleCreate}
        okText={editingArch ? 'Update' : 'Create'}
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter an architecture name' }]}>
            <Input placeholder="e.g. Microservices v2" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Please enter a description' }]}>
            <Input.TextArea rows={3} placeholder="Brief description of the architecture" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
