import { useEffect, useState } from "react";
import type { UserPresence } from "../../hooks/usePresence";

interface PresenceBarProps {
  allUsers: UserPresence[];
  currentUserId: string;
}

const STALE_MS = 30_000;

export function PresenceBar({ allUsers, currentUserId }: PresenceBarProps) {
  // Re-render every 10s to evict stale users even without a Firestore update
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();
  const activeUsers = allUsers.filter((u) => {
    if (!u.lastSeen) return false;
    return now - u.lastSeen.toMillis() < STALE_MS;
  });

  if (activeUsers.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
      {activeUsers.map((user) => {
        const isYou = user.userId === currentUserId;
        return (
          <div key={user.userId} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: user.cursorColor }}
            />
            <span className="text-xs text-gray-700 font-medium whitespace-nowrap max-w-[80px] truncate">
              {isYou ? "You" : user.displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
