import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
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
  const navigate = useNavigate();
  const { viewport, handlers } = useBoard();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentTool, setCurrentTool] = useState<ToolType>("select");
  const [currentColor, setCurrentColor] = useState("#fef08a");

  // Board name state
  const [boardName, setBoardName] = useState("Untitled Board");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameText, setEditingNameText] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { objects, addObject, updateObject, deleteObject, loading } =
    useFirestore(boardId ?? "", user?.uid ?? "");

  const { allUsers, otherUsers, updateCursor } = usePresence(
    boardId ?? "",
    user?.uid ?? "",
    user?.displayName ?? "Anonymous"
  );

  // Subscribe to board document for the name; redirect home if board is deleted
  useEffect(() => {
    if (!boardId) return;
    const boardRef = doc(db, "boards", boardId);
    const unsubscribe = onSnapshot(boardRef, (snap) => {
      if (!snap.exists()) {
        navigate("/");
      } else {
        setBoardName(snap.data().name || "Untitled Board");
      }
    });
    return unsubscribe;
  }, [boardId, navigate]);

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  const startEditingName = () => {
    setEditingNameText(boardName);
    setIsEditingName(true);
  };

  const saveboardName = async () => {
    const trimmed = editingNameText.trim() || "Untitled Board";
    setIsEditingName(false);
    if (trimmed === boardName) return;
    await updateDoc(doc(db, "boards", boardId ?? ""), { name: trimmed });
  };

  const zoomPercentage = Math.round(viewport.stageScale * 100);

  // Selection helpers
  const selectOne = (id: string) => setSelectedIds(new Set([id]));
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectMany = (ids: string[]) => setSelectedIds(new Set(ids));
  const clearSelection = () => setSelectedIds(new Set());

  // Prune stale selection IDs (e.g. objects deleted by other users)
  useEffect(() => {
    const validIds = new Set(objects.map((o) => o.id));
    setSelectedIds((prev) => {
      const pruned = new Set([...prev].filter((id) => validIds.has(id)));
      if (pruned.size !== prev.size) return pruned;
      return prev;
    });
  }, [objects]);

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    // Collect connectors attached to any selected object
    const connectorIds = new Set<string>();
    for (const id of selectedIds) {
      objects
        .filter(
          (o) =>
            o.type === "connector" &&
            (o.connectedFrom === id || o.connectedTo === id)
        )
        .forEach((c) => connectorIds.add(c.id));
    }
    for (const cid of connectorIds) deleteObject(cid);
    for (const id of selectedIds) deleteObject(id);
    clearSelection();
  };

  const objectState = {
    objects,
    selectedIds,
    currentTool,
    currentColor,
    selectOne,
    toggleSelection,
    selectMany,
    clearSelection,
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
      {/* Top bar: back + name | toolbar | presence */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-4 py-3 pointer-events-none">
        {/* Left: back + board name */}
        <div className="flex items-center gap-2 pointer-events-auto flex-shrink-0">
          <Link
            to="/"
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors whitespace-nowrap"
          >
            ← Boards
          </Link>
          <div className="h-5 w-px bg-gray-300" />
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editingNameText}
              onChange={(e) => setEditingNameText(e.target.value)}
              onBlur={saveboardName}
              onKeyDown={(e) => {
                if (e.key === "Enter") nameInputRef.current?.blur();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              maxLength={80}
              className="px-2 py-1 text-sm font-medium text-gray-900 bg-white border border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          ) : (
            <button
              onClick={startEditingName}
              title="Click to rename"
              className="px-2 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors max-w-[200px] truncate"
            >
              {boardName}
            </button>
          )}
        </div>

        {/* Center: toolbar */}
        <div className="flex-1 flex justify-center min-w-0 pointer-events-auto">
          <Toolbar
            currentTool={currentTool}
            currentColor={currentColor}
            hasSelection={selectedIds.size > 0}
            selectionCount={selectedIds.size}
            onToolChange={setCurrentTool}
            onColorChange={setCurrentColor}
            onDelete={handleDelete}
          />
        </div>

        {/* Right: presence */}
        <div className="flex-shrink-0 pointer-events-auto">
          <PresenceBar allUsers={allUsers} currentUserId={user?.uid ?? ""} />
        </div>
      </div>

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
