# College Club Management System

A responsive React + TypeScript frontend for the BIM Club at KIST College of Management. The application uses realistic local mock data and is ready for a future Supabase adapter, but does not connect to Supabase or another backend yet.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm run build` to create a production build and `npm run lint` to run Oxlint.

## Demo roles

Choose **Member sign in** and select a demo role:

- **Admin:** members, events, attendance records, donations, files, reports, and activity log.
- **BOD:** event operations, registrations, QR-based attendance verification, attendance records, and files.
- **Participant:** event discovery and registration, QR check-in status, attendance history, contributions, notifications, and leaderboard.

The demo sign-in does not validate credentials. Event registration, event edits, member changes, attendance verification, file uploads, notifications, and donations update local React state only. Donations use a mock contribution flow with NPR amounts; no real payment processing is connected.

## Current modules

- **QR-based attendance verification:** BOD/Admin users can use the device camera to decode participant QR codes through `html5-qrcode`. The scanner accepts payloads such as `BIMCLUB:reg-001` as a camera fallback, validates the registration, shows participant information, prevents duplicate attendance, and records the check-in locally.
- **File management:** Search and filter files by Notices, Event Documents, Club Guidelines, Reports, or Other. Files show type, upload date, uploader, and download feedback; uploads are local metadata-only demo actions.
- **Donations:** Participants can make mock NPR contributions and view their history. Admins can review contributors, totals, pending amounts, and the donation ledger.
- **Attendance, reports, and leaderboard:** Attendance records, participation metrics, simple charts, event breakdowns, and points-based engagement rankings use the local mock collections.
- **Notifications and activity log:** Role-aware mock notifications and an Admin activity log cover registration, attendance, donations, uploads, and club administration events.

## Data boundary

Domain types are in `src/types.ts`, sample records in `src/mockData.ts`, and the current `ClubRepository` contract/mock implementation in `src/services/clubRepository.ts`. The future database boundary is organized around:

- `profiles/users`
- `events`
- `event_registrations`
- `attendance`
- `files`
- `donations`
- `notifications`
- `activity_logs`

A future Supabase adapter can implement that contract and replace the mock repository without changing the role-based UI. Camera permission and server-side duplicate protection should be enforced again by the backend when Supabase is connected.