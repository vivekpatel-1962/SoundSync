import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { Button } from './ui/button.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { cn } from '../lib/utils.js';
import Logo from './Logo.jsx';

export default function NavBar() {
  const navClass = ({ isActive }) => cn(
    'px-4 py-2 rounded-[var(--radius)] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] border',
    isActive 
      ? 'text-[var(--text-0)] border-[var(--border)] bg-[var(--bg-2)] shadow-md'
      : 'text-[var(--text-1)] border-transparent hover:text-[var(--text-0)] hover:bg-[var(--bg-2)] hover:border-[var(--border)]'
  );
  return (
    <header className="app-navbar sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-1)] shadow-lg">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-4">
          <Logo className="w-10 h-10 text-red-500" />
          <span className="font-extrabold text-3xl md:text-4xl tracking-tight gradient-text">Moodcast</span>
        </Link>
        <div className="flex items-center gap-4 md:gap-6">
          <nav className="flex items-center gap-3 md:gap-4 text-base md:text-lg">
            <SignedIn>
              <NavLink className={navClass} to="/">Home</NavLink>
            </SignedIn>
            <SignedOut>
              <Link className={navClass({ isActive: false })} to="/#home">Home</Link>
            </SignedOut>
            <SignedIn>
              <NavLink className={navClass} to="/rooms">Rooms</NavLink>
              <NavLink className={navClass} to="/playlists">Playlists</NavLink>
            </SignedIn>
            <SignedOut>
              <Link className={navClass({ isActive: false })} to="/#rooms">Rooms</Link>
              <Link className={navClass({ isActive: false })} to="/#playlists">Playlists</Link>
            </SignedOut>
            <SignedIn>
              <NavLink className={navClass} to="/settings">Settings</NavLink>
            </SignedIn>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignedIn>
              <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: 'w-10 h-10' } }} />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg">Login</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="lg" variant="secondary">Sign up</Button>
              </SignUpButton>
            </SignedOut>
          </div>
        </div>
      </div>
    </header>
  );
}