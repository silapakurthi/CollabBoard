import { useEffect, useRef, useCallback, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { db } from "../services/firebase";

const CURSOR_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f97316", // orange
  "#14b8a6", // teal
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

export interface UserPresence {
  userId: string;
  displayName: string;
  cursor: { x: number; y: number };
  cursorColor: string;
  lastSeen: Timestamp | null;
}

const STALE_CURSOR_MS = 60_000;
const THROTTLE_MS = 60;

export function usePresence(
  boardId: string,
  userId: string,
  displayName: string
) {
  const [allUsers, setAllUsers] = useState<UserPresence[]>([]);
  const lastSentRef = useRef(0);

  // Write initial presence document on mount, clean up on unmount
  useEffect(() => {
    if (!boardId || !userId) return;

    const ref = doc(db, `boards/${boardId}/presence`, userId);
    const cursorColor = getUserColor(userId);

    setDoc(ref, {
      displayName,
      cursor: { x: 0, y: 0 },
      cursorColor,
      lastSeen: serverTimestamp(),
    });

    const handleBeforeUnload = () => {
      deleteDoc(ref);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      deleteDoc(ref);
    };
  }, [boardId, userId, displayName]);

  // Keepalive: update lastSeen every 20s so the user stays active even without cursor movement
  useEffect(() => {
    if (!boardId || !userId) return;
    const ref = doc(db, `boards/${boardId}/presence`, userId);
    const interval = setInterval(() => {
      updateDoc(ref, { lastSeen: serverTimestamp() }).catch(() => {});
    }, 20_000);
    return () => clearInterval(interval);
  }, [boardId, userId]);

  // Subscribe to the presence collection
  useEffect(() => {
    if (!boardId) return;
    const presenceCol = collection(db, `boards/${boardId}/presence`);

    const unsubscribe = onSnapshot(presenceCol, (snapshot) => {
      const now = Date.now();
      const list: UserPresence[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            userId: d.id,
            displayName: data.displayName || "Anonymous",
            cursor: data.cursor || { x: 0, y: 0 },
            cursorColor: data.cursorColor || "#3b82f6",
            lastSeen: (data.lastSeen as Timestamp) ?? null,
          };
        })
        .filter((u) => {
          if (!u.lastSeen) return false;
          return now - u.lastSeen.toMillis() < STALE_CURSOR_MS;
        });

      setAllUsers(list);
    });

    return unsubscribe;
  }, [boardId]);

  // Throttled cursor update — call with world (canvas) coordinates
  const updateCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastSentRef.current < THROTTLE_MS) return;
      lastSentRef.current = now;

      const ref = doc(db, `boards/${boardId}/presence`, userId);
      updateDoc(ref, {
        cursor: { x, y },
      }).catch(() => {});
    },
    [boardId, userId]
  );

  const otherUsers = allUsers.filter((u) => u.userId !== userId);

  return { allUsers, otherUsers, updateCursor };
}
