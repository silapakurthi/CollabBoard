import { Group, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { BoardObject } from "../../hooks/useFirestore";

interface StickyNoteProps {
  object: BoardObject;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onStartEdit: () => void;
}

export function StickyNote({
  object,
  isSelected,
  isEditing,
  onSelect,
  onDragEnd,
  onStartEdit,
}: StickyNoteProps) {
  const displayText = object.text || "Double-click to edit";

  return (
    <Group
      x={object.x}
      y={object.y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onStartEdit}
      onDblTap={onStartEdit}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        onDragEnd(e);
      }}
    >
      <Rect
        width={object.width}
        height={object.height}
        fill={object.color}
        cornerRadius={8}
        shadowColor="black"
        shadowBlur={5}
        shadowOpacity={0.2}
        shadowOffsetX={2}
        shadowOffsetY={2}
        stroke={isSelected ? "#3b82f6" : undefined}
        strokeWidth={isSelected ? 3 : 0}
      />
      {/* Hide Konva text while the HTML textarea overlay is active */}
      {!isEditing && (
        <Text
          text={displayText}
          width={object.width - 20}
          height={object.height - 20}
          x={10}
          y={10}
          fontSize={14}
          fontFamily="sans-serif"
          fill={displayText === "Double-click to edit" ? "#9ca3af" : "#374151"}
          align="left"
          verticalAlign="top"
          wrap="word"
        />
      )}
    </Group>
  );
}
