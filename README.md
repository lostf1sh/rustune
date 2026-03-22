# Rustune

Rustune is a local desktop music player built with Tauri, Rust, React, and TypeScript.

## Current Features

- Local library scanning for common formats including MP3, FLAC, WAV, OGG, M4A, AAC, OPUS, WMA, APE, WV, AIFF, and ALAC
- Persistent library folders
- Playback queue with shuffle and repeat modes
- Playlist creation and track management
- Album art extraction
- Basic tag editing
- Lyrics lookup via LRCLIB
- Full-screen now playing view

## Stack

- Frontend: React 19, TypeScript, Vite, Zustand
- Desktop shell: Tauri 2
- Backend: Rust, rusqlite, lofty, symphonia, cpal

## Development

Requirements:

- Node.js 20+
- Rust toolchain
- Tauri system dependencies for your platform

Install dependencies:

```bash
npm install
```

Run the frontend in development:

```bash
npm run dev
```

Run the desktop app:

```bash
npx tauri dev
```

Create a production frontend build:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

Run Rust compile checks:

```bash
cd src-tauri
cargo check
```

## Library Behavior

- Added folders are stored in the app database.
- Re-scanning a folder updates metadata for existing files and removes tracks that no longer exist under that folder.
- Removing a folder from the sidebar removes that folder from the saved library roots and deletes its tracks from the library.

## Known Gaps

- There is no automated test suite yet.
- Playlist reordering is not implemented.
- Duplicate entries for the same track in a playlist are not supported yet.
