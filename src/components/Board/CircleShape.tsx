import { forwardRef } from "react";
import { Group, Circle, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { BoardObject } from "../../hooks/useFirestore";
import { contrastText, contrastStroke } from "../../utils/color";

interface CircleShapeProps {
  object: BoardObject;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onDragStart?: () => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onStartEdit: () => void;
}

export const CircleShape = forwardRef<any, CircleShapeProps>(
  ({ object, isSelected: _isSelected, isEditing, onSelect, onDragStart, onDragMove, onDragEnd, onStartEdit }, ref) => {
    const radius = object.radius || 60;
    const diameter = radius * 2;

    return (
      <Group
        ref={ref}
        x={object.x}
        y={object.y}
        width={diameter}
        height={diameter}
        offsetX={radius}
        offsetY={radius}
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
        <Circle
          x={radius}
          y={radius}
          radius={radius}
          fill={object.color}
          stroke={contrastStroke(object.color)}
          strokeWidth={2}
          shadowColor="black"
          shadowBlur={3}
          shadowOpacity={0.1}
          shadowOffsetX={1}
          shadowOffsetY={1}
          strokeScaleEnabled={false}
        />
        {!isEditing && object.text && (
          <Text
            text={object.text}
            x={radius * 0.3}
            y={radius * 0.3}
            width={radius * 1.4}
            height={radius * 1.4}
            fontSize={14}
            fontFamily="sans-serif"
            fill={contrastText(object.color)}
            align="center"
            verticalAlign="middle"
            wrap="word"
            listening={false}
          />
        )}
      </Group>
    );
  }
);
