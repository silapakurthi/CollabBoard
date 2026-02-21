import type { ToolType, ConnectorStyle } from "../../hooks/useFirestore";

interface ToolbarProps {
  currentTool: ToolType;
  currentColor: string;
  hasSelection: boolean;
  selectionCount?: number;
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onColorChangeSelected?: (color: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  connectorStyle?: ConnectorStyle;
  onConnectorStyleChange?: (style: ConnectorStyle) => void;
}

const colors = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "White", value: "#ffffff" },
  { name: "Red", value: "#dc2626" },
  { name: "Navy", value: "#1e3a5f" },
  { name: "Emerald", value: "#047857" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Charcoal", value: "#374151" },
];

export function Toolbar({
  currentTool,
  currentColor,
  hasSelection,
  selectionCount,
  onToolChange,
  onColorChange,
  onColorChangeSelected,
  onDuplicate,
  onDelete,
  connectorStyle,
  onConnectorStyleChange,
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
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Tool buttons */}
        <div className="flex gap-2">
          {toolButton("select", "Select", "↖")}
          {toolButton("sticky", "Sticky Note", "📝")}
          {toolButton("rectangle", "Rectangle", "▭")}
          {toolButton("circle", "Circle", "⭕")}
          {toolButton("line", "Line", "—")}
          {toolButton("text", "Text", "T")}
          {toolButton("connector", "Connector (click source then target)", "⤳")}
          {toolButton("frame", "Frame (click and drag)", "▢")}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-300" />

        {/* Color picker */}
        <div className="flex gap-1.5">
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => {
                onColorChange(color.value);
                if (hasSelection && onColorChangeSelected) {
                  onColorChangeSelected(color.value);
                }
              }}
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

        {/* Connector style controls (shown when a connector is selected) */}
        {connectorStyle && onConnectorStyleChange && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500 select-none">Line:</span>
              <button
                onClick={() =>
                  onConnectorStyleChange({
                    ...connectorStyle,
                    lineStyle: connectorStyle.lineStyle === "dashed" ? "solid" : "dashed",
                  })
                }
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  connectorStyle.lineStyle === "dashed"
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                }`}
                title="Toggle dashed line"
              >
                {connectorStyle.lineStyle === "dashed" ? "- - -" : "---"}
              </button>
              <button
                onClick={() =>
                  onConnectorStyleChange({
                    ...connectorStyle,
                    arrowHead: !connectorStyle.arrowHead,
                  })
                }
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  connectorStyle.arrowHead
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                }`}
                title="Toggle arrow head"
              >
                {connectorStyle.arrowHead ? "→" : "—"}
              </button>
            </div>
            <div className="w-px h-8 bg-gray-300" />
          </>
        )}

        {/* Selection count + Delete button */}
        {selectionCount != null && selectionCount > 1 && (
          <span className="text-xs font-medium text-gray-500 select-none">
            {selectionCount} selected
          </span>
        )}
        <button
          onClick={onDuplicate}
          disabled={!hasSelection}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasSelection
              ? "bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100"
              : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
          }`}
          title="Duplicate (Ctrl+D)"
        >
          ⧉
        </button>
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
