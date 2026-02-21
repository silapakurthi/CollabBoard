import { useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";

interface ViewportState {
  stagePos: { x: number; y: number };
  stageScale: number;
}

export function useBoard() {
  const [viewport, setViewport] = useState<ViewportState>({
    stagePos: { x: 0, y: 0 },
    stageScale: 1,
  });

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Calculate new scale
    const scaleBy = 1.05;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.1, Math.min(5, oldScale * (scaleBy ** direction)));

    // Calculate new position to zoom toward cursor
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setViewport({
      stagePos: newPos,
      stageScale: newScale,
    });
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    setViewport((prev) => ({
      ...prev,
      stagePos: { x: e.target.x(), y: e.target.y() },
    }));
  };

  /** Pan & zoom the viewport so all given bounds are visible with padding. */
  const fitToContent = (
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    screenWidth: number,
    screenHeight: number
  ) => {
    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;
    if (contentW <= 0 || contentH <= 0) return;

    const pad = 80;
    const scale = Math.min(
      (screenWidth - pad * 2) / contentW,
      (screenHeight - pad * 2) / contentH,
      1.5
    );
    const clampedScale = Math.max(0.1, Math.min(5, scale));

    setViewport({
      stageScale: clampedScale,
      stagePos: {
        x: -bounds.minX * clampedScale + (screenWidth - contentW * clampedScale) / 2,
        y: -bounds.minY * clampedScale + (screenHeight - contentH * clampedScale) / 2,
      },
    });
  };

  return {
    viewport,
    handlers: {
      onWheel: handleWheel,
      onDragEnd: handleDragEnd,
    },
    fitToContent,
  };
}
