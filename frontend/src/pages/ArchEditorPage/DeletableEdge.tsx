import { memo, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { CloseOutlined } from '@ant-design/icons'

function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  selected, style, data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const edgeData = data as { label?: string } | undefined
  const edgeLabel = edgeData?.label

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  const showControls = hovered || !!selected

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('arch-edge-delete', { detail: { id } }))
  }

  return (
    <>
      {/* Wide transparent overlay for easy hover targeting on thin lines */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={0}
        style={{ ...style, stroke: selected ? '#6366f1' : '#000', strokeWidth: 1.5 }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 10,
          }}
          className="nodrag nopan flex items-center gap-1"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {edgeLabel && (
            <span
              className="px-2 py-0.5 text-xs rounded whitespace-nowrap select-none"
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                color: '#475569',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {edgeLabel}
            </span>
          )}
          {showControls && (
            <button
              onClick={handleDelete}
              title="Remove connection"
              className="w-4 h-4 flex items-center justify-center rounded-full transition-colors cursor-pointer"
              style={{
                background: '#fff',
                border: '1px solid #fca5a5',
                color: '#f87171',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444'
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.borderColor = '#ef4444'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff'
                e.currentTarget.style.color = '#f87171'
                e.currentTarget.style.borderColor = '#fca5a5'
              }}
            >
              <CloseOutlined style={{ fontSize: 8 }} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export default memo(DeletableEdge)
