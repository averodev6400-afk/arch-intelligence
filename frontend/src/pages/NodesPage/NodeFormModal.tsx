import { useEffect, useState } from 'react'
import { Modal, Form, Input, Upload, Select, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { Node, CreateNodePayload, UpdateNodePayload, ApiResponse } from '@/types'
import { apiFetch } from '@/utils/api'

interface Props {
  open: boolean
  node: Node | null
  onClose: (refresh?: boolean) => void
}

export default function NodeFormModal({ open, node, onClose }: Props) {
  const [form] = Form.useForm()
  const [iconUrl, setIconUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const isEdit = !!node

  useEffect(() => {
    if (open) {
      if (node) {
        form.setFieldsValue({ label: node.label, description: node.description, provider: node.provider, node_type: node.node_type || 'standard' })
        setIconUrl(node.icon || '')
      } else {
        form.resetFields()
        setIconUrl('')
      }
    }
  }, [open, node, form])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/v1/upload/icon', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data: ApiResponse<{ url: string }> = await res.json()
      setIconUrl(data.data.url)
      message.success('Icon uploaded')
    } catch {
      message.error('Failed to upload icon')
    } finally {
      setUploading(false)
    }
    return false // prevent antd default upload
  }

  async function handleSubmit() {
    try {
      const values = await form.validateFields()

      if (isEdit) {
        const payload: UpdateNodePayload = { ...values, ...(iconUrl ? { icon: iconUrl } : {}) }
        await apiFetch<ApiResponse<Node>>(`/nodes/${node!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        message.success('Node updated successfully')
      } else {
        const payload: CreateNodePayload = { ...values, ...(iconUrl ? { icon: iconUrl } : {}) }
        await apiFetch<ApiResponse<Node>>('/nodes/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        message.success('Node created successfully')
      }

      onClose(true)
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message)
      }
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Node' : 'Add Node'}
      open={open}
      onCancel={() => onClose()}
      onOk={handleSubmit}
      okText={isEdit ? 'Update' : 'Create'}
      confirmLoading={uploading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item label="Icon"  extra="Optional — if not set, the node name will be shown instead">
          <div className="flex items-center gap-4">
            {iconUrl && (
              <img
                src={iconUrl}
                alt="icon preview"
                className="w-12 h-12 rounded-lg object-contain border border-slate-200"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/48x48?text=N' }}
              />
            )}
            <Upload
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              showUploadList={false}
              beforeUpload={(file) => { handleUpload(file); return false }}
            >
              <button
                type="button"
                className="w-12 h-12 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:border-indigo-400 transition-colors cursor-pointer"
              >
                <PlusOutlined className="text-slate-400" />
              </button>
            </Upload>
            <span className="text-xs text-slate-400">PNG, JPG, WebP, SVG, GIF (max 2MB)</span>
          </div>
        </Form.Item>
        <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Please enter a label' }]}>
          <Input placeholder="e.g. PostgreSQL" />
        </Form.Item>
        <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Please enter a description' }]}>
          <Input.TextArea rows={3} placeholder="Brief description of the node" />
        </Form.Item>
        <Form.Item name="provider" label="Provider" rules={[{ required: true, message: 'Please enter a provider' }]}>
          <Input placeholder="e.g. AWS, GCP, Self-hosted" />
        </Form.Item>
        <Form.Item name="node_type" label="Node Type" initialValue="standard" rules={[{ required: true, message: 'Please select a node type' }]}>
          <Select
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'group', label: 'Group (Container)' },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
