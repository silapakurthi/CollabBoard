import { forwardRef } from "react";
import { Group, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { BoardObject } from "../../hooks/useFirestore";

interface TextElementProps {
  object: BoardObject;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onDragStart?: () => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onStartEdit: () => void;
}

export const TextElement = forwardRef<any, TextElementProps>(
  ({ object, isSelected: _isSelected, isEditing, onSelect, onDragStart, onDragMove, onDragEnd, onStartEdit }, ref) => {
    const displayText = object.text || (isEditing ? "" : "Double-click to edit");
    const fontSize = object.fontSize || 16;

    return (
      <Group
        ref={ref}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
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
        {/* Invisible hit area matching the full bounding box */}
        <Rect
          width={object.width}
          height={object.height}
          fill="transparent"
        />
        <Text
          text={isEditing ? "" : displayText}
          fontSize={fontSize}
          fontFamily="sans-serif"
          fill={object.text ? (object.color || "#374151") : "#9ca3af"}
          width={object.width}
          wrap="word"
          listening={false}
        />
      </Group>
    );
  }
);
