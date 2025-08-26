# 🎶 Moodcast

Moodcast is a **full-stack music streaming platform** that empowers users to discover, share, and listen to music collaboratively. It features real-time music rooms, recommendations powered by ML, YouTube integration, and a sleek, responsive UI.

## ✨ Unique Features

- **Real-Time Music Rooms**: Create and join rooms with collaborative song queues, voting, and live chat powered by Socket.IO.
- **YouTube Integration**: Search, play, and manage YouTube tracks directly within the app.
- **Simulated Downloads**: Download playlists and songs for offline use (simulated for demo purposes).

## 🚀 Features

- Secure authentication via Clerk (supports email/password and social login).
- Homepage with personalized music recommendations.
- Room management: create, join, leave, and customize music rooms.
- Song queueing and voting in real time.
- Lyrics display
- Playlist and library management.
- Optional room chat for communication.
- Modern, responsive UI with TailwindCSS.

## 🛠️ Technologies Used

- **Frontend**: React, Vite, TailwindCSS, React Router, Socket.IO client, Clerk (auth)
- **Backend**: Node.js, Express, Socket.IO, sample/mock data, optional MongoDB
- **Integration**: YouTube Data API (proxy endpoint), Python ML for recommendations

## 📖 How to Use

1. **Clone the repository.**
2. **Configure environment variables:**
   - Clerk (frontend auth): create a Clerk app at [https://dashboard.clerk.com](https://dashboard.clerk.com) and add to `client/.env.local`:
     ```env
     VITE_CLERK_PUBLISHABLE_KEY=pk_...
     # When deploying client and server on different domains, set:
     # VITE_API_BASE=https://your-server.example.com
     ```
   - MongoDB (optional persistence): in `server/.env`:
     ```env
     MONGODB_URI=mongodb://localhost:27017
     MONGODB_DB=moodcast
     ```
     If not set, the server will use in-memory storage (data resets on restart).
   - YouTube API keys (enable search/recs from YouTube): in `server/.env` add either a single key or CSV list for round-robin + cooldown on quota:
     ```env
     # Either provide one key
     YOUTUBE_API_KEY=YOUR_YOUTUBE_DATA_API_V3_KEY
     # Or provide multiple keys (comma-separated)
     # YOUTUBE_API_KEYS=key1,key2,key3
     # Optional tuning (defaults shown)
     YT_KEY_COOLDOWN_MS=3600000
     YT_CACHE_TTL_MS=0
     # Recommendation filtering (defaults shown)
     REC_CACHE_TTL_MS=600000
     RECS_MUSIC_ONLY=1
     RECS_MIN_SEC=60
     RECS_MAX_SEC=900
     ```

3. **Install dependencies:**
   ```bash
   npm install
   npm run install:all
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```
   - Backend: `http://localhost:4000`
   - Frontend: `http://localhost:5173`

5. **Open the app:**
   Go to [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📚 API Endpoints

- `GET /api/recommendations` – Get music recommendations
- `GET /api/rooms` / `POST /api/rooms` – List/create rooms
- `POST /api/rooms/:id/join` – Join a room
- `POST /api/rooms/:id/queue` – Add song to queue
- `POST /api/rooms/:id/vote` – Vote on songs
- `GET /api/playlists` – Fetch playlists
- `GET /api/songs/:id/lyrics` – Get song lyrics
- `GET /api/yt/search?q=QUERY` – YouTube search

## 🤝 Contributing

Feel free to submit a pull request or open an issue for suggestions and improvements.

---

Happy listening & coding! 🎵🚀
