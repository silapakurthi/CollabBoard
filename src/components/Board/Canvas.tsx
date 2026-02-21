import { useEffect, useState, useRef, Fragment } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Stage, Layer, Circle, Ellipse, Rect, Line, Arrow, Transformer } from "react-konva";
import type Konva from "konva";
import type { BoardObject } from "../../hooks/useFirestore";
import type { UserPresence } from "../../hooks/usePresence";
import { StickyNote } from "./StickyNote";
import { RectShape } from "./RectShape";
import { CircleShape } from "./CircleShape";
import { LineShape } from "./LineShape";
import { ConnectorShape } from "./Connector";
import { TextElement } from "./TextElement";
import { Frame } from "./Frame";
import { CursorOverlay } from "../Presence/CursorOverlay";
import { contrastText } from "../../utils/color";

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
    selectedIds: Set<string>;
    currentTool: string;
    currentColor: string;
    selectOne: (id: string) => void;
    toggleSelection: (id: string) => void;
    selectMany: (ids: string[]) => void;
    clearSelection: () => void;
    setCurrentTool: (tool: any) => void;
    addObject: (obj: BoardObject) => void;
    updateObject: (id: string, updates: Partial<BoardObject>) => void;
    deleteObject: (id: string) => void;
    refreshObjects: () => Promise<void>;
  };
  presence: {
    otherUsers: UserPresence[];
    updateCursor: (x: number, y: number) => void;
  };
}

/** Returns the visual center of an object (world coords) for connector routing. */
function getObjectCenter(obj: BoardObject): { x: number; y: number } {
  if (obj.type === "circle") return { x: obj.x, y: obj.y };
  return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
}

/** Returns an axis-aligned bounding box for an object in world coords. */
function getObjectBBox(obj: BoardObject): { x: number; y: number; w: number; h: number } {
  if (obj.type === "circle") {
    const r = obj.radius ?? 60;
    return { x: obj.x - r, y: obj.y - r, w: r * 2, h: r * 2 };
  }
  if (obj.type === "line") {
    const pts = obj.points || [0, 0, 200, 0];
    const xs = [obj.x + pts[0], obj.x + pts[2]];
    const ys = [obj.y + pts[1], obj.y + pts[3]];
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
  }
  return { x: obj.x, y: obj.y, w: obj.width, h: obj.height };
}

export function Canvas({ viewport, handlers, objectState, presence }: CanvasProps) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Text editing (sticky notes, text elements, frame titles)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Connector creation
  const [pendingConnectorFrom, setPendingConnectorFrom] = useState<string | null>(null);
  const [connectorMousePos, setConnectorMousePos] = useState<{ x: number; y: number } | null>(null);

  // Frame drawing (click-and-drag creation)
  const [frameDraw, setFrameDraw] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Shape drawing (drag-to-create for rectangle, circle, sticky, line, text)
  const [shapeDraw, setShapeDraw] = useState<{
    tool: "rectangle" | "circle" | "sticky" | "line" | "text";
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Force re-render during transform so connectors update in real-time
  const [, setTransformTick] = useState(0);

  // Marquee selection
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeStartRef = useRef<{
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
  } | null>(null);

  const {
    objects,
    selectedIds,
    currentTool,
    currentColor,
    selectOne,
    toggleSelection,
    selectMany,
    clearSelection,
    setCurrentTool,
    addObject,
    updateObject,
    deleteObject,
    refreshObjects,
  } = objectState;

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Ref map for all rendered object Konva nodes
  const objectNodesRef = useRef<Map<string, Konva.Node>>(new Map());

  // Shift key tracking (avoids changing shape onSelect signatures)
  const shiftHeldRef = useRef(false);

  // Last known cursor world position (for paste-at-cursor)
  const lastCursorWorldPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // In-memory clipboard
  const clipboardRef = useRef<{
    objects: BoardObject[];
    pasteCount: number;
  } | null>(null);

  // Multi-select drag
  const multiDragRef = useRef<{
    draggedId: string;
    startPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  // Frame group-drag: snapshot of contained objects at drag start
  const frameDragRef = useRef<{
    containedIds: string[];
    startPositions: Map<string, { x: number; y: number }>;
    frameStartX: number;
    frameStartY: number;
  } | null>(null);

  // Deferred text-editing start (waits for Firestore snapshot)
  const pendingEditRef = useRef<string | null>(null);

  // Expose board data for E2E testing (Konva ESM build doesn't set window.Konva)
  const addObjectRef = useRef(addObject);
  addObjectRef.current = addObject;
  const updateObjectRef = useRef(updateObject);
  updateObjectRef.current = updateObject;
  const refreshObjectsRef = useRef(refreshObjects);
  refreshObjectsRef.current = refreshObjects;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  useEffect(() => {
    const w = window as any;
    w.__TEST_CANVAS = {
      get objects() { return objects; },
      get viewport() { return viewportRef.current; },
      get selectedIds() { return selectedIdsRef.current; },
      addObject: (obj: BoardObject) => addObjectRef.current(obj),
      updateObject: (id: string, updates: Partial<BoardObject>) => updateObjectRef.current(id, updates),
      refreshObjects: () => refreshObjectsRef.current(),
    };
    return () => { delete w.__TEST_CANVAS; };
  }, [objects]);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Track Shift key
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeldRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeldRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Auto-focus textarea when editing starts
  useEffect(() => {
    if (editingNoteId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingNoteId]);

  // Transformer: attach to all selected transformable nodes
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    if (currentTool === "connector" || currentTool === "frame") {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const nodes: Konva.Node[] = [];
    for (const id of selectedIds) {
      const obj = objects.find((o) => o.id === id);
      if (!obj) continue;
      if (obj.type === "line" || obj.type === "connector") continue;
      const node = objectNodesRef.current.get(id);
      if (node) nodes.push(node);
    }

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, objects, currentTool]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Delete / Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        e.preventDefault();
        deleteAllSelected();
        return;
      }

      // Ctrl+A — select all
      if (mod && e.key === "a") {
        e.preventDefault();
        selectMany(objects.filter((o) => o.type !== "connector").map((o) => o.id));
        return;
      }

      // Ctrl+D — duplicate
      if (mod && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Ctrl+C — copy
      if (mod && e.key === "c") {
        e.preventDefault();
        copyToClipboard();
        return;
      }

      // Ctrl+V — paste
      if (mod && e.key === "v") {
        e.preventDefault();
        pasteFromClipboard();
        return;
      }

      // Escape — clear selection
      if (e.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, objects]);

  // Deferred text-editing start
  useEffect(() => {
    if (!pendingEditRef.current) return;
    const obj = objects.find((o) => o.id === pendingEditRef.current);
    if (obj) {
      setEditingNoteId(obj.id);
      setEditingText(obj.text || "");
      pendingEditRef.current = null;
    }
  }, [objects]);

  // Cancel pending connector when switching away from connector tool
  useEffect(() => {
    if (currentTool !== "connector") {
      setPendingConnectorFrom(null);
      setConnectorMousePos(null);
    }
  }, [currentTool]);

  // Cancel frame draw when switching away from frame tool
  useEffect(() => {
    if (currentTool !== "frame") setFrameDraw(null);
  }, [currentTool]);

  // Cancel shape draw when switching away from shape tools
  useEffect(() => {
    const drawTools = ["rectangle", "circle", "sticky", "line", "text"];
    if (!drawTools.includes(currentTool)) setShapeDraw(null);
  }, [currentTool]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getWorldPos = (screenX: number, screenY: number) => ({
    x: (screenX - viewport.stagePos.x) / viewport.stageScale,
    y: (screenY - viewport.stagePos.y) / viewport.stageScale,
  });

  /** Reverse-lookup an object ID from a Konva node. */
  const findIdByNode = (node: Konva.Node): string | undefined => {
    for (const [id, n] of objectNodesRef.current.entries()) {
      if (n === node) return id;
    }
    return undefined;
  };

  /** Read the live visual bounds of an object from its Konva node (accounts for in-progress transform). */
  const getLiveObjectData = (obj: BoardObject): BoardObject => {
    const node = objectNodesRef.current.get(obj.id);
    if (!node) return obj;
    const sx = node.scaleX();
    const sy = node.scaleY();
    // No transform active — return state data as-is
    if (sx === 1 && sy === 1 && node.x() === obj.x && node.y() === obj.y) return obj;

    if (obj.type === "circle") {
      return {
        ...obj,
        x: node.x(),
        y: node.y(),
        radius: Math.max(5, (node.width() * sx) / 2),
      };
    }

    return {
      ...obj,
      x: node.x(),
      y: node.y(),
      width: node.width() * sx,
      height: node.height() * sy,
    };
  };

  // ── Multi-select operations ──────────────────────────────────────────────────

  /** Delete all selected objects + cascade connectors. */
  const deleteAllSelected = () => {
    const toDelete = new Set(selectedIds);
    for (const id of selectedIds) {
      objects
        .filter(
          (o) =>
            o.type === "connector" &&
            (o.connectedFrom === id || o.connectedTo === id)
        )
        .forEach((c) => toDelete.add(c.id));
    }
    for (const id of toDelete) deleteObject(id);
    clearSelection();
  };

  /** Duplicate all selected objects with +20,+20 offset. Recreate connectors between them. */
  const duplicateSelected = () => {
    if (selectedIds.size === 0) return;

    const selected = objects.filter((o) => selectedIds.has(o.id));
    const idMap = new Map<string, string>();
    selected.forEach((obj) => idMap.set(obj.id, crypto.randomUUID()));

    const newIds: string[] = [];

    for (const obj of selected) {
      const newId = idMap.get(obj.id)!;
      const newObj: BoardObject = {
        ...structuredClone(obj),
        id: newId,
        x: obj.x + 20,
        y: obj.y + 20,
      };

      if (obj.type === "connector") {
        const newFrom = obj.connectedFrom ? idMap.get(obj.connectedFrom) : undefined;
        const newTo = obj.connectedTo ? idMap.get(obj.connectedTo) : undefined;
        if (newFrom && newTo) {
          newObj.connectedFrom = newFrom;
          newObj.connectedTo = newTo;
          newObj.x = 0;
          newObj.y = 0;
        } else {
          continue; // skip connectors with an endpoint outside the selection
        }
      }

      addObject(newObj);
      newIds.push(newId);
    }

    // Also duplicate connectors between selected objects that aren't themselves selected
    const selectedSet = new Set(selected.map((o) => o.id));
    const connectorsToClone = objects.filter(
      (o) =>
        o.type === "connector" &&
        !selectedSet.has(o.id) &&
        o.connectedFrom &&
        selectedSet.has(o.connectedFrom) &&
        o.connectedTo &&
        selectedSet.has(o.connectedTo)
    );
    for (const conn of connectorsToClone) {
      const newConn: BoardObject = {
        ...structuredClone(conn),
        id: crypto.randomUUID(),
        connectedFrom: idMap.get(conn.connectedFrom!)!,
        connectedTo: idMap.get(conn.connectedTo!)!,
      };
      addObject(newConn);
      newIds.push(newConn.id);
    }

    selectMany(newIds);
  };

  /** Copy selected objects to in-memory clipboard. */
  const copyToClipboard = () => {
    if (selectedIds.size === 0) return;
    const selected = objects.filter((o) => selectedIds.has(o.id));

    // Also include connectors between selected objects
    const selectedSet = new Set(selected.map((o) => o.id));
    const extraConnectors = objects.filter(
      (o) =>
        o.type === "connector" &&
        !selectedSet.has(o.id) &&
        o.connectedFrom &&
        selectedSet.has(o.connectedFrom) &&
        o.connectedTo &&
        selectedSet.has(o.connectedTo)
    );

    clipboardRef.current = {
      objects: structuredClone([...selected, ...extraConnectors]),
      pasteCount: 0,
    };
  };

  /** Paste from in-memory clipboard at cursor position. */
  const pasteFromClipboard = () => {
    if (!clipboardRef.current || clipboardRef.current.objects.length === 0) return;

    clipboardRef.current.pasteCount += 1;
    const nonConnectors = clipboardRef.current.objects.filter((o) => o.type !== "connector");
    const cursor = lastCursorWorldPosRef.current;

    // Compute centroid of non-connector objects for offset
    let offsetX: number;
    let offsetY: number;
    if (nonConnectors.length > 0) {
      const cx = nonConnectors.reduce((sum, o) => sum + o.x, 0) / nonConnectors.length;
      const cy = nonConnectors.reduce((sum, o) => sum + o.y, 0) / nonConnectors.length;
      offsetX = cursor.x - cx;
      offsetY = cursor.y - cy;
    } else {
      offsetX = clipboardRef.current.pasteCount * 20;
      offsetY = clipboardRef.current.pasteCount * 20;
    }

    const idMap = new Map<string, string>();
    clipboardRef.current.objects.forEach((obj) => idMap.set(obj.id, crypto.randomUUID()));

    const newIds: string[] = [];

    for (const obj of clipboardRef.current.objects) {
      const newId = idMap.get(obj.id)!;
      const newObj: BoardObject = {
        ...structuredClone(obj),
        id: newId,
        x: obj.x + offsetX,
        y: obj.y + offsetY,
      };

      if (obj.type === "connector") {
        const newFrom = obj.connectedFrom ? idMap.get(obj.connectedFrom) : undefined;
        const newTo = obj.connectedTo ? idMap.get(obj.connectedTo) : undefined;
        if (newFrom && newTo) {
          newObj.connectedFrom = newFrom;
          newObj.connectedTo = newTo;
          newObj.x = 0;
          newObj.y = 0;
        } else {
          continue;
        }
      }

      addObject(newObj);
      newIds.push(newId);
    }

    selectMany(newIds);
  };

  // ── Connector creation ──────────────────────────────────────────────────────

  const handleConnectorObjectClick = (objId: string) => {
    const obj = objects.find((o) => o.id === objId);
    if (!obj || obj.type === "line" || obj.type === "connector") return;

    if (!pendingConnectorFrom) {
      setPendingConnectorFrom(objId);
      selectOne(objId);
    } else if (pendingConnectorFrom === objId) {
      setPendingConnectorFrom(null);
      clearSelection();
    } else {
      const connectorId = crypto.randomUUID();
      const newConnector: BoardObject = {
        id: connectorId,
        type: "connector",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        color: currentColor,
        connectedFrom: pendingConnectorFrom,
        connectedTo: objId,
        style: { lineStyle: "solid", arrowHead: true },
      };
      addObject(newConnector);
      setPendingConnectorFrom(null);
      setConnectorMousePos(null);
      setCurrentTool("select");
      selectOne(connectorId);
    }
  };

  // ── Frame group-drag ────────────────────────────────────────────────────────

  const handleFrameDragStart = (frameObj: BoardObject) => {
    const contained = objects.filter((o) => {
      if (o.id === frameObj.id || o.type === "connector" || o.type === "frame") return false;
      const center = getObjectCenter(o);
      return (
        center.x >= frameObj.x &&
        center.x <= frameObj.x + frameObj.width &&
        center.y >= frameObj.y &&
        center.y <= frameObj.y + frameObj.height
      );
    });
    frameDragRef.current = {
      containedIds: contained.map((o) => o.id),
      startPositions: new Map(contained.map((o) => [o.id, { x: o.x, y: o.y }])),
      frameStartX: frameObj.x,
      frameStartY: frameObj.y,
    };
  };

  const handleFrameDragMove = (e: KonvaEventObject<DragEvent>) => {
    if (!frameDragRef.current) return;
    const dx = e.target.x() - frameDragRef.current.frameStartX;
    const dy = e.target.y() - frameDragRef.current.frameStartY;
    for (const id of frameDragRef.current.containedIds) {
      // Skip objects already being moved by multi-drag
      if (multiDragRef.current?.startPositions.has(id)) continue;
      const start = frameDragRef.current.startPositions.get(id);
      const node = objectNodesRef.current.get(id);
      if (start && node) {
        node.x(start.x + dx);
        node.y(start.y + dy);
      }
    }
  };

  const handleFrameDragEnd = (frameId: string, e: KonvaEventObject<DragEvent>) => {
    const newX = e.target.x();
    const newY = e.target.y();
    updateObject(frameId, { x: newX, y: newY });

    if (frameDragRef.current) {
      const dx = newX - frameDragRef.current.frameStartX;
      const dy = newY - frameDragRef.current.frameStartY;
      for (const id of frameDragRef.current.containedIds) {
        // Skip objects already persisted by multi-drag
        if (multiDragRef.current?.startPositions.has(id)) continue;
        const start = frameDragRef.current.startPositions.get(id);
        if (start) updateObject(id, { x: start.x + dx, y: start.y + dy });
      }
      frameDragRef.current = null;
    }
  };

  // ── Multi-select drag handlers ──────────────────────────────────────────────

  const handleMultiDragStart = (objId: string) => {
    if (!selectedIds.has(objId) || selectedIds.size <= 1) return;
    const starts = new Map<string, { x: number; y: number }>();
    for (const sid of selectedIds) {
      if (sid === objId) continue;
      const node = objectNodesRef.current.get(sid);
      if (node) {
        starts.set(sid, { x: node.x(), y: node.y() });
      }
    }
    multiDragRef.current = { draggedId: objId, startPositions: starts };
  };

  const handleMultiDragMove = (objId: string, e: KonvaEventObject<DragEvent>) => {
    if (!multiDragRef.current || multiDragRef.current.draggedId !== objId) return;
    const startObj = objects.find((o) => o.id === objId);
    if (!startObj) return;
    const dx = e.target.x() - startObj.x;
    const dy = e.target.y() - startObj.y;
    for (const [sid, startPos] of multiDragRef.current.startPositions) {
      const node = objectNodesRef.current.get(sid);
      if (node) {
        node.x(startPos.x + dx);
        node.y(startPos.y + dy);
      }
    }
  };

  const handleMultiDragEnd = (objId: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    updateObject(objId, { x: e.target.x(), y: e.target.y() });

    if (multiDragRef.current && multiDragRef.current.draggedId === objId) {
      const startObj = objects.find((o) => o.id === objId);
      if (startObj) {
        const dx = e.target.x() - startObj.x;
        const dy = e.target.y() - startObj.y;
        for (const [sid, startPos] of multiDragRef.current.startPositions) {
          updateObject(sid, { x: startPos.x + dx, y: startPos.y + dy });
        }
      }
      multiDragRef.current = null;
    }
  };

  // ── Stage event handlers ────────────────────────────────────────────────────

  const handleStagePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    if (e.target !== stageRef.current) return;

    if (currentTool === "frame") {
      const stage = stageRef.current;
      const ptr = stage?.getPointerPosition();
      if (!ptr) return;
      const wp = getWorldPos(ptr.x, ptr.y);
      setFrameDraw({ startX: wp.x, startY: wp.y, currentX: wp.x, currentY: wp.y });
      return;
    }
    if (currentTool === "rectangle" || currentTool === "circle" || currentTool === "sticky" || currentTool === "line" || currentTool === "text") {
      const stage = stageRef.current;
      const ptr = stage?.getPointerPosition();
      if (!ptr) return;
      const wp = getWorldPos(ptr.x, ptr.y);
      setShapeDraw({ tool: currentTool, startX: wp.x, startY: wp.y, currentX: wp.x, currentY: wp.y });
      return;
    }
    if (currentTool === "connector") {
      setPendingConnectorFrom(null);
      clearSelection();
      return;
    }
    if (currentTool === "select") {
      const stage = stageRef.current;
      const ptr = stage?.getPointerPosition();
      if (!ptr) return;
      const wp = getWorldPos(ptr.x, ptr.y);

      // Record start for potential marquee
      marqueeStartRef.current = {
        screenX: ptr.x,
        screenY: ptr.y,
        worldX: wp.x,
        worldY: wp.y,
      };

      // Prevent stage pan so marquee can work
      stageRef.current?.stopDrag();

      if (!shiftHeldRef.current) {
        clearSelection();
      }
      return;
    }
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
    } else if (currentTool === "text") {
      newObject.width = 200;
      newObject.height = 30;
      newObject.fontSize = 16;
      newObject.text = "";
    }

    addObject(newObject);
    selectOne(newObject.id);

    if (currentTool === "text") {
      pendingEditRef.current = newObject.id;
    }

    setCurrentTool("select");
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target !== stageRef.current) return;
    // All shape tools are handled by the drag-to-create flow (pointerDown → mouseMove → mouseUp)
    if (currentTool !== "select") return;
  };

  const handleStageTap = (e: KonvaEventObject<TouchEvent>) => {
    if (e.target !== stageRef.current) return;
    if (currentTool === "select" || currentTool === "connector" || currentTool === "frame") return;
    if (shapeDraw) setShapeDraw(null);
    createObjectAtPointer();
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const worldPos = getWorldPos(ptr.x, ptr.y);
    presence.updateCursor(worldPos.x, worldPos.y);
    lastCursorWorldPosRef.current = worldPos;

    if (currentTool === "connector" && pendingConnectorFrom) {
      setConnectorMousePos(worldPos);
    }
    if (currentTool === "frame" && frameDraw) {
      setFrameDraw((prev) =>
        prev ? { ...prev, currentX: worldPos.x, currentY: worldPos.y } : null
      );
    }
    if (shapeDraw) {
      setShapeDraw((prev) =>
        prev ? { ...prev, currentX: worldPos.x, currentY: worldPos.y } : null
      );
    }

    // Marquee: check threshold before committing
    if (currentTool === "select" && marqueeStartRef.current && !marquee) {
      const dx = ptr.x - marqueeStartRef.current.screenX;
      const dy = ptr.y - marqueeStartRef.current.screenY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setMarquee({
          startX: marqueeStartRef.current.worldX,
          startY: marqueeStartRef.current.worldY,
          currentX: worldPos.x,
          currentY: worldPos.y,
        });
      }
    }

    // Update active marquee position
    if (marquee) {
      setMarquee((prev) =>
        prev ? { ...prev, currentX: worldPos.x, currentY: worldPos.y } : null
      );
    }
  };

  const handleStageMouseUp = () => {
    // Finalize marquee selection
    if (marquee) {
      const mx = Math.min(marquee.startX, marquee.currentX);
      const my = Math.min(marquee.startY, marquee.currentY);
      const mw = Math.abs(marquee.currentX - marquee.startX);
      const mh = Math.abs(marquee.currentY - marquee.startY);

      if (mw > 2 && mh > 2) {
        const intersecting = objects.filter((obj) => {
          if (obj.type === "connector") return false;
          const bbox = getObjectBBox(obj);
          return (
            bbox.x < mx + mw &&
            bbox.x + bbox.w > mx &&
            bbox.y < my + mh &&
            bbox.y + bbox.h > my
          );
        });

        // Auto-include connectors whose both endpoints are selected
        const selectedSet = new Set(intersecting.map((o) => o.id));
        const autoConnectors = objects.filter(
          (o) =>
            o.type === "connector" &&
            o.connectedFrom &&
            selectedSet.has(o.connectedFrom) &&
            o.connectedTo &&
            selectedSet.has(o.connectedTo)
        );

        const allIds = [...intersecting, ...autoConnectors].map((o) => o.id);

        if (shiftHeldRef.current) {
          // Merge with existing selection
          const merged = new Set(selectedIds);
          allIds.forEach((id) => merged.add(id));
          selectMany([...merged]);
        } else {
          selectMany(allIds);
        }
      }

      setMarquee(null);
      marqueeStartRef.current = null;
      return;
    }

    marqueeStartRef.current = null;

    // Frame creation
    if (currentTool === "frame" && frameDraw) {
      const x = Math.min(frameDraw.startX, frameDraw.currentX);
      const y = Math.min(frameDraw.startY, frameDraw.currentY);
      const w = Math.abs(frameDraw.currentX - frameDraw.startX);
      const h = Math.abs(frameDraw.currentY - frameDraw.startY);

      if (w > 20 && h > 20) {
        const newFrame: BoardObject = {
          id: crypto.randomUUID(),
          type: "frame",
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
          color: "#e0e7ff",
          text: "Frame",
        };
        addObject(newFrame);
        selectOne(newFrame.id);
        setCurrentTool("select");
      }
      setFrameDraw(null);
    }

    // Shape drawing finalization
    if (shapeDraw) {
      const dx = Math.abs(shapeDraw.currentX - shapeDraw.startX);
      const dy = Math.abs(shapeDraw.currentY - shapeDraw.startY);
      const isClick = dx < 10 && dy < 10;

      const x = Math.min(shapeDraw.startX, shapeDraw.currentX);
      const y = Math.min(shapeDraw.startY, shapeDraw.currentY);
      const w = Math.abs(shapeDraw.currentX - shapeDraw.startX);
      const h = Math.abs(shapeDraw.currentY - shapeDraw.startY);

      let newObject: BoardObject | null = null;

      if (shapeDraw.tool === "rectangle") {
        newObject = {
          id: crypto.randomUUID(),
          type: "rectangle",
          x: isClick ? shapeDraw.startX : x,
          y: isClick ? shapeDraw.startY : y,
          width: isClick ? 150 : w,
          height: isClick ? 100 : h,
          rotation: 0,
          color: currentColor,
        };
      } else if (shapeDraw.tool === "circle") {
        if (isClick) {
          newObject = {
            id: crypto.randomUUID(),
            type: "circle",
            x: shapeDraw.startX,
            y: shapeDraw.startY,
            width: 120,
            height: 120,
            rotation: 0,
            color: currentColor,
            radius: 60,
          };
        } else {
          const radius = Math.max(w, h) / 2;
          newObject = {
            id: crypto.randomUUID(),
            type: "circle",
            x: x + w / 2,
            y: y + h / 2,
            width: radius * 2,
            height: radius * 2,
            rotation: 0,
            color: currentColor,
            radius,
          };
        }
      } else if (shapeDraw.tool === "sticky") {
        const side = isClick ? 200 : Math.max(w, h);
        newObject = {
          id: crypto.randomUUID(),
          type: "sticky",
          x: isClick ? shapeDraw.startX : x,
          y: isClick ? shapeDraw.startY : y,
          width: side,
          height: side,
          rotation: 0,
          color: currentColor,
        };
      } else if (shapeDraw.tool === "line") {
        newObject = {
          id: crypto.randomUUID(),
          type: "line",
          x: shapeDraw.startX,
          y: shapeDraw.startY,
          width: 0,
          height: 0,
          rotation: 0,
          color: currentColor,
          points: isClick
            ? [0, 0, 200, 0]
            : [0, 0, shapeDraw.currentX - shapeDraw.startX, shapeDraw.currentY - shapeDraw.startY],
        };
      } else if (shapeDraw.tool === "text") {
        newObject = {
          id: crypto.randomUUID(),
          type: "text",
          x: isClick ? shapeDraw.startX : x,
          y: isClick ? shapeDraw.startY : y,
          width: isClick ? 200 : Math.max(w, 40),
          height: isClick ? 30 : Math.max(h, 20),
          rotation: 0,
          color: currentColor,
          fontSize: 16,
          text: "",
        };
      }

      if (newObject) {
        addObject(newObject);
        selectOne(newObject.id);
        if (shapeDraw.tool === "text") {
          pendingEditRef.current = newObject.id;
        }
      }

      setShapeDraw(null);
      setCurrentTool("select");
    }
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
      updateObject(id, {
        x: node.x(),
        y: node.y(),
        radius: Math.max(5, (node.width() * scaleX) / 2),
      });
    } else if (obj?.type === "text") {
      const newFontSize = Math.max(8, Math.round((obj.fontSize || 16) * scaleY));
      updateObject(id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(20, node.width() * scaleX),
        height: Math.max(16, node.height() * scaleY),
        fontSize: newFontSize,
      });
    } else if (obj?.type === "frame") {
      updateObject(id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(50, node.width() * scaleX),
        height: Math.max(50, node.height() * scaleY),
      });
    } else if (obj?.type === "sticky") {
      const newW = Math.max(50, node.width() * scaleX);
      const newH = Math.max(50, node.height() * scaleY);
      const size = Math.max(newW, newH);
      updateObject(id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: size,
        height: size,
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

  // ── Object rendering ────────────────────────────────────────────────────────

  const renderObject = (obj: BoardObject) => {
    const isSelected = selectedIds.has(obj.id);

    const shapeRef = (node: Konva.Node | null) => {
      if (node) {
        objectNodesRef.current.set(obj.id, node);
      } else {
        objectNodesRef.current.delete(obj.id);
      }
    };

    const onSelect =
      currentTool === "connector"
        ? () => handleConnectorObjectClick(obj.id)
        : () => {
            if (shiftHeldRef.current) {
              toggleSelection(obj.id);
            } else {
              selectOne(obj.id);
            }
          };

    const commonProps = {
      object: obj,
      isSelected,
      onSelect,
      onDragStart: () => handleMultiDragStart(obj.id),
      onDragMove: (e: KonvaEventObject<DragEvent>) => handleMultiDragMove(obj.id, e),
      onDragEnd: (e: KonvaEventObject<DragEvent>) => handleMultiDragEnd(obj.id, e),
    };

    switch (obj.type) {
      case "sticky":
        return (
          <StickyNote
            key={obj.id}
            ref={shapeRef}
            {...commonProps}
            isEditing={editingNoteId === obj.id}
            onStartEdit={() => {
              selectOne(obj.id);
              setEditingNoteId(obj.id);
              setEditingText(obj.text || "");
            }}
          />
        );

      case "rectangle":
        return (
          <RectShape
            key={obj.id}
            ref={shapeRef}
            {...commonProps}
            isEditing={editingNoteId === obj.id}
            onStartEdit={() => {
              selectOne(obj.id);
              setEditingNoteId(obj.id);
              setEditingText(obj.text || "");
            }}
          />
        );

      case "circle":
        return (
          <CircleShape
            key={obj.id}
            ref={shapeRef}
            {...commonProps}
            isEditing={editingNoteId === obj.id}
            onStartEdit={() => {
              selectOne(obj.id);
              setEditingNoteId(obj.id);
              setEditingText(obj.text || "");
            }}
          />
        );

      case "line": {
        const pts = obj.points || [0, 0, 200, 0];
        const anchorR = 7 / viewport.stageScale;
        const anchorStroke = 2 / viewport.stageScale;

        return (
          <Fragment key={obj.id}>
            <LineShape
              {...commonProps}
              ref={shapeRef}
              isEditing={editingNoteId === obj.id}
              onStartEdit={() => {
                selectOne(obj.id);
                setEditingNoteId(obj.id);
                setEditingText(obj.text || "");
              }}
            />
            {isSelected && (
              <>
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

      case "text":
        return (
          <TextElement
            key={obj.id}
            {...commonProps}
            ref={shapeRef}
            isEditing={editingNoteId === obj.id}
            onStartEdit={() => {
              selectOne(obj.id);
              setEditingNoteId(obj.id);
              setEditingText(obj.text || "");
            }}
          />
        );

      case "frame":
        return (
          <Frame
            key={obj.id}
            object={obj}
            isSelected={isSelected}
            isEditing={editingNoteId === obj.id}
            onSelect={onSelect}
            onDragStart={() => {
              handleFrameDragStart(obj);
              handleMultiDragStart(obj.id);
            }}
            onDragMove={(e) => {
              handleFrameDragMove(e);
              handleMultiDragMove(obj.id, e);
            }}
            onDragEnd={(e) => {
              handleFrameDragEnd(obj.id, e);
              // Multi-drag end for other selected objects (frame already persisted above)
              if (multiDragRef.current && multiDragRef.current.draggedId === obj.id) {
                const startObj = objects.find((o) => o.id === obj.id);
                if (startObj) {
                  const dx = e.target.x() - startObj.x;
                  const dy = e.target.y() - startObj.y;
                  for (const [sid, startPos] of multiDragRef.current.startPositions) {
                    // Skip the frame itself (already updated) and frame-contained objects (already updated by frameDragEnd)
                    if (sid === obj.id) continue;
                    if (frameDragRef.current?.containedIds.includes(sid)) continue;
                    updateObject(sid, { x: startPos.x + dx, y: startPos.y + dy });
                  }
                }
                multiDragRef.current = null;
              }
            }}
            onStartEdit={() => {
              selectOne(obj.id);
              setEditingNoteId(obj.id);
              setEditingText(obj.text || "Frame");
            }}
            ref={shapeRef}
          />
        );

      case "connector":
        return (
          <ConnectorShape
            key={obj.id}
            connector={obj}
            objects={objects.map(getLiveObjectData)}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        );

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

  const renderConnectorPreview = () => {
    if (!pendingConnectorFrom || !connectorMousePos) return null;
    const fromObj = objects.find((o) => o.id === pendingConnectorFrom);
    if (!fromObj) return null;
    const from = getObjectCenter(fromObj);
    return (
      <Arrow
        points={[from.x, from.y, connectorMousePos.x, connectorMousePos.y]}
        stroke="#3b82f6"
        strokeWidth={2 / viewport.stageScale}
        fill="#3b82f6"
        pointerLength={10 / viewport.stageScale}
        pointerWidth={8 / viewport.stageScale}
        dash={[8 / viewport.stageScale, 4 / viewport.stageScale]}
        opacity={0.6}
        listening={false}
        strokeScaleEnabled={false}
      />
    );
  };

  const renderFrameDrawPreview = () => {
    if (!frameDraw) return null;
    const x = Math.min(frameDraw.startX, frameDraw.currentX);
    const y = Math.min(frameDraw.startY, frameDraw.currentY);
    const w = Math.abs(frameDraw.currentX - frameDraw.startX);
    const h = Math.abs(frameDraw.currentY - frameDraw.startY);
    if (w < 2 && h < 2) return null;
    return (
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="rgba(59, 130, 246, 0.06)"
        stroke="#3b82f6"
        strokeWidth={1.5 / viewport.stageScale}
        dash={[6 / viewport.stageScale, 4 / viewport.stageScale]}
        listening={false}
        strokeScaleEnabled={false}
      />
    );
  };

  const renderShapeDrawPreview = () => {
    if (!shapeDraw) return null;
    const w = Math.abs(shapeDraw.currentX - shapeDraw.startX);
    const h = Math.abs(shapeDraw.currentY - shapeDraw.startY);
    if (w < 2 && h < 2) return null;
    const x = Math.min(shapeDraw.startX, shapeDraw.currentX);
    const y = Math.min(shapeDraw.startY, shapeDraw.currentY);
    const dashPattern = [6 / viewport.stageScale, 4 / viewport.stageScale];
    const sw = 1.5 / viewport.stageScale;

    if (shapeDraw.tool === "rectangle" || shapeDraw.tool === "text") {
      return (
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="rgba(59, 130, 246, 0.08)"
          stroke={shapeDraw.tool === "text" ? "#3b82f6" : currentColor}
          strokeWidth={sw}
          dash={dashPattern}
          listening={false}
          strokeScaleEnabled={false}
        />
      );
    }

    if (shapeDraw.tool === "sticky") {
      const side = Math.max(w, h);
      return (
        <Rect
          x={x}
          y={y}
          width={side}
          height={side}
          fill={currentColor + "40"}
          stroke={currentColor}
          strokeWidth={sw}
          dash={dashPattern}
          cornerRadius={8}
          listening={false}
          strokeScaleEnabled={false}
        />
      );
    }

    if (shapeDraw.tool === "circle") {
      return (
        <Ellipse
          x={x + w / 2}
          y={y + h / 2}
          radiusX={w / 2}
          radiusY={h / 2}
          fill="rgba(59, 130, 246, 0.08)"
          stroke={currentColor}
          strokeWidth={sw}
          dash={dashPattern}
          listening={false}
          strokeScaleEnabled={false}
        />
      );
    }

    if (shapeDraw.tool === "line") {
      return (
        <Line
          points={[shapeDraw.startX, shapeDraw.startY, shapeDraw.currentX, shapeDraw.currentY]}
          stroke={currentColor}
          strokeWidth={sw}
          dash={dashPattern}
          listening={false}
          strokeScaleEnabled={false}
        />
      );
    }

    return null;
  };

  const renderMarqueePreview = () => {
    if (!marquee) return null;
    const x = Math.min(marquee.startX, marquee.currentX);
    const y = Math.min(marquee.startY, marquee.currentY);
    const w = Math.abs(marquee.currentX - marquee.startX);
    const h = Math.abs(marquee.currentY - marquee.startY);
    if (w < 2 && h < 2) return null;
    return (
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="rgba(59, 130, 246, 0.08)"
        stroke="#3b82f6"
        strokeWidth={1 / viewport.stageScale}
        dash={[6 / viewport.stageScale, 3 / viewport.stageScale]}
        listening={false}
        strokeScaleEnabled={false}
      />
    );
  };

  // Derived values
  const editingNote = editingNoteId
    ? objects.find((o) => o.id === editingNoteId)
    : null;

  const selectedConnector = (() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return objects.find((o) => o.id === id && o.type === "connector") ?? null;
  })();

  // Render order: frames (behind) → connectors → everything else (on top)
  const frames = objects.filter((o) => o.type === "frame");
  const connectors = objects.filter((o) => o.type === "connector");
  const shapes = objects.filter((o) => o.type !== "connector" && o.type !== "frame");

  return (
    <>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable={currentTool === "select" && !marquee}
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
        onMouseUp={handleStageMouseUp}
      >
        <Layer listening={false}>{renderDotGrid()}</Layer>
        <Layer>
          {frames.map(renderObject)}
          {connectors.map(renderObject)}
          {renderConnectorPreview()}
          {renderFrameDrawPreview()}
          {renderShapeDrawPreview()}
          {renderMarqueePreview()}
          {shapes.map(renderObject)}
          <Transformer
            ref={transformerRef}
            rotateEnabled={(() => {
              if (selectedIds.size !== 1) return false;
              const t = objects.find((o) => selectedIds.has(o.id))?.type;
              return t !== "circle" && t !== "frame";
            })()}
            keepRatio={(() => {
              if (selectedIds.size !== 1) return false;
              const t = objects.find((o) => selectedIds.has(o.id))?.type;
              return t === "circle" || t === "sticky";
            })()}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
            }
            onTransform={() => setTransformTick((t) => t + 1)}
            onTransformEnd={() => {
              const tr = transformerRef.current;
              if (!tr) return;
              for (const node of tr.nodes()) {
                const id = findIdByNode(node);
                if (id) handleTransformEnd(id, node);
              }
            }}
          />
        </Layer>
        <CursorOverlay
          otherUsers={presence.otherUsers}
          stageScale={viewport.stageScale}
        />
      </Stage>

      {/* Sticky note textarea overlay */}
      {editingNote && editingNote.type === "sticky" && (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={saveNoteText}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditingNoteId(null);
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
            color: contrastText(editingNote.color),
            zIndex: 1000,
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Text element textarea overlay */}
      {editingNote && editingNote.type === "text" && (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={saveNoteText}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditingNoteId(null);
          }}
          style={{
            position: "fixed",
            left: `${editingNote.x * viewport.stageScale + viewport.stagePos.x}px`,
            top: `${editingNote.y * viewport.stageScale + viewport.stagePos.y}px`,
            width: `${editingNote.width * viewport.stageScale}px`,
            minHeight: `${(editingNote.fontSize || 16) * viewport.stageScale * 1.5}px`,
            fontSize: `${(editingNote.fontSize || 16) * viewport.stageScale}px`,
            lineHeight: "1.2",
            padding: "0",
            border: "2px solid #3b82f6",
            borderRadius: "2px",
            outline: "none",
            resize: "none",
            fontFamily: "sans-serif",
            backgroundColor: "transparent",
            color: editingNote.color || "#374151",
            zIndex: 1000,
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Frame title editing overlay */}
      {editingNote && editingNote.type === "frame" && (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={saveNoteText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveNoteText();
            }
            if (e.key === "Escape") setEditingNoteId(null);
          }}
          rows={1}
          style={{
            position: "fixed",
            left: `${(editingNote.x + 6) * viewport.stageScale + viewport.stagePos.x}px`,
            top: `${(editingNote.y + 6) * viewport.stageScale + viewport.stagePos.y}px`,
            width: `${Math.max(120, editingNote.width * 0.5) * viewport.stageScale}px`,
            height: `${22 * viewport.stageScale}px`,
            fontSize: `${14 * viewport.stageScale}px`,
            fontWeight: "bold",
            padding: "2px 4px",
            border: "2px solid #3b82f6",
            borderRadius: "3px",
            outline: "none",
            resize: "none",
            fontFamily: "sans-serif",
            backgroundColor: "white",
            color: "#64748b",
            zIndex: 1000,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        />
      )}

      {/* Rectangle textarea overlay */}
      {editingNote && editingNote.type === "rectangle" && (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={saveNoteText}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditingNoteId(null);
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
            backgroundColor: "transparent",
            color: contrastText(editingNote.color),
            zIndex: 1000,
            boxSizing: "border-box",
            textAlign: "center",
          }}
        />
      )}

      {/* Circle textarea overlay */}
      {editingNote && editingNote.type === "circle" && (() => {
        const r = editingNote.radius || 60;
        const innerSize = r * 1.4;
        return (
          <textarea
            ref={textareaRef}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={saveNoteText}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingNoteId(null);
            }}
            style={{
              position: "fixed",
              left: `${(editingNote.x - innerSize / 2) * viewport.stageScale + viewport.stagePos.x}px`,
              top: `${(editingNote.y - innerSize / 2) * viewport.stageScale + viewport.stagePos.y}px`,
              width: `${innerSize * viewport.stageScale}px`,
              height: `${innerSize * viewport.stageScale}px`,
              fontSize: `${14 * viewport.stageScale}px`,
              padding: "8px",
              border: "2px solid #3b82f6",
              borderRadius: "50%",
              outline: "none",
              resize: "none",
              fontFamily: "sans-serif",
              backgroundColor: "transparent",
              color: contrastText(editingNote.color),
              zIndex: 1000,
              boxSizing: "border-box",
              textAlign: "center",
            }}
          />
        );
      })()}

      {/* Line textarea overlay */}
      {editingNote && editingNote.type === "line" && (() => {
        const pts = editingNote.points || [0, 0, 200, 0];
        const midX = editingNote.x + (pts[0] + pts[2]) / 2;
        const midY = editingNote.y + (pts[1] + pts[3]) / 2;
        const overlayWidth = 140;
        return (
          <textarea
            ref={textareaRef}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={saveNoteText}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingNoteId(null);
            }}
            style={{
              position: "fixed",
              left: `${(midX - overlayWidth / 2) * viewport.stageScale + viewport.stagePos.x}px`,
              top: `${(midY - 30) * viewport.stageScale + viewport.stagePos.y}px`,
              width: `${overlayWidth * viewport.stageScale}px`,
              height: `${30 * viewport.stageScale}px`,
              fontSize: `${13 * viewport.stageScale}px`,
              padding: "4px 8px",
              border: "2px solid #3b82f6",
              borderRadius: "4px",
              outline: "none",
              resize: "none",
              fontFamily: "sans-serif",
              backgroundColor: "white",
              color: "#374151",
              zIndex: 1000,
              boxSizing: "border-box",
              textAlign: "center",
            }}
          />
        );
      })()}

      {/* Connector properties panel */}
      {selectedConnector && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 select-none pr-1">Connector:</span>
          <button
            onClick={() =>
              updateObject(selectedConnector.id, {
                style: {
                  lineStyle: selectedConnector.style?.lineStyle === "dashed" ? "solid" : "dashed",
                  arrowHead: selectedConnector.style?.arrowHead ?? true,
                },
              })
            }
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              selectedConnector.style?.lineStyle === "dashed"
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
            }`}
          >
            Dashed
          </button>
          <button
            onClick={() =>
              updateObject(selectedConnector.id, {
                style: {
                  lineStyle: selectedConnector.style?.lineStyle ?? "solid",
                  arrowHead: !(selectedConnector.style?.arrowHead ?? true),
                },
              })
            }
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              selectedConnector.style?.arrowHead !== false
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
            }`}
          >
            Arrow
          </button>
        </div>
      )}

      {/* Connector mode hint */}
      {currentTool === "connector" && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-lg pointer-events-none">
          {pendingConnectorFrom
            ? "Click the target object — or click empty space to cancel"
            : "Click a source object to start a connector"}
        </div>
      )}

      {/* Frame mode hint */}
      {currentTool === "frame" && !frameDraw && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-lg pointer-events-none">
          Click and drag to draw a frame
        </div>
      )}
    </>
  );
}
