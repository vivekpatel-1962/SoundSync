# Moodcast – Music Streaming Platform

A full-stack prototype with React + Tailwind on the frontend and Node.js/Express + Socket.IO on the backend. Uses in-memory sample data and mock auth.

## Features
- Email/password + social via Clerk (client-side auth)
- Homepage recommendations (sample data)
- Music Rooms with real-time queue & voting via Socket.IO
- Pair/Couple mode with theme and combined recommendations
- Player with controls and lyrics (static and karaoke-style)
- Simulated downloads for playlists/songs
- YouTube search proxy endpoint
- Optional room chat
- Modern UI with Tailwind, responsive layout

## Structure
- `server/`: Express REST API + Socket.IO + sample data
- `client/`: React app using Vite, Tailwind, React Router, Socket.IO client

## Quick Start
0) Clerk setup (auth)
   - Create a Clerk app at https://dashboard.clerk.com and copy the Publishable Key.
   - Set it in `client/.env.local` as `VITE_CLERK_PUBLISHABLE_KEY=pk_...` (we created this file for you).

1) Install root helper deps and project deps
```
npm install
npm run install:all
```

2) Start both dev servers (server on 4000, client on 5173 with proxy)
```
npm run dev
```

3) Open the app: http://localhost:5173

## API (selected)
- `GET /api/recommendations`
- `GET /api/rooms` | `POST /api/rooms`
- `GET /api/rooms/:id`
- `POST /api/rooms/:id/join` { userId }
- `POST /api/rooms/:id/queue` { songId, userId }
- `POST /api/rooms/:id/vote` { songId, userId, vote: 'up'|'down' }
- `POST /api/pair` { userIdA, userIdB }
- `GET /api/playlists`
- `GET /api/songs/:id/lyrics`
- `GET /api/yt/search?q=QUERY` (YouTube search proxy)

## Notes
- Auth UI is powered by Clerk on the client. The backend still uses mock/in-memory users and only reads `x-user-id` header for demo purposes. There is no JWT/session verification yet.
- In-memory data resets when the server restarts
- YouTube API proxy is available at `GET /api/yt/search`. Set `YOUTUBE_API_KEY=...` in `server/.env`.

## Auth routes
- Sign in: `/sign-in`
- Sign up: `/sign-up`
- Protected routes: `/rooms`, `/rooms/:id`, `/player`, `/library`, `/settings`

