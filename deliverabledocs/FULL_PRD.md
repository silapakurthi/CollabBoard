# CollabBoard — Product Requirements Document

**Version:** 1.0
**Date:** February 17, 2026
**Status:** In Development
**Sprint Duration:** 1 week
**Gate:** Project completion required for Austin admission

---

## 1. Product Overview

CollabBoard is a real-time collaborative whiteboard application that enables multiple users to brainstorm, map ideas, and organize content simultaneously on a shared infinite canvas. The product includes an AI agent that manipulates the board through natural language commands. The project emphasizes AI-first development methodology — using coding agents, MCPs, and structured AI workflows throughout the build process.

---

## 2. Goals & Success Criteria

**Primary Goal:** Build a production-scale collaborative whiteboard with real-time sync, comprehensive board tools, and an AI board agent.

**Success Criteria:**
- All MVP requirements pass at the 24-hour checkpoint
- Full feature set delivered by end of week
- 2+ users can edit simultaneously with no merge conflicts
- Board state persists through refreshes and disconnects
- AI agent executes 6+ distinct command types
- 5+ concurrent users without degradation
- Application deployed and publicly accessible with authentication
- All deliverables submitted by Sunday 10:59 PM CT

---

## 3. Milestones & Deadlines

| Checkpoint | Deadline | Focus |
|-----------|----------|-------|
| Pre-Search | Monday (hour 1) | Architecture decisions, stack selection, planning |
| MVP | Tuesday (24 hours) | Core collaborative infrastructure — hard gate |
| Early Submission | Friday (4 days) | Full feature set |
| Final | Sunday (7 days) | Polish, documentation, deployment |

---

## 4. MVP Requirements (24-Hour Hard Gate)

All items below are required to pass. Missing any single item is a fail.

### FR-1: Infinite Canvas

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1.1 | Infinite board | Canvas extends infinitely in all directions; no fixed boundaries |
| FR-1.2 | Pan | Click and drag on empty space moves the viewport |
| FR-1.3 | Zoom | Mouse wheel zooms in/out centered on cursor position; smooth scaling |

### FR-2: Sticky Notes

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-2.1 | Create | Select sticky note tool, click canvas to place |
| FR-2.2 | Edit text | Double-click to open text editor; saves on blur or Escape |
| FR-2.3 | Change color | Multiple colors selectable from toolbar |
| FR-2.4 | Move | Draggable to new positions |

### FR-3: Shapes (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-3.1 | Minimum one type | At least one of: rectangle, circle, or line |
| FR-3.2 | Create | Select tool, click canvas to place |
| FR-3.3 | Move | Draggable to new positions |
| FR-3.4 | Edit | Properties (color, size) modifiable after creation |

### FR-4: Object Operations (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-4.1 | Create | Objects placed via toolbar tool selection + click |
| FR-4.2 | Move | All objects draggable; final position persists |
| FR-4.3 | Edit | Object properties (text, color) modifiable after creation |

### FR-5: Real-Time Sync (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-5.1 | Multi-user sync | Object creation, movement, and edits appear in all connected browsers |
| FR-5.2 | Sync latency | Changes visible to other users within 100ms |
| FR-5.3 | Conflict handling | Simultaneous edits resolved without data corruption; last-write-wins acceptable |
| FR-5.4 | Persistence | Board state survives all users leaving and returning |
| FR-5.5 | Reconnection | Disconnected user reconnects and sees current state without manual refresh |

### FR-6: Multiplayer Cursors (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-6.1 | Visible cursors | Each user's cursor visible to all others |
| FR-6.2 | Name labels | Each cursor displays the user's name |
| FR-6.3 | Real-time movement | Cursor position updates visible within 50ms |

### FR-7: Presence Awareness (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7.1 | Online indicator | Clear visual indication of which users are on the board |
| FR-7.2 | Stale cleanup | Disconnected users removed from online list within 60 seconds |

### FR-8: Authentication (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-8.1 | Login required | Unauthenticated users cannot access boards |
| FR-8.2 | Sign-in method | Google sign-in minimum |
| FR-8.3 | User identity | Display name used for cursor labels and presence |

### FR-9: Deployment (MVP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-9.1 | Publicly accessible | Application reachable via public HTTPS URL |
| FR-9.2 | No local dependencies | Evaluators can use the app without installing anything |

---

## 5. Full Feature Requirements (End of Week)

### FR-10: Complete Board Objects

| ID | Feature | Requirements |
|----|---------|-------------|
| FR-10.1 | Sticky notes | Create, edit text, change colors; multiple color options |
| FR-10.2 | Rectangles | Geometric rectangle with stroke/fill; draggable, resizable; drag-to-create with real-time preview |
| FR-10.3 | Circles | Geometric circle with stroke/fill; draggable, resizable; drag-to-create with real-time preview |
| FR-10.4 | Lines | Line segments; draggable |
| FR-10.5 | Connectors | Lines/arrows connecting two objects; dynamically follow connected objects when moved; auto-delete when connected object is deleted |
| FR-10.6 | Standalone text | Text elements independent of sticky notes; editable, draggable, resizable; double-click to edit |
| FR-10.7 | Frames | Grouping containers with title labels; contained objects move with frame; resizable; render behind other objects; double-click title to rename |

### FR-11: Object Transforms

| ID | Feature | Requirements |
|----|---------|-------------|
| FR-11.1 | Move | All objects draggable to new positions |
| FR-11.2 | Resize | Resize handles on selected objects via Transformer |
| FR-11.3 | Rotate | Rotation support on selected objects |

### FR-12: Selection

| ID | Feature | Requirements |
|----|---------|-------------|
| FR-12.1 | Single select | Click an object to select; click empty space to deselect |
| FR-12.2 | Multi-select (shift) | Shift-click to toggle objects in/out of selection |
| FR-12.3 | Multi-select (marquee) | Drag-to-select on empty canvas draws selection rectangle; selects all intersecting objects on mouse up |
| FR-12.4 | Select all | Ctrl/Cmd+A selects all objects on the board |

### FR-13: Object Operations

| ID | Feature | Requirements |
|----|---------|-------------|
| FR-13.1 | Delete | Delete/Backspace key or toolbar button removes selected objects; also removes attached connectors |
| FR-13.2 | Duplicate | Ctrl/Cmd+D duplicates selected objects offset by +20,+20 with new IDs; recreates internal connectors between duplicated objects |
| FR-13.3 | Copy | Ctrl/Cmd+C copies selected objects to in-memory clipboard |
| FR-13.4 | Paste | Ctrl/Cmd+V pastes at current cursor position with new IDs |

### FR-14: Board Management

| ID | Feature | Requirements |
|----|---------|-------------|
| FR-14.1 | Board naming | User can name a board when creating it |
| FR-14.2 | Board renaming | Click board name in board view to edit; saves on blur or Enter |
| FR-14.3 | Board list | List of user's boards with names; click to open |

### FR-15: Real-Time Collaboration (Full)

| ID | Feature | Requirements |
|----|---------|-------------|
| FR-15.1 | Cursor sync | Multiplayer cursors with names; <50ms latency |
| FR-15.2 | Object sync | Creation, modification, deletion sync instantly; <100ms latency |
| FR-15.3 | Presence | Who's online indicator with stale cleanup |
| FR-15.4 | Conflict resolution | Simultaneous edits handled; last-write-wins acceptable; approach documented |
| FR-15.5 | Resilience | Graceful disconnect/reconnect; no data loss |
| FR-15.6 | Persistence | Board state survives all users leaving and returning |

---

## 6. AI Board Agent

### FR-16: AI Agent Core

| ID | Feature | Requirements |
|----|---------|-------------|
| FR-16.1 | Natural language input | Text input bar for typing commands in plain English |
| FR-16.2 | Command processing | LLM interprets command and executes via function calling |
| FR-16.3 | Shared state | All users see AI-generated results in real-time |
| FR-16.4 | Concurrent commands | Multiple users can issue AI commands simultaneously without conflict |
| FR-16.5 | Command breadth | Minimum 6 distinct command types |
| FR-16.6 | Response latency | <2 seconds for single-step commands |
| FR-16.7 | Reliability | Consistent, accurate execution |

### FR-17: AI Command Categories

The agent must support at least 6 distinct commands across these categories:

#### FR-17.1: Creation Commands

| Example Command | Expected Behavior |
|----------------|-------------------|
| "Add a yellow sticky note that says 'User Research'" | Creates a yellow sticky note with the specified text |
| "Create a blue rectangle at position 100, 200" | Creates a blue rectangle at the given coordinates |
| "Add a frame called 'Sprint Planning'" | Creates a named frame on the board |

#### FR-17.2: Manipulation Commands

| Example Command | Expected Behavior |
|----------------|-------------------|
| "Move all the pink sticky notes to the right side" | Identifies pink sticky notes and repositions them |
| "Resize the frame to fit its contents" | Calculates bounding box of contained objects and resizes |
| "Change the sticky note color to green" | Updates the color of the referenced sticky note |

#### FR-17.3: Layout Commands

| Example Command | Expected Behavior |
|----------------|-------------------|
| "Arrange these sticky notes in a grid" | Calculates grid positions with consistent spacing and moves objects |
| "Create a 2x3 grid of sticky notes for pros and cons" | Creates 6 sticky notes in a 2x3 layout |
| "Space these elements evenly" | Distributes selected or all elements with equal spacing |

#### FR-17.4: Complex / Template Commands

| Example Command | Expected Behavior |
|----------------|-------------------|
| "Create a SWOT analysis template with four quadrants" | Creates 4 labeled frames: Strengths, Weaknesses, Opportunities, Threats |
| "Build a user journey map with 5 stages" | Creates 5 sequential stages with appropriate layout |
| "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns" | Creates 3 column frames with headers |

### FR-18: AI Tool Schema

The AI agent must have access to at minimum these tools:

| Tool | Parameters | Description |
|------|-----------|-------------|
| createStickyNote | text, x, y, color | Create a new sticky note |
| createShape | type, x, y, width, height, color | Create a geometric shape |
| createFrame | title, x, y, width, height | Create a grouping frame |
| createConnector | fromId, toId, style | Connect two objects |
| moveObject | objectId, x, y | Move an object to new position |
| resizeObject | objectId, width, height | Resize an object |
| updateText | objectId, newText | Change object's text content |
| changeColor | objectId, color | Change object's color |
| getBoardState | (none) | Returns current board objects for context |

### FR-19: AI Evaluation Criteria

| Command | Expected Result |
|---------|----------------|
| "Create a SWOT analysis" | 4 labeled quadrants (Strengths, Weaknesses, Opportunities, Threats) |
| "Arrange in a grid" | Elements aligned with consistent spacing |
| Multi-step commands | AI plans steps and executes sequentially |

---

## 7. Performance Requirements

| Metric | Target |
|--------|--------|
| Frame rate | 60 FPS during pan, zoom, and object manipulation |
| Object sync latency | <100ms |
| Cursor sync latency | <50ms |
| Object capacity | 500+ objects without performance drops |
| Concurrent users | 5+ without degradation |
| AI response latency | <2 seconds for single-step commands |
| AI command breadth | 6+ command types |
| AI reliability | Consistent, accurate execution |

---

## 8. Testing Scenarios

The following scenarios will be used during evaluation:

| # | Scenario | Steps | Pass Criteria |
|---|----------|-------|--------------|
| 1 | Simultaneous editing | 2 users edit in different browsers | Both see each other's changes in real-time |
| 2 | State persistence | One user refreshes mid-edit | State persists; no data loss |
| 3 | Rapid sync | Quick creation and movement of sticky notes and shapes | Sync keeps up; no missed updates |
| 4 | Network resilience | Throttle network and disconnect/reconnect | Graceful degradation; reconnect restores sync |
| 5 | Concurrent load | 5+ concurrent users | No performance degradation |

---

## 9. AI-First Development Requirements

### FR-20: AI Development Tools

| ID | Requirement | Details |
|----|-------------|---------|
| FR-20.1 | Minimum tools | Use at least 2 of: Claude Code, Cursor, Codex, MCP integrations |
| FR-20.2 | Tool documentation | Document which tools were used and how |

### FR-21: AI Development Log (Required Deliverable)

1-page document covering:

| Section | Content |
|---------|---------|
| Tools & Workflow | Which AI coding tools used, how they were integrated |
| MCP Usage | Which MCPs used (if any), what they enabled |
| Effective Prompts | 3–5 prompts that worked well (include actual prompts) |
| Code Analysis | Rough % of AI-generated vs hand-written code |
| Strengths & Limitations | Where AI excelled, where it struggled |
| Key Learnings | Insights about working with coding agents |

### FR-22: AI Cost Analysis (Required Deliverable)

#### Development & Testing Costs

| Metric | Value |
|--------|-------|
| LLM API costs (OpenAI, Anthropic, etc.) | $____ |
| Total tokens consumed (input/output breakdown) | ____ / ____ |
| Number of API calls made | ____ |
| Other AI-related costs (embeddings, hosting, etc.) | $____ |

#### Production Cost Projections

| Scale | Monthly Cost | Assumptions |
|-------|-------------|-------------|
| 100 users | $____/month | Avg commands/user/session, sessions/user/month, tokens/command |
| 1,000 users | $____/month | |
| 10,000 users | $____/month | |
| 100,000 users | $____/month | |

---

## 10. Submission Deliverables

**Deadline:** Sunday 10:59 PM CT

| Deliverable | Requirements |
|-------------|-------------|
| GitHub Repository | Setup guide, architecture overview, deployed link |
| Demo Video (3–5 min) | Real-time collaboration, AI commands, architecture explanation |
| Pre-Search Document | Completed checklist from Phases 1–3 |
| AI Development Log | 1-page breakdown using template from FR-21 |
| AI Cost Analysis | Dev spend + projections for 100/1K/10K/100K users |
| Deployed Application | Publicly accessible, supports 5+ users with auth |
| Social Post | Share on X or LinkedIn: description, features, demo/screenshots, tag @GauntletAI |

---

## 11. Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, react-konva (Konva.js), Tailwind CSS |
| Database & Real-Time | Cloud Firestore (onSnapshot for real-time sync) |
| Authentication | Firebase Auth (Google sign-in) |
| AI Backend | Firebase Cloud Functions → Anthropic Claude API (function calling) |
| Observability | Langfuse (LLM tracing, token tracking, cost monitoring) |
| Testing | Playwright (functional, performance, network resilience) |
| Deployment | Firebase Hosting |
| AI Development Tools | Claude Code, MCP integrations |

### Data Model

```
boards/{boardId}
├── name, createdBy, createdAt
├── objects/{objectId}
│   ├── type, x, y, width, height, rotation
│   ├── text, color, style, zIndex
│   ├── connectedFrom, connectedTo, parentFrame
│   ├── lastEditedBy, updatedAt
└── presence/{userId}
    ├── displayName, cursor: {x, y}
    ├── cursorColor, selectedObjectIds, lastSeen
```

### Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Real-time sync | Firestore onSnapshot | Eliminates custom WebSocket server; real-time sync is a database feature, not custom infrastructure |
| Conflict resolution | Last-write-wins (Firestore default) | Spec explicitly allows it; appropriate for whiteboard interactions |
| AI agent writes | Same Firestore path as user writes | AI objects sync to all users automatically; no special handling |
| Cursor separation | Separate presence subcollection | Prevents high-frequency cursor updates from triggering object re-renders |

---

## 12. Build Priority Order

| Priority | Task | Rationale |
|----------|------|-----------|
| 1 | Cursor sync | Get two cursors moving across browsers — proves real-time works |
| 2 | Object sync | Sticky notes appear for all users |
| 3 | Conflict handling | Handle simultaneous edits |
| 4 | State persistence | Survive refreshes and reconnects |
| 5 | Board features | Shapes, frames, connectors, transforms |
| 6 | AI commands (basic) | Single-step creation/manipulation |
| 7 | AI commands (complex) | Multi-step template generation |

---

## 13. Out of Scope

- Mobile-responsive design
- Offline-first architecture (Firestore cache tolerance is sufficient)
- Image uploads or media embedding
- Export to PDF/PNG
- Version history or undo/redo
- Per-board access control or permissions (all authenticated users can access all boards)
- Custom domain or branding
- Payment or subscription features