import { forwardRef } from "react";
import { Group, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { BoardObject } from "../../hooks/useFirestore";

interface FrameProps {
  object: BoardObject;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onStartEdit: () => void;
}

export const Frame = forwardRef<any, FrameProps>(
  (
    { object, isSelected, isEditing, onSelect, onDragStart, onDragMove, onDragEnd, onStartEdit },
    ref
  ) => {
    const title = object.text || "Frame";

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
        onDragStart={(e) => {
          e.cancelBubble = true;
          onDragStart();
        }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          onDragMove(e);
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          onDragEnd(e);
        }}
      >
        {/* Frame background */}
        <Rect
          width={object.width}
          height={object.height}
          fill="rgba(59, 130, 246, 0.04)"
          stroke={isSelected ? "#3b82f6" : "#94a3b8"}
          strokeWidth={isSelected ? 2 : 1.5}
          dash={[8, 4]}
          cornerRadius={4}
          strokeScaleEnabled={false}
        />
        {/* Title label inside top-left */}
        {!isEditing && (
          <Text
            text={title}
            x={8}
            y={8}
            fontSize={14}
            fontFamily="sans-serif"
            fontStyle="bold"
            fill="#64748b"
            listening={true}
            onDblClick={(e) => {
              e.cancelBubble = true;
              onStartEdit();
            }}
            onDblTap={(e) => {
              e.cancelBubble = true;
              onStartEdit();
            }}
          />
        )}
      </Group>
    );
  }
);
