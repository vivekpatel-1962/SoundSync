import React from 'react';
import { cn } from '../../lib/utils.js';

export const Input = React.forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-12 w-full rounded-[var(--radius)] border border-[var(--border)] px-4 py-3 text-base text-[var(--text-0)] placeholder:text-[var(--muted)] backdrop-blur-sm transition-all duration-200',
        'bg-[var(--input-bg)] focus:bg-[var(--input-bg-focus)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:border-[var(--border)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
