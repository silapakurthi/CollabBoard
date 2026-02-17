# CollabBoard

A real-time collaborative whiteboard — draw sticky notes, shapes, and lines with multiple users simultaneously.

## Tech Stack

- **React 19** + **TypeScript** — UI and component logic
- **Konva.js** / **react-konva** — infinite canvas with pan, zoom, and shapes
- **Firebase Auth** — Google sign-in
- **Firestore** — real-time sync of board objects and user presence
- **Firebase Hosting** — static deployment
- **Tailwind CSS v4** — styling

## Features

- Infinite canvas with pan (drag) and zoom (scroll wheel)
- Sticky notes with inline text editing
- Rectangle, circle, and line shapes with resize handles
- Multi-user real-time cursor tracking with name labels
- Presence bar showing who's currently online
- Board list with persistent storage

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/silapakurthi/CollabBoard.git
cd CollabBoard

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

## Deployed App

**https://collabboard-55bc3.web.app**

## Architecture

- **`src/hooks/useFirestore.ts`** — CRUD + real-time subscription for board objects
- **`src/hooks/usePresence.ts`** — writes/reads cursor positions and online status via Firestore presence subcollection
- **`src/hooks/useBoard.ts`** — pan and zoom state for the Konva stage
- **`src/components/Board/Canvas.tsx`** — Konva Stage, layers (grid / objects / cursors), object rendering, Transformer
- **`src/components/Presence/`** — `CursorOverlay` (Konva layer) and `PresenceBar` (DOM)
- **`firestore.rules`** — security rules: authenticated users only
