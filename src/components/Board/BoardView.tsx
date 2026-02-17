import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Canvas } from "./Canvas";
import { Toolbar } from "../Toolbar/Toolbar";
import { PresenceBar } from "../Presence/PresenceBar";
import { useBoard } from "../../hooks/useBoard";
import { useFirestore } from "../../hooks/useFirestore";
import { usePresence } from "../../hooks/usePresence";
import { useAuth } from "../../context/AuthContext";
import type { ToolType } from "../../hooks/useFirestore";

export function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user } = useAuth();
  const { viewport, handlers } = useBoard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>("select");
  const [currentColor, setCurrentColor] = useState("#fef08a");

  const { objects, addObject, updateObject, deleteObject, loading } =
    useFirestore(boardId ?? "", user?.uid ?? "");

  const { allUsers, otherUsers, updateCursor } = usePresence(
    boardId ?? "",
    user?.uid ?? "",
    user?.displayName ?? "Anonymous"
  );

  const zoomPercentage = Math.round(viewport.stageScale * 100);

  const handleDelete = () => {
    if (selectedId) {
      deleteObject(selectedId);
      setSelectedId(null);
    }
  };

  const objectState = {
    objects,
    selectedId,
    currentTool,
    currentColor,
    setSelectedId,
    setCurrentTool,
    setCurrentColor,
    addObject,
    updateObject,
    deleteObject,
  };

  const presenceState = { otherUsers, updateCursor };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-white">
      {/* Back to boards link */}
      <Link
        to="/"
        className="absolute top-4 left-4 z-10 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        ← Back to boards
      </Link>

      {/* Who's online */}
      <PresenceBar allUsers={allUsers} currentUserId={user?.uid ?? ""} />

      {/* Toolbar */}
      <Toolbar
        currentTool={currentTool}
        currentColor={currentColor}
        hasSelection={selectedId !== null}
        onToolChange={setCurrentTool}
        onColorChange={setCurrentColor}
        onDelete={handleDelete}
      />

      {/* Canvas */}
      <Canvas
        viewport={viewport}
        handlers={handlers}
        objectState={objectState}
        presence={presenceState}
      />

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 z-10 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm">
        {zoomPercentage}%
      </div>
    </div>
  );
}
