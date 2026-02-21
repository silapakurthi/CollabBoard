import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { BoardPreview } from "./BoardPreview";

interface Board {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date | null;
}

export function BoardList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const boardsCol = collection(db, "boards");
    const q = query(boardsCol, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Board[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Untitled Board",
          createdBy: data.createdBy || "",
          createdAt: data.createdAt?.toDate() ?? null,
        };
      });
      setBoards(list);
      setLoadingBoards(false);
    });

    return unsubscribe;
  }, []);

  // Focus the input when it appears
  useEffect(() => {
    if (showNameInput) nameInputRef.current?.focus();
  }, [showNameInput]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleCreateBoard = async () => {
    const name = newBoardName.trim() || "Untitled Board";
    const boardId = crypto.randomUUID();
    setShowNameInput(false);
    setNewBoardName("");
    await setDoc(doc(db, "boards", boardId), {
      name,
      createdBy: user?.uid ?? "",
      createdAt: serverTimestamp(),
    });
    navigate(`/board/${boardId}`);
  };

  const handleCancelCreate = () => {
    setShowNameInput(false);
    setNewBoardName("");
  };

  const handleCreateDemoBoard = async () => {
    const boardId = crypto.randomUUID();
    const uid = user?.uid ?? "";

    await setDoc(doc(db, "boards", boardId), {
      name: "Demo Board",
      createdBy: uid,
      createdAt: serverTimestamp(),
    });

    const colors = ["#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#ffffff", "#dc2626", "#1e3a5f", "#047857", "#7c3aed", "#374151"];
    const pick = () => colors[Math.floor(Math.random() * colors.length)];
    const id = () => crypto.randomUUID();

    // Frame
    const frameId = id();
    const frame = { id: frameId, type: "frame" as const, x: 80, y: 60, width: 520, height: 420, rotation: 0, color: "#e0e7ff", text: "Feature Brainstorm" };

    // Objects inside the frame
    const sticky1Id = id();
    const sticky1 = { id: sticky1Id, type: "sticky" as const, x: 120, y: 120, width: 180, height: 180, rotation: 0, color: "#fef08a", text: "User onboarding flow needs rework" };

    const sticky2Id = id();
    const sticky2 = { id: sticky2Id, type: "sticky" as const, x: 360, y: 120, width: 200, height: 200, rotation: 0, color: "#fbcfe8", text: "Add dark mode toggle" };

    const rect1Id = id();
    const rect1 = { id: rect1Id, type: "rectangle" as const, x: 120, y: 340, width: 180, height: 100, rotation: 0, color: "#bfdbfe", text: "Phase 1: Research" };

    const rect2Id = id();
    const rect2 = { id: rect2Id, type: "rectangle" as const, x: 360, y: 340, width: 180, height: 100, rotation: 0, color: "#047857", text: "Phase 2: Build" };

    // Connectors inside the frame
    const conn1 = { id: id(), type: "connector" as const, x: 0, y: 0, width: 0, height: 0, rotation: 0, color: "#374151", connectedFrom: sticky1Id, connectedTo: rect1Id, style: { lineStyle: "solid" as const, arrowHead: true } };
    const conn2 = { id: id(), type: "connector" as const, x: 0, y: 0, width: 0, height: 0, rotation: 0, color: "#374151", connectedFrom: sticky2Id, connectedTo: rect2Id, style: { lineStyle: "dashed" as const, arrowHead: true } };
    const conn3 = { id: id(), type: "connector" as const, x: 0, y: 0, width: 0, height: 0, rotation: 0, color: "#7c3aed", connectedFrom: rect1Id, connectedTo: rect2Id, style: { lineStyle: "solid" as const, arrowHead: true } };

    // Objects outside the frame
    const circle1Id = id();
    const circle1 = { id: circle1Id, type: "circle" as const, x: 780, y: 180, width: 140, height: 140, rotation: 0, radius: 70, color: "#dc2626", text: "Priority" };

    const circle2Id = id();
    const circle2 = { id: circle2Id, type: "circle" as const, x: 780, y: 400, width: 100, height: 100, rotation: 0, radius: 50, color: "#bbf7d0", text: "Done" };

    const rect3Id = id();
    const rect3 = { id: rect3Id, type: "rectangle" as const, x: 660, y: 540, width: 200, height: 80, rotation: 0, color: "#1e3a5f", text: "Backend API" };

    const sticky3Id = id();
    const sticky3 = { id: sticky3Id, type: "sticky" as const, x: 920, y: 100, width: 200, height: 200, rotation: 0, color: "#7c3aed", text: "Need to discuss at next standup" };

    const text1 = { id: id(), type: "text" as const, x: 80, y: 520, width: 260, height: 30, rotation: 0, color: "#374151", text: "Last updated: today", fontSize: 16 };

    const line1 = { id: id(), type: "line" as const, x: 660, y: 520, width: 0, height: 0, rotation: 0, color: pick(), points: [0, 0, 200, 0], text: "depends on" };

    // More connectors outside
    const conn4 = { id: id(), type: "connector" as const, x: 0, y: 0, width: 0, height: 0, rotation: 0, color: "#dc2626", connectedFrom: circle1Id, connectedTo: circle2Id, style: { lineStyle: "solid" as const, arrowHead: true } };
    const conn5 = { id: id(), type: "connector" as const, x: 0, y: 0, width: 0, height: 0, rotation: 0, color: "#1e3a5f", connectedFrom: circle2Id, connectedTo: rect3Id, style: { lineStyle: "dashed" as const, arrowHead: false } };

    // Scattered extras with random colors
    const extras = [
      { id: id(), type: "sticky" as const, x: 920, y: 360, width: 160, height: 160, rotation: 0, color: pick(), text: "Design mockups" },
      { id: id(), type: "rectangle" as const, x: 130, y: 540, width: 140, height: 70, rotation: 0, color: pick(), text: "Milestone" },
      { id: id(), type: "circle" as const, x: 450, y: 560, width: 80, height: 80, rotation: 0, radius: 40, color: pick(), text: "Q2" },
    ];

    const allObjects = [
      frame, sticky1, sticky2, rect1, rect2,
      conn1, conn2, conn3,
      circle1, circle2, rect3, sticky3, text1, line1,
      conn4, conn5,
      ...extras,
    ];

    const objectsCol = `boards/${boardId}/objects`;
    await Promise.all(
      allObjects.map((obj) => {
        const { id: objId, ...data } = obj;
        return setDoc(doc(db, objectsCol, objId), {
          ...data,
          lastEditedBy: uid,
          updatedAt: serverTimestamp(),
        });
      })
    );

    navigate(`/board/${boardId}`);
  };

  const handleDeleteBoard = async (boardId: string) => {
    setDeletingId(boardId);
    setConfirmDeleteId(null);
    try {
      // Delete subcollections first (Firestore doesn't cascade-delete them)
      const [objectsSnap, presenceSnap] = await Promise.all([
        getDocs(collection(db, `boards/${boardId}/objects`)),
        getDocs(collection(db, `boards/${boardId}/presence`)),
      ]);
      await Promise.allSettled([
        ...objectsSnap.docs.map((d) => deleteDoc(d.ref)),
        ...presenceSnap.docs.map((d) => deleteDoc(d.ref)),
      ]);
      // Delete the board document itself
      await deleteDoc(doc(db, "boards", boardId));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllBoards = async () => {
    setConfirmDeleteAll(false);
    setDeletingAll(true);
    try {
      await Promise.all(boards.map((board) => handleDeleteBoard(board.id)));
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {user?.displayName || "User"}!
            </h1>
            <p className="text-gray-600 mt-1">
              {loadingBoards
                ? "Loading boards..."
                : `${boards.length} board${boards.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="mb-6">
          {showNameInput ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBoard();
                  if (e.key === "Escape") handleCancelCreate();
                }}
                placeholder="Board name..."
                maxLength={80}
                className="px-4 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
              <button
                onClick={handleCreateBoard}
                className="px-5 py-2 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Create
              </button>
              <button
                onClick={handleCancelCreate}
                className="px-4 py-2 text-base font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setShowNameInput(true)}
                className="px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                + Create New Board
              </button>
              <button
                onClick={handleCreateDemoBoard}
                className="px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Create Demo Board
              </button>
              {boards.length > 0 && (
                confirmDeleteAll ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600 font-medium">
                      Delete all {boards.length} board{boards.length !== 1 ? "s" : ""}?
                    </span>
                    <button
                      onClick={handleDeleteAllBoards}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteAll(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteAll(true)}
                    disabled={deletingAll}
                    className="px-6 py-3 text-base font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                  >
                    {deletingAll ? "Deleting..." : "Delete All Boards"}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {loadingBoards ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : boards.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg">No boards yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {boards.map((board) => (
              <div key={board.id} className="relative">
                {confirmDeleteId === board.id ? (
                  /* Inline delete confirmation */
                  <div className="bg-white rounded-lg shadow-md p-6 border border-red-200 h-full flex flex-col justify-between">
                    <p className="text-sm font-medium text-gray-800 mb-4">
                      Delete "{board.name}"? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteBoard(board.id)}
                        className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link
                      to={`/board/${board.id}`}
                      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100 block overflow-hidden"
                    >
                      <BoardPreview boardId={board.id} />
                      <div className="px-4 py-3">
                        <h2 className="text-lg font-semibold text-gray-900 truncate pr-6">
                          {board.name}
                        </h2>
                        {board.createdAt && (
                          <p className="text-sm text-gray-500 mt-1">
                            {board.createdAt.toLocaleDateString()}
                          </p>
                        )}
                        {deletingId === board.id && (
                          <p className="text-xs text-red-500 mt-1">Deleting…</p>
                        )}
                      </div>
                    </Link>
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmDeleteId(board.id);
                      }}
                      title="Delete board"
                      className="absolute top-3 right-3 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
