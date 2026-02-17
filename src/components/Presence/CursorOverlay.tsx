import { Layer, Group, Line, Rect, Text } from "react-konva";
import type { UserPresence } from "../../hooks/usePresence";

// A simple arrow cursor polygon: tip at (0,0), body goes down-right
// Points: tip, bottom-left, notch-in, tail-bottom, tail-top, notch-up, right
const CURSOR_POINTS = [0, 0, 0, 14, 3.5, 10.5, 6, 16, 8, 15, 5.5, 9, 11, 9];

const FONT_SIZE = 11;
const LABEL_PAD_X = 5;
const LABEL_PAD_Y = 3;
const LABEL_OFFSET_X = 12;
const LABEL_OFFSET_Y = 13;
const CHAR_WIDTH = 6.5;

interface CursorOverlayProps {
  otherUsers: UserPresence[];
  stageScale: number;
}

export function CursorOverlay({ otherUsers, stageScale }: CursorOverlayProps) {
  // Scale factor keeps cursors a consistent screen size regardless of zoom
  const s = 1 / stageScale;

  return (
    <Layer listening={false}>
      {otherUsers.map((user) => {
        const labelW = user.displayName.length * CHAR_WIDTH + LABEL_PAD_X * 2;
        const labelH = FONT_SIZE + LABEL_PAD_Y * 2;

        return (
          <Group
            key={user.userId}
            x={user.cursor.x}
            y={user.cursor.y}
            scaleX={s}
            scaleY={s}
          >
            {/* Cursor arrow */}
            <Line
              points={CURSOR_POINTS}
              closed
              fill={user.cursorColor}
              stroke="white"
              strokeWidth={1.5}
            />
            {/* Name label background */}
            <Rect
              x={LABEL_OFFSET_X}
              y={LABEL_OFFSET_Y}
              width={labelW}
              height={labelH}
              fill={user.cursorColor}
              cornerRadius={3}
              opacity={0.9}
            />
            {/* Name label text */}
            <Text
              x={LABEL_OFFSET_X + LABEL_PAD_X}
              y={LABEL_OFFSET_Y + LABEL_PAD_Y}
              text={user.displayName}
              fontSize={FONT_SIZE}
              fontFamily="sans-serif"
              fontStyle="bold"
              fill="white"
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
}
