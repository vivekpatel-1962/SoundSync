import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { Button } from './ui/button.jsx';
import { cn } from '../lib/utils.js';

export default function NavBar() {
  const navClass = ({ isActive }) => cn(
    'px-3 py-1.5 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30',
    isActive 
      ? 'text-white bg-gradient-to-r from-indigo-500/20 to-purple-500/20 backdrop-blur-sm border border-indigo-500/30 shadow-lg' 
      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 backdrop-blur-sm'
  );
  return (
    <header className="border-b border-slate-700/50 sticky top-0 z-40 backdrop-blur-md bg-gradient-to-r from-slate-900/80 to-slate-800/80 shadow-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="font-extrabold text-2xl gradient-text">
          Moodcast
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <NavLink className={navClass} to="/">Home</NavLink>
          <NavLink className={navClass} to="/rooms">Rooms</NavLink>
          <NavLink className={navClass} to="/playlists">Playlists</NavLink>
          <NavLink className={navClass} to="/settings">Settings</NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <SignedIn>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8' } }} />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal" signUpUrl="/sign-up">
              <Button>Login</Button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
