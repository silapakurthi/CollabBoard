import type { ToolType } from "../../hooks/useFirestore";

interface ToolbarProps {
  currentTool: ToolType;
  currentColor: string;
  hasSelection: boolean;
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
}

const colors = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "White", value: "#ffffff" },
  { name: "Gray", value: "#e5e7eb" },
];

export function Toolbar({
  currentTool,
  currentColor,
  hasSelection,
  onToolChange,
  onColorChange,
  onDelete,
}: ToolbarProps) {
  const toolButton = (tool: ToolType, label: string, icon: string) => (
    <button
      onClick={() => onToolChange(tool)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        currentTool === tool
          ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
      }`}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Tool buttons */}
        <div className="flex gap-2">
          {toolButton("select", "Select", "↖")}
          {toolButton("sticky", "Sticky Note", "📝")}
          {toolButton("rectangle", "Rectangle", "▭")}
          {toolButton("circle", "Circle", "⭕")}
          {toolButton("line", "Line", "—")}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-300" />

        {/* Color picker */}
        <div className="flex gap-1.5">
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => onColorChange(color.value)}
              className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${
                currentColor === color.value
                  ? "border-blue-500 scale-110"
                  : "border-gray-300"
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
              aria-label={color.name}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-300" />

        {/* Delete button */}
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasSelection
              ? "bg-red-50 text-red-700 border border-red-300 hover:bg-red-100"
              : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
          }`}
          title="Delete (Del)"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
