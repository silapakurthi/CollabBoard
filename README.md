# CollabBoard

A real-time collaborative whiteboard where multiple users can create, edit, and arrange objects on a shared infinite canvas simultaneously.

## Deployed App

**https://collabboard-55bc3.web.app**

## Tech Stack

- **React 19** + **TypeScript** — UI and component logic
- **Konva.js** / **react-konva** — infinite canvas with pan, zoom, and shapes
- **Firebase Auth** — Google sign-in and anonymous guest login
- **Firestore** — real-time sync of board objects and user presence
- **Firebase Hosting** — static deployment
- **Tailwind CSS v4** — styling

## Features

### Canvas
- Infinite canvas with pan (drag) and zoom (scroll wheel, 10%–500%)
- Dot grid background that scales with zoom
- Zoom indicator in the corner

### Objects
- **Sticky notes** — square, color-coded, with inline text editing
- **Rectangles** — resizable with text labels
- **Circles** — resizable with centered text
- **Lines** — with midpoint text labels
- **Text elements** — standalone text with adjustable font size
- **Frames** — group containers with title labels
- **Connectors** — arrows between any two objects with solid/dashed styles

### Editing
- Double-click any object to edit its text
- 10-color palette (5 light + 5 dark) with contrast-aware text rendering
- Resize via selection handles (Transformer)
- Multi-select with Shift+click or drag selection box
- Copy/paste and duplicate selected objects
- Delete selected objects via toolbar or keyboard
- Connectors redraw in real-time during resize/move

### Collaboration
- Real-time sync — object creation, movement, edits, and deletion appear instantly across all connected browsers
- Multiplayer cursors with color-coded name labels
- Presence bar showing who's currently online (auto-removes stale users after 30s)
- Last-write-wins conflict resolution
- Automatic reconnection after network interruption

### Boards
- Board list with create, rename, and delete
- "Create Demo Board" button that generates a pre-populated sample board
- Board name editable inline from the board view

### Authentication
- Google sign-in
- Guest login with display name
- All routes protected — login required to access boards

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/silapakurthi/CollabBoard.git
cd CollabBoard/collabboard

# 2. Install dependencies
npm install

# 3. Create a Firebase project and add your config
cp .env.example .env
# Fill in your VITE_FIREBASE_* values in .env

# 4. Start the dev server
npm run dev
```

### Environment variables

Create a `.env` file with the following keys (from your Firebase project settings):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Deploy

```bash
npm run build
npx firebase deploy
```

## Architecture

| Path | Purpose |
|------|---------|
| `src/hooks/useFirestore.ts` | CRUD + real-time subscription for board objects |
| `src/hooks/usePresence.ts` | Cursor positions and online status via Firestore presence subcollection |
| `src/hooks/useBoard.ts` | Pan and zoom state for the Konva stage |
| `src/components/Board/Canvas.tsx` | Konva Stage, layers (grid / objects / cursors), object rendering, Transformer |
| `src/components/Board/StickyNote.tsx` | Sticky note shape component |
| `src/components/Board/RectShape.tsx` | Rectangle shape component |
| `src/components/Board/CircleShape.tsx` | Circle shape component |
| `src/components/Board/LineShape.tsx` | Line shape component |
| `src/components/Board/TextElement.tsx` | Standalone text element |
| `src/components/Board/Frame.tsx` | Frame/group container |
| `src/components/Board/Connector.tsx` | Arrow connector between objects |
| `src/components/Board/BoardView.tsx` | Board page — toolbar, presence bar, canvas |
| `src/components/Board/BoardList.tsx` | Home page — board list, create/delete boards |
| `src/components/Toolbar/Toolbar.tsx` | Tool selection, color picker, delete button |
| `src/components/Presence/CursorOverlay.tsx` | Konva layer rendering other users' cursors |
| `src/components/Presence/PresenceBar.tsx` | DOM bar showing online users |
| `src/components/Auth/LoginPage.tsx` | Google sign-in and guest login |
| `src/components/Auth/AuthGate.tsx` | Route protection — redirects to login if unauthenticated |
| `src/context/AuthContext.tsx` | Firebase Auth state provider |
| `src/utils/color.ts` | Contrast-aware text and stroke color utilities |
| `firestore.rules` | Security rules — authenticated users only |
