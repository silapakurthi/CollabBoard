import { forwardRef } from "react";
import { Group, Line, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { BoardObject } from "../../hooks/useFirestore";

interface LineShapeProps {
  object: BoardObject;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onDragStart?: () => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onStartEdit: () => void;
}

export const LineShape = forwardRef<any, LineShapeProps>(
  ({ object, isSelected, isEditing, onSelect, onDragStart, onDragMove, onDragEnd, onStartEdit }, ref) => {
    const points = object.points || [0, 0, 200, 0];
    const midX = (points[0] + points[2]) / 2;
    const midY = (points[1] + points[3]) / 2;
    const labelWidth = 120;

    return (
      <Group
        ref={ref}
        x={object.x}
        y={object.y}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={onStartEdit}
        onDblTap={onStartEdit}
        onDragStart={(e) => {
          e.cancelBubble = true;
          onDragStart?.();
        }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          onDragMove?.(e);
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          onDragEnd(e);
        }}
      >
        <Line
          points={points}
          stroke={isSelected ? "#3b82f6" : object.color === "#ffffff" ? "#374151" : object.color}
          strokeWidth={3}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={12}
          strokeScaleEnabled={false}
        />
        {!isEditing && object.text && (
          <Text
            text={object.text}
            x={midX - labelWidth / 2}
            y={midY - 20}
            width={labelWidth}
            fontSize={13}
            fontFamily="sans-serif"
            fill="#374151"
            align="center"
            wrap="word"
            listening={false}
          />
        )}
      </Group>
    );
  }
);
