import { forwardRef } from "react";
import { Line } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { BoardObject } from "../../hooks/useFirestore";

interface LineShapeProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
}

export const LineShape = forwardRef<any, LineShapeProps>(
  ({ object, isSelected, onSelect, onDragEnd }, ref) => {
    const points = object.points || [0, 0, 200, 0];

    return (
      <Line
        ref={ref}
        x={object.x}
        y={object.y}
        points={points}
        stroke={isSelected ? "#3b82f6" : object.color === "#ffffff" ? "#374151" : object.color}
        strokeWidth={3}
        lineCap="round"
        lineJoin="round"
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={onDragEnd}
        strokeScaleEnabled={false}
      />
    );
  }
);
