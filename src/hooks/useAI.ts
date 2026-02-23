import { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

export interface CommandHistoryEntry {
  command: string;
  result: string;
  timestamp: Date;
  actions: Array<{
    tool: string;
    input: Record<string, unknown>;
    objectId?: string;
  }>;
}

const FUNCTIONS_BASE =
  import.meta.env.VITE_FUNCTIONS_URL ||
  `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

export function useAI() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>(
    []
  );
  const [lastCommandId, setLastCommandId] = useState(0);

  const sendCommand = useCallback(
    async (
      boardId: string,
      command: string,
      boardState: Array<Record<string, unknown>>
    ) => {
      if (!user) {
        setError("You must be signed in to use AI commands.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await user.getIdToken();

        const response = await fetch(`${FUNCTIONS_BASE}/boardAgent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ boardId, command, boardState }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Request failed with status ${response.status}`
          );
        }

        const result = await response.json();

        setCommandHistory((prev) =>
          [
            {
              command,
              result: result.summary,
              timestamp: new Date(),
              actions: result.actions,
            },
            ...prev,
          ].slice(0, 20)
        );
        setLastCommandId((n) => n + 1);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to execute AI command.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  return { sendCommand, isLoading, error, commandHistory, lastCommandId };
}
