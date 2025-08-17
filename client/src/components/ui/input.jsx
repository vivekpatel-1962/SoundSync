import React from 'react';
import { cn } from '../../lib/utils.js';

export const Input = React.forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-600/50 px-3 py-2 text-sm placeholder:text-slate-400 backdrop-blur-sm transition-all duration-200',
        'bg-slate-800/80 focus:bg-slate-800/90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
