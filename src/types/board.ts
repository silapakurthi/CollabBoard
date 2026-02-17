import { Timestamp } from "firebase/firestore";

export interface BoardObject {
  id: string;
  type:
    | "sticky"
    | "rectangle"
    | "circle"
    | "line"
    | "text"
    | "frame"
    | "connector";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  color: string;
  style?: Record<string, unknown>;
  zIndex: number;
  connectedFrom?: string;
  connectedTo?: string;
  parentFrame?: string;
  lastEditedBy: string;
  updatedAt: Timestamp;
}

export interface Board {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface UserPresence {
  userId: string;
  displayName: string;
  cursor: { x: number; y: number };
  cursorColor: string;
  selectedObjectIds: string[];
  lastSeen: Timestamp;
}
