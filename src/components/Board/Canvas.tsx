import { useEffect, useState, useRef, Fragment } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Stage, Layer, Circle, Transformer } from "react-konva";
import type Konva from "konva";
import type { BoardObject } from "../../hooks/useFirestore";
import type { UserPresence } from "../../hooks/usePresence";
import { StickyNote } from "./StickyNote";
import { RectShape } from "./RectShape";
import { CircleShape } from "./CircleShape";
import { LineShape } from "./LineShape";
import { CursorOverlay } from "../Presence/CursorOverlay";

interface CanvasProps {
  viewport: {
    stagePos: { x: number; y: number };
    stageScale: number;
  };
  handlers: {
    onWheel: (e: KonvaEventObject<WheelEvent>) => void;
    onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  };
  objectState: {
    objects: BoardObject[];
    selectedId: string | null;
    currentTool: string;
    currentColor: string;
    setSelectedId: (id: string | null) => void;
    setCurrentTool: (tool: any) => void;
    addObject: (obj: BoardObject) => void;
    updateObject: (id: string, updates: Partial<BoardObject>) => void;
    deleteObject: (id: string) => void;
  };
  presence: {
    otherUsers: UserPresence[];
    updateCursor: (x: number, y: number) => void;
  };
}

export function Canvas({ viewport, handlers, objectState, presence }: CanvasProps) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Sticky note editing — managed here so the textarea is real DOM, not in Konva
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    objects,
    selectedId,
    currentTool,
    currentColor,
    setSelectedId,
    setCurrentTool,
    addObject,
    updateObject,
    deleteObject,
  } = objectState;

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);

  useEffect(() => {
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-focus textarea when sticky note editing starts
  useEffect(() => {
    if (editingNoteId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingNoteId]);

  // Clear Transformer when selection is null, deleted, or is a line (which uses custom handles)
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const selectedObj = objects.find((o) => o.id === selectedId);
    const useTransformer =
      selectedObj &&
      selectedObj.type !== "line" &&
      selectedNodeRef.current;

    if (useTransformer) {
      tr.nodes([selectedNodeRef.current!]);
    } else {
      tr.nodes([]);
      if (!selectedObj || selectedObj.type === "line") {
        selectedNodeRef.current = null;
      }
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, objects]);

  // Keyboard delete (skip when editing text)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          deleteObject(selectedId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, deleteObject]);

  const getWorldPos = (screenX: number, screenY: number) => ({
    x: (screenX - viewport.stagePos.x) / viewport.stageScale,
    y: (screenY - viewport.stagePos.y) / viewport.stageScale,
  });

  const handleStagePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    if (e.target !== stageRef.current) return;
    if (currentTool === "select") setSelectedId(null);
  };

  const createObjectAtPointer = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const ptr = stage.getPointerPosition();
    if (!ptr) return;

    const worldPos = getWorldPos(ptr.x, ptr.y);
    const newObject: BoardObject = {
      id: crypto.randomUUID(),
      type: currentTool as BoardObject["type"],
      x: worldPos.x,
      y: worldPos.y,
      width: 200,
      height: 200,
      rotation: 0,
      color: currentColor,
    };

    if (currentTool === "rectangle") {
      newObject.width = 150;
      newObject.height = 100;
    } else if (currentTool === "circle") {
      newObject.radius = 60;
    } else if (currentTool === "line") {
      newObject.points = [0, 0, 200, 0];
    }

    addObject(newObject);
    setSelectedId(newObject.id);
    setCurrentTool("select");
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target !== stageRef.current) return;
    if (currentTool === "select") return;
    createObjectAtPointer();
  };

  const handleStageTap = (e: KonvaEventObject<TouchEvent>) => {
    if (e.target !== stageRef.current) return;
    if (currentTool === "select") return;
    createObjectAtPointer();
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const worldPos = getWorldPos(ptr.x, ptr.y);
    presence.updateCursor(worldPos.x, worldPos.y);
  };

  const handleObjectDragEnd = (id: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    updateObject(id, { x: e.target.x(), y: e.target.y() });
  };

  const handleStageDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (e.target !== stageRef.current) return;
    handlers.onDragEnd(e);
  };

  const handleTransformEnd = (id: string, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const obj = objects.find((o) => o.id === id);
    if (obj?.type === "circle") {
      // Circles scale uniformly (keepRatio=true on Transformer); width() = 2*radius
      updateObject(id, {
        x: node.x(),
        y: node.y(),
        radius: Math.max(5, (node.width() * scaleX) / 2),
      });
    } else {
      updateObject(id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
      });
    }
  };

  const saveNoteText = () => {
    if (editingNoteId) {
      updateObject(editingNoteId, { text: editingText });
      setEditingNoteId(null);
    }
  };

  const renderObject = (obj: BoardObject) => {
    const isSelected = obj.id === selectedId;

    const shapeRef = (node: Konva.Node | null) => {
      if (isSelected) selectedNodeRef.current = node;
    };

    const commonProps = {
      object: obj,
      isSelected,
      onSelect: () => setSelectedId(obj.id),
      onDragEnd: (e: KonvaEventObject<DragEvent>) =>
        handleObjectDragEnd(obj.id, e),
    };

    switch (obj.type) {
      case "sticky":
        return (
          <StickyNote
            key={obj.id}
            {...commonProps}
            isEditing={editingNoteId === obj.id}
            onStartEdit={() => {
              setEditingNoteId(obj.id);
              setEditingText(obj.text || "");
            }}
          />
        );

      case "rectangle":
        return <RectShape key={obj.id} {...commonProps} ref={shapeRef} />;

      case "circle":
        return <CircleShape key={obj.id} {...commonProps} ref={shapeRef} />;

      case "line": {
        // Lines use custom endpoint anchors instead of the Transformer
        const pts = obj.points || [0, 0, 200, 0];
        const anchorR = 7 / viewport.stageScale;
        const anchorStroke = 2 / viewport.stageScale;

        return (
          <Fragment key={obj.id}>
            <LineShape {...commonProps} ref={null} />
            {isSelected && (
              <>
                {/* Start-point anchor */}
                <Circle
                  x={obj.x + pts[0]}
                  y={obj.y + pts[1]}
                  radius={anchorR}
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth={anchorStroke}
                  draggable
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const newPts = [...pts];
                    newPts[0] = e.target.x() - obj.x;
                    newPts[1] = e.target.y() - obj.y;
                    updateObject(obj.id, { points: newPts });
                  }}
                />
                {/* End-point anchor */}
                <Circle
                  x={obj.x + pts[2]}
                  y={obj.y + pts[3]}
                  radius={anchorR}
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth={anchorStroke}
                  draggable
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const newPts = [...pts];
                    newPts[2] = e.target.x() - obj.x;
                    newPts[3] = e.target.y() - obj.y;
                    updateObject(obj.id, { points: newPts });
                  }}
                />
              </>
            )}
          </Fragment>
        );
      }

      default:
        return null;
    }
  };

  const renderDotGrid = () => {
    const dots = [];
    const gridSize = 50;
    const dotRadius = 2;
    const dotColor = "#d1d5db";
    const { stagePos, stageScale } = viewport;

    const startX =
      Math.floor((-stagePos.x / stageScale - 100) / gridSize) * gridSize;
    const endX = Math.ceil((dimensions.width - stagePos.x) / stageScale + 100);
    const startY =
      Math.floor((-stagePos.y / stageScale - 100) / gridSize) * gridSize;
    const endY =
      Math.ceil((dimensions.height - stagePos.y) / stageScale + 100);

    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        dots.push(
          <Circle
            key={`dot-${x}-${y}`}
            x={x}
            y={y}
            radius={dotRadius / stageScale}
            fill={dotColor}
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
    }
    return dots;
  };

  // Find the note being edited so we can position the textarea
  const editingNote = editingNoteId
    ? objects.find((o) => o.id === editingNoteId)
    : null;

  return (
    <>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable={currentTool === "select"}
        x={viewport.stagePos.x}
        y={viewport.stagePos.y}
        scaleX={viewport.stageScale}
        scaleY={viewport.stageScale}
        onWheel={handlers.onWheel}
        onDragEnd={handleStageDragEnd}
        onPointerDown={handleStagePointerDown}
        onClick={handleStageClick}
        onTap={handleStageTap}
        onMouseMove={handleStageMouseMove}
      >
        <Layer listening={false}>{renderDotGrid()}</Layer>
        <Layer>
          {objects.map(renderObject)}
          <Transformer
            ref={transformerRef}
            rotateEnabled={objects.find((o) => o.id === selectedId)?.type !== "circle"}
            keepRatio={objects.find((o) => o.id === selectedId)?.type === "circle"}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
            }
            onTransformEnd={(e) => {
              if (selectedId) handleTransformEnd(selectedId, e.target);
            }}
          />
        </Layer>
        {/* Cursor overlay is a separate non-interactive layer above everything */}
        <CursorOverlay
          otherUsers={presence.otherUsers}
          stageScale={viewport.stageScale}
        />
      </Stage>

      {/* Textarea sits in real DOM, positioned over the sticky note via fixed coords */}
      {editingNote && (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={saveNoteText}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditingNoteId(null); // discard
          }}
          style={{
            position: "fixed",
            left: `${editingNote.x * viewport.stageScale + viewport.stagePos.x + 10}px`,
            top: `${editingNote.y * viewport.stageScale + viewport.stagePos.y + 10}px`,
            width: `${(editingNote.width - 20) * viewport.stageScale}px`,
            height: `${(editingNote.height - 20) * viewport.stageScale}px`,
            fontSize: `${14 * viewport.stageScale}px`,
            padding: "8px",
            border: "2px solid #3b82f6",
            borderRadius: "4px",
            outline: "none",
            resize: "none",
            fontFamily: "sans-serif",
            backgroundColor: editingNote.color,
            color: "#374151",
            zIndex: 1000,
            boxSizing: "border-box",
          }}
        />
      )}
    </>
  );
}
