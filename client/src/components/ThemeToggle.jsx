import React from 'react';

export default function ThemeToggle() {
  const [mode, setMode] = React.useState('dark');

  React.useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light') {
      document.documentElement.classList.add('theme-light');
      setMode('light');
    } else {
      document.documentElement.classList.remove('theme-light');
      setMode('dark');
    }
  }, []);

  const setLight = () => {
    document.documentElement.classList.add('theme-light');
    localStorage.setItem('theme', 'light');
    setMode('light');
  };
  const setDark = () => {
    document.documentElement.classList.remove('theme-light');
    localStorage.setItem('theme', 'dark');
    setMode('dark');
  };
  const toggle = () => (mode === 'light' ? setDark() : setLight());

  const isLight = mode === 'light';

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
    if (e.key === 'ArrowLeft') setDark();
    if (e.key === 'ArrowRight') setLight();
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'Switch to dark' : 'Switch to light'}
      title={isLight ? 'Switch to dark' : 'Switch to light'}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={[
        'relative inline-flex items-center h-9 w-[72px] rounded-full border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] shadow-md will-change-transform backdrop-blur-sm',
        'bg-[var(--bg-2)] border-[var(--border)]'
      ].join(' ')}
    >
      {/* side icons removed for pure-knob design */}

      {/* Sliding knob with active icon */}
      <span
        className={[
          'absolute top-1 left-1 h-7 w-7 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 text-sm',
          'bg-[var(--btn-fg)] text-black',
          isLight ? 'translate-x-[36px]' : 'translate-x-0'
        ].join(' ')}
      >
        {isLight ? (
          // Sun: filled core with 8 rays
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-4 h-4"
            aria-hidden
          >
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M12 2v3" />
              <path d="M12 19v3" />
              <path d="M2 12h3" />
              <path d="M19 12h3" />
              <path d="M4.22 4.22l2.12 2.12" />
              <path d="M17.66 17.66l2.12 2.12" />
              <path d="M4.22 19.78l2.12-2.12" />
              <path d="M17.66 6.34l2.12-2.12" />
            </g>
          </svg>
        ) : (
          // Moon: crescent
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-4 h-4"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
