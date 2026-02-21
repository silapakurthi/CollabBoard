import { Fragment } from "react";
import { Arrow, Line, Circle } from "react-konva";
import type { BoardObject } from "../../hooks/useFirestore";

interface ConnectorShapeProps {
  connector: BoardObject;
  objects: BoardObject[];
  isSelected: boolean;
  onSelect: () => void;
}

function getObjectCenter(obj: BoardObject): { x: number; y: number } {
  if (obj.type === "circle") return { x: obj.x, y: obj.y };
  return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
}

/**
 * Given an object and the world-space point the connector is heading TOWARD,
 * returns the point on the object's boundary where the connector should start/end.
 */
function getEdgePoint(
  obj: BoardObject,
  toward: { x: number; y: number }
): { x: number; y: number } {
  const center = getObjectCenter(obj);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Objects are coincident — just return center
  if (len < 1) return center;

  const nx = dx / len;
  const ny = dy / len;

  if (obj.type === "circle") {
    const r = obj.radius ?? 60;
    return { x: center.x + nx * r, y: center.y + ny * r };
  }

  // Axis-aligned rectangle (sticky, rectangle):
  // Find the smallest t so that (nx*t, ny*t) reaches either the left/right or top/bottom edge.
  const halfW = obj.width / 2;
  const halfH = obj.height / 2;
  const tX = Math.abs(nx) > 1e-9 ? halfW / Math.abs(nx) : Infinity;
  const tY = Math.abs(ny) > 1e-9 ? halfH / Math.abs(ny) : Infinity;
  const t = Math.min(tX, tY);

  return { x: center.x + nx * t, y: center.y + ny * t };
}

export function ConnectorShape({
  connector,
  objects,
  isSelected,
  onSelect,
}: ConnectorShapeProps) {
  const fromObj = objects.find((o) => o.id === connector.connectedFrom);
  const toObj = objects.find((o) => o.id === connector.connectedTo);

  // One or both anchors were deleted — hide (cascade delete handles cleanup async)
  if (!fromObj || !toObj) return null;

  const fromCenter = getObjectCenter(fromObj);
  const toCenter = getObjectCenter(toObj);

  // Connectors run edge-to-edge so both ends remain visible
  const start = getEdgePoint(fromObj, toCenter);
  const end = getEdgePoint(toObj, fromCenter);

  const isDashed = connector.style?.lineStyle === "dashed";
  const hasArrow = connector.style?.arrowHead !== false;
  const color = connector.color || "#374151";
  const strokeWidth = isSelected ? 3 : 2;
  const anchorRadius = isSelected ? 5 : 4;

  const lineProps = {
    points: [start.x, start.y, end.x, end.y],
    stroke: color,
    strokeWidth,
    dash: isDashed ? [10, 5] : undefined,
    hitStrokeWidth: 24, // wide hit area for easy clicking
    onClick: onSelect,
    onTap: onSelect,
    strokeScaleEnabled: false,
  };

  return (
    <Fragment>
      {hasArrow ? (
        <Arrow {...lineProps} fill={color} pointerLength={12} pointerWidth={10} />
      ) : (
        <Line {...lineProps} />
      )}

      {/* Endpoint circles mark where the connector attaches to each object */}
      <Circle
        x={start.x}
        y={start.y}
        radius={anchorRadius}
        fill={color}
        stroke="white"
        strokeWidth={1.5}
        listening={false}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
      />
      <Circle
        x={end.x}
        y={end.y}
        radius={anchorRadius}
        fill={color}
        stroke="white"
        strokeWidth={1.5}
        listening={false}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
      />
    </Fragment>
  );
}
