import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";

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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleCreateBoard = async () => {
    const boardId = crypto.randomUUID();
    await setDoc(doc(db, "boards", boardId), {
      name: "Untitled Board",
      createdBy: user?.uid ?? "",
      createdAt: serverTimestamp(),
    });
    navigate(`/board/${boardId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {user?.displayName || "User"}!
            </h1>
            <p className="text-gray-600 mt-1">Manage your collaborative boards</p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="mb-6">
          <button
            onClick={handleCreateBoard}
            className="px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            + Create New Board
          </button>
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
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100 block"
              >
                <h2 className="text-lg font-semibold text-gray-900 truncate">{board.name}</h2>
                {board.createdAt && (
                  <p className="text-sm text-gray-500 mt-2">
                    {board.createdAt.toLocaleDateString()}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
