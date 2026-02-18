# CollabBoard — MVP Product Requirements Document

**Version:** 1.0
**Date:** February 17, 2026
**Status:** In Development
**Deadline:** 24 hours from project start

---

## 1. Product Overview

CollabBoard is a real-time collaborative whiteboard that enables multiple users to create and manipulate content on a shared infinite canvas simultaneously. This document covers the MVP requirements only — the minimum feature set required to pass the 24-hour checkpoint.

---

## 2. MVP Success Criteria

All items below are required. Missing any single item is a hard fail.

---

## 3. Functional Requirements

### FR-1: Infinite Canvas

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1.1 | Infinite board | Canvas extends infinitely in all directions with no fixed boundaries |
| FR-1.2 | Pan | Click and drag on empty space moves the viewport |
| FR-1.3 | Zoom | Mouse wheel zooms in/out centered on cursor position; range 10%–500% |

### FR-2: Sticky Notes

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-2.1 | Create | Select sticky note tool, click canvas to place a new sticky note |
| FR-2.2 | Edit text | Double-click a sticky note to open text editor; saves on blur or Escape |
| FR-2.3 | Change color | User can select from multiple colors via toolbar before or after creation |
| FR-2.4 | Move | Sticky notes are draggable to new positions |

### FR-3: Shapes

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-3.1 | Minimum one shape type | At least one of: rectangle, circle, or line can be created from the toolbar |
| FR-3.2 | Create | Select shape tool, click canvas to place |
| FR-3.3 | Move | Shapes are draggable to new positions |
| FR-3.4 | Edit | Shape properties (color, size) can be modified after creation |

### FR-4: Object Operations

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-4.1 | Create | Objects placed on canvas via toolbar tool selection + click |
| FR-4.2 | Move | All objects draggable; final position persists |
| FR-4.3 | Edit | Object properties (text, color) modifiable after creation |

### FR-5: Real-Time Sync

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-5.1 | Multi-user sync | Object creation, movement, and edits appear in all connected browsers |
| FR-5.2 | Sync latency | Changes visible to other users within 100ms |
| FR-5.3 | Conflict handling | Simultaneous edits to the same object are resolved without data corruption; last-write-wins is acceptable |
| FR-5.4 | Persistence | Board state survives all users leaving and returning |
| FR-5.5 | Reconnection | User who disconnects and reconnects sees current board state without manual refresh |

### FR-6: Multiplayer Cursors

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-6.1 | Visible cursors | Each connected user's cursor is visible to all other users |
| FR-6.2 | Name labels | Each cursor displays the user's name |
| FR-6.3 | Real-time movement | Cursor position updates are visible within 50ms |

### FR-7: Presence Awareness

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7.1 | Online indicator | Clear visual indication of which users are currently on the board |
| FR-7.2 | Stale cleanup | Users who disconnect are removed from the online list within 60 seconds |

### FR-8: Authentication

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-8.1 | Login required | Unauthenticated users cannot access boards |
| FR-8.2 | Sign-in method | At minimum Google sign-in |
| FR-8.3 | User identity | Authenticated user's display name is used for cursor labels and presence |

### FR-9: Deployment

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-9.1 | Publicly accessible | Application reachable via public HTTPS URL |
| FR-9.2 | No local dependencies | Evaluators can use the app without installing anything |

---

## 4. Testing Scenarios

These scenarios will be used to validate the MVP:

| # | Scenario | Steps | Pass Criteria |
|---|----------|-------|--------------|
| 1 | Simultaneous editing | Open same board in 2 different browsers, create and move objects in both | Both browsers show all objects in correct positions |
| 2 | State persistence | Create objects, refresh the page | All objects are still present after refresh |
| 3 | Rapid sync | Quickly create and drag multiple sticky notes in one browser | Other browser keeps up without missed objects or stale positions |
| 4 | Disconnect recovery | Throttle network in DevTools, make edits, restore network | Edits sync once connection is restored |
| 5 | Concurrent users | Open same board in 5+ browser windows | No performance degradation; all cursors and objects visible |

---

## 5. Performance Targets

| Metric | Target |
|--------|--------|
| Frame rate | 60 FPS during pan, zoom, and object manipulation |
| Object sync latency | <100ms |
| Cursor sync latency | <50ms |
| Concurrent users | 5+ without degradation |

---

## 6. Out of Scope for MVP

The following are explicitly deferred to post-MVP:
- Connectors / arrows between objects
- Standalone text elements
- Frames / grouping
- Multi-select, duplicate, copy/paste
- AI board agent
- Board naming / renaming
- Object rotation
- Export functionality
- Mobile support