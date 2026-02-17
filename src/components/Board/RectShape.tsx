import { forwardRef } from "react";
import { Rect } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { BoardObject } from "../../hooks/useFirestore";

interface RectShapeProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
}

export const RectShape = forwardRef<any, RectShapeProps>(
  ({ object, isSelected: _isSelected, onSelect, onDragEnd }, ref) => {
    return (
      <Rect
        ref={ref}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        fill={object.color}
        stroke="#374151"
        strokeWidth={2}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={onDragEnd}
        shadowColor="black"
        shadowBlur={3}
        shadowOpacity={0.1}
        shadowOffsetX={1}
        shadowOffsetY={1}
        strokeScaleEnabled={false}
      />
    );
  }
);
