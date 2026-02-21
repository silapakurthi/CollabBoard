import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocsFromServer,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";

export interface ConnectorStyle {
  lineStyle: "solid" | "dashed";
  arrowHead: boolean;
}

export interface BoardObject {
  id: string;
  type: "sticky" | "rectangle" | "circle" | "line" | "connector" | "text" | "frame";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  color: string;
  fontSize?: number;
  radius?: number;
  points?: number[];
  connectedFrom?: string;
  connectedTo?: string;
  style?: ConnectorStyle;
}

export type ToolType = "select" | "sticky" | "rectangle" | "circle" | "line" | "connector" | "text" | "frame";

export function useFirestore(boardId: string, userId: string) {
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) return;

    const objectsCol = collection(db, `boards/${boardId}/objects`);

    const unsubscribe = onSnapshot(objectsCol, (snapshot) => {
      const list: BoardObject[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<BoardObject, "id">),
      }));
      setObjects(list);
      setLoading(false);
    });

    return unsubscribe;
  }, [boardId]);

  const addObject = async (obj: BoardObject) => {
    const { id, ...data } = obj;
    await setDoc(doc(db, `boards/${boardId}/objects`, id), {
      ...data,
      lastEditedBy: userId,
      updatedAt: serverTimestamp(),
    });
  };

  const updateObject = async (id: string, updates: Partial<BoardObject>) => {
    await updateDoc(doc(db, `boards/${boardId}/objects`, id), {
      ...updates,
      lastEditedBy: userId,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteObject = async (id: string) => {
    await deleteDoc(doc(db, `boards/${boardId}/objects`, id));
  };

  /** Force-read all objects from Firestore server (bypasses local cache). */
  const refreshObjects = useCallback(async () => {
    if (!boardId) return;
    const objectsCol = collection(db, `boards/${boardId}/objects`);
    const snapshot = await getDocsFromServer(objectsCol);
    const list: BoardObject[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<BoardObject, "id">),
    }));
    setObjects(list);
  }, [boardId]);

  return { objects, addObject, updateObject, deleteObject, refreshObjects, loading };
}
