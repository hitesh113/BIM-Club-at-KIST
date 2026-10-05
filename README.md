# College Club Management System

A responsive React + TypeScript frontend for the BIM Club at KIST College of Management. The application uses local mock data and does not connect to Supabase or another backend.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm run build` to create a production build and `npm run lint` to run Oxlint.

## Demo roles

Choose **Member sign in** and select a demo role:

- **Admin:** members, events, attendance, donations, files, and reports.
- **BOD:** event operations, registrations, attendance, QR scanner demo, and files.
- **Participant:** event discovery and registration, attendance, donations, and leaderboard.

The demo sign-in does not validate credentials. Event registration, event edits, member changes, and donations update local React state only. File storage and camera-based QR scanning are not connected.

## Data boundary

Domain types are in `src/types.ts`, sample records in `src/mockData.ts`, and the current `ClubRepository` contract/mock implementation in `src/services/clubRepository.ts`. A future Supabase adapter can implement that contract and replace the mock repository without adding Supabase to this frontend demo.