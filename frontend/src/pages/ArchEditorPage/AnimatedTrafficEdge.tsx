import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

function AnimatedTrafficEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  label, selected, markerEnd, style, data,
}: EdgeProps) {
  const edgeData = data as { animDur?: number } | undefined
  const animDur = edgeData?.animDur ?? 1.5

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, stroke: selected ? '#6366f1' : '#cbd5e1', strokeWidth: 2 }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="#7c3aed"
        strokeWidth={2.5}
        strokeDasharray="6 16"
        strokeLinecap="round"
        style={{
          animation: `trafficFlow ${animDur}s linear infinite`,
          opacity: 0.75,
          pointerEvents: 'none',
        }}
      />
      {label && (
        <text
          x={labelX}
          y={labelY - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 10, fill: '#64748b', fontFamily: 'inherit', pointerEvents: 'none' }}
        >
          {label as string}
        </text>
      )}
    </>
  )
}

export default memo(AnimatedTrafficEdge)
