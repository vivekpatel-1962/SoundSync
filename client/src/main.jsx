import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import './index.css';
import App from './App.jsx';
import { RoomProvider } from './context/RoomContext.jsx';
import Home from './pages/Home.jsx';
import Root from './pages/Root.jsx';
import Rooms from './pages/Rooms.jsx';
import RoomDetail from './pages/RoomDetail.jsx';
import Library from './pages/Library.jsx';
import Settings from './pages/Settings.jsx';
import Auth from './pages/Auth.jsx';
import SignUp from './pages/SignUp.jsx';
// Removed YouTubeSearch page; search is now on Home

function Protected({ children }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <RoomProvider>
        <BrowserRouter>
          <App>
            <Routes>
              <Route path="/" element={<Root />} />
              <Route path="/sign-in" element={<Auth />} />
              <Route path="/sign-up" element={<SignUp />} />
              <Route path="/rooms" element={<Protected><Rooms /></Protected>} />
              <Route path="/rooms/:id" element={<Protected><RoomDetail /></Protected>} />
              {/** YouTubeSearch route removed; redirect users to Home for search */}
              <Route path="/playlists" element={<Protected><Library /></Protected>} />
              <Route path="/library" element={<Protected><Library /></Protected>} />
              <Route path="/settings" element={<Protected><Settings /></Protected>} />
            </Routes>
          </App>
        </BrowserRouter>
      </RoomProvider>
    </ClerkProvider>
  </React.StrictMode>
);
