import { useState, useRef } from "react";
import type { CommandHistoryEntry } from "../../hooks/useAI";

interface AICommandInputProps {
  boardId: string;
  boardState: Array<Record<string, unknown>>;
  onSendCommand: (
    boardId: string,
    command: string,
    boardState: Array<Record<string, unknown>>
  ) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  commandHistory: CommandHistoryEntry[];
}

export function AICommandInput({
  boardId,
  boardState,
  onSendCommand,
  isLoading,
  error,
  commandHistory,
}: AICommandInputProps) {
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const command = input.trim();
    setInput("");
    await onSendCommand(boardId, command, boardState);
  };

  return (
    <div className="absolute bottom-4 left-4 right-20 z-10 pointer-events-auto max-w-2xl">
      {/* History panel */}
      {showHistory && commandHistory.length > 0 && (
        <div className="mb-2 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
          {commandHistory.slice(0, 5).map((entry, i) => (
            <div
              key={i}
              className="text-sm border-b border-gray-100 pb-2 last:border-0"
            >
              <div className="font-medium text-gray-800">{entry.command}</div>
              <div className="text-gray-500 text-xs mt-1">{entry.result}</div>
              <div className="text-gray-400 text-xs">
                {entry.actions.length} action(s) &middot;{" "}
                {entry.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg shadow-lg px-3 py-2"
      >
        {/* History toggle */}
        {commandHistory.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0"
            title="Toggle command history"
          >
            {showHistory ? "\u25BC" : "\u25B2"}
          </button>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI to modify the board..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-50"
        />

        {/* Loading spinner / Submit button */}
        {isLoading ? (
          <div className="flex-shrink-0 w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex-shrink-0 px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
