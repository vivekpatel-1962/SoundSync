import React from 'react';
import { cn } from '../../lib/utils.js';

const variants = {
  default:
    'text-[var(--btn-fg)] shadow-lg hover:shadow-xl hover:-translate-y-0.5 bg-[var(--btn-bg)] hover:bg-[var(--btn-bg-hover)]',
  secondary:
    'text-[var(--text-0)] border border-[var(--border)] backdrop-blur-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 bg-[var(--bg-2)] hover:bg-[var(--bg-1)]',
  outline:
    'text-[var(--text-0)] border border-[var(--border)] bg-transparent hover:bg-[var(--bg-2)] backdrop-blur-sm',
  ghost:
    'text-[var(--text-0)] bg-transparent hover:bg-[var(--bg-2)]',
  link:
    'bg-transparent text-[var(--text-1)] underline-offset-4 hover:underline hover:text-[var(--text-0)] p-0 h-auto'
};

const sizes = {
  sm: 'h-10 px-4 text-base',
  default: 'h-11 px-5 text-base',
  lg: 'h-12 px-6 text-lg',
  icon: 'h-11 w-11 p-0'
};

export function Button({ variant = 'default', size = 'default', className, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50 disabled:pointer-events-none will-change-transform';
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
