// RelationEdge.tsx

import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-many';

export interface RelationEdgeData extends Record<string, unknown> {
  relationType?: RelationType;
  onTypeChange?: (type: RelationType) => void;
}

export default function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const relationType = (data as RelationEdgeData)?.relationType || 'one-to-many';
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate positions for the relation markers
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const unitX = dx / length;
  const unitY = dy / length;

  // Position markers near the ends
  const sourceMarkerDistance = 30;
  const targetMarkerDistance = 30;

  const sourceMarkerX = sourceX + unitX * sourceMarkerDistance;
  const sourceMarkerY = sourceY + unitY * sourceMarkerDistance;

  const targetMarkerX = targetX - unitX * targetMarkerDistance;
  const targetMarkerY = targetY - unitY * targetMarkerDistance;

  // Determine text labels based on relation type
  const sourceLabel = relationType === 'one-to-one' ? '1' : relationType === 'one-to-many' ? '1' : 'N';
  const targetLabel = relationType === 'one-to-one' ? '1' : 'N';

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#333', strokeWidth: selected ? 2 : 1 }} />
      
      {/* Source Marker */}
      <text
        x={sourceMarkerX}
        y={sourceMarkerY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: '14px', fontWeight: 'bold', fill: '#333', pointerEvents: 'none' }}
      >
        {sourceLabel}
      </text>

      {/* Target Marker */}
      <text
        x={targetMarkerX}
        y={targetMarkerY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: '14px', fontWeight: 'bold', fill: '#333', pointerEvents: 'none' }}
      >
        {targetLabel}
      </text>

      {/* Edge Label for relation type selector */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="edge-label-container"
        >
          {!isExpanded ? (
            <button
              className="relation-circle-button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
            >
              {relationType === 'one-to-one' ? '1:1' : relationType === 'one-to-many' ? '1:N' : 'N:N'}
            </button>
          ) : (
            <div className="relation-selector-expanded">
              <button
                className={`relation-option ${relationType === 'one-to-one' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  (data as RelationEdgeData)?.onTypeChange?.('one-to-one');
                  setIsExpanded(false);
                }}
              >
                1:1
              </button>
              <button
                className={`relation-option ${relationType === 'one-to-many' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  (data as RelationEdgeData)?.onTypeChange?.('one-to-many');
                  setIsExpanded(false);
                }}
              >
                1:N
              </button>
              <button
                className={`relation-option ${relationType === 'many-to-many' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  (data as RelationEdgeData)?.onTypeChange?.('many-to-many');
                  setIsExpanded(false);
                }}
              >
                N:N
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
