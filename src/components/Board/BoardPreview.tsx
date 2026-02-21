import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";

interface PreviewObject {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  radius?: number;
  points?: number[];
  connectedFrom?: string;
  connectedTo?: string;
  style?: { lineStyle?: string; arrowHead?: boolean };
}

interface BoardPreviewProps {
  boardId: string;
}

export function BoardPreview({ boardId }: BoardPreviewProps) {
  const [objects, setObjects] = useState<PreviewObject[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, `boards/${boardId}/objects`)).then((snap) => {
      if (cancelled) return;
      const objs: PreviewObject[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type,
          x: data.x ?? 0,
          y: data.y ?? 0,
          width: data.width ?? 0,
          height: data.height ?? 0,
          color: data.color,
          radius: data.radius,
          points: data.points,
          connectedFrom: data.connectedFrom,
          connectedTo: data.connectedTo,
          style: data.style,
        };
      });
      setObjects(objs);
    });
    return () => { cancelled = true; };
  }, [boardId]);

  // Loading state
  if (objects === null) {
    return (
      <div className="w-full h-36 bg-gray-50 rounded-t-lg animate-pulse" />
    );
  }

  // Empty state
  const nonConnectors = objects.filter((o) => o.type !== "connector");
  if (nonConnectors.length === 0) {
    return (
      <div className="w-full h-36 bg-gray-50 rounded-t-lg flex items-center justify-center">
        <span className="text-xs text-gray-400">Empty board</span>
      </div>
    );
  }

  // Compute bounding box from non-connector objects
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of nonConnectors) {
    const w = obj.width || (obj.radius ? obj.radius * 2 : 0);
    const h = obj.height || (obj.radius ? obj.radius * 2 : 0);
    let ox1 = obj.x;
    let oy1 = obj.y;
    let ox2 = obj.x + w;
    let oy2 = obj.y + h;

    // Lines use points array relative to obj.x/y
    if (obj.type === "line" && obj.points && obj.points.length >= 4) {
      for (let i = 0; i < obj.points.length; i += 2) {
        ox1 = Math.min(ox1, obj.x + obj.points[i]);
        oy1 = Math.min(oy1, obj.y + obj.points[i + 1]);
        ox2 = Math.max(ox2, obj.x + obj.points[i]);
        oy2 = Math.max(oy2, obj.y + obj.points[i + 1]);
      }
    }

    minX = Math.min(minX, ox1);
    minY = Math.min(minY, oy1);
    maxX = Math.max(maxX, ox2);
    maxY = Math.max(maxY, oy2);
  }

  // Add generous padding so shapes aren't clipped at edges
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const pad = Math.max(contentW, contentH) * 0.08 + 20;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const vw = maxX - minX;
  const vh = maxY - minY;

  // Build an object map for connector lookups
  const objMap = new Map(objects.map((o) => [o.id, o]));

  return (
    <div className="w-full h-36 bg-gray-50 rounded-t-lg overflow-hidden">
      <svg
        viewBox={`${minX} ${minY} ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {objects.map((obj) => {
          switch (obj.type) {
            case "sticky":
              return (
                <rect
                  key={obj.id}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  rx={6}
                  ry={6}
                  fill={obj.color || "#fef08a"}
                  stroke="#00000020"
                  strokeWidth={1}
                />
              );
            case "rectangle":
              return (
                <rect
                  key={obj.id}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  fill={obj.color || "#bfdbfe"}
                  stroke="#00000020"
                  strokeWidth={1}
                />
              );
            case "circle": {
              const r = obj.radius || obj.width / 2;
              return (
                <circle
                  key={obj.id}
                  cx={obj.x + r}
                  cy={obj.y + r}
                  r={r}
                  fill={obj.color || "#bbf7d0"}
                  stroke="#00000020"
                  strokeWidth={1}
                />
              );
            }
            case "frame":
              return (
                <rect
                  key={obj.id}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  fill="#e0e7ff40"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  rx={4}
                  ry={4}
                />
              );
            case "line": {
              if (!obj.points || obj.points.length < 4) return null;
              return (
                <line
                  key={obj.id}
                  x1={obj.x + obj.points[0]}
                  y1={obj.y + obj.points[1]}
                  x2={obj.x + obj.points[2]}
                  y2={obj.y + obj.points[3]}
                  stroke={obj.color || "#374151"}
                  strokeWidth={2}
                />
              );
            }
            case "text":
              return (
                <rect
                  key={obj.id}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  fill="#9ca3af40"
                  rx={2}
                  ry={2}
                />
              );
            case "connector": {
              const from = obj.connectedFrom ? objMap.get(obj.connectedFrom) : null;
              const to = obj.connectedTo ? objMap.get(obj.connectedTo) : null;
              if (!from || !to) return null;
              const fw = from.width || (from.radius ? from.radius * 2 : 0);
              const fh = from.height || (from.radius ? from.radius * 2 : 0);
              const tw = to.width || (to.radius ? to.radius * 2 : 0);
              const th = to.height || (to.radius ? to.radius * 2 : 0);
              const x1 = from.x + fw / 2;
              const y1 = from.y + fh / 2;
              const x2 = to.x + tw / 2;
              const y2 = to.y + th / 2;
              const isDashed = obj.style?.lineStyle === "dashed";
              return (
                <line
                  key={obj.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={obj.color || "#374151"}
                  strokeWidth={2}
                  strokeDasharray={isDashed ? "6 3" : undefined}
                />
              );
            }
            default:
              return null;
          }
        })}
      </svg>
    </div>
  );
}
