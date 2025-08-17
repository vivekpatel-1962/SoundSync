import React from 'react';
import { cn } from '../../lib/utils.js';

const variants = {
  default: 'text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700',
  secondary: 'bg-slate-700/80 text-white hover:bg-slate-600/90 backdrop-blur-sm border border-slate-600/50 shadow-md hover:shadow-lg',
  outline: 'border border-slate-600/50 bg-transparent hover:bg-slate-800/50 backdrop-blur-sm',
  ghost: 'bg-transparent hover:bg-slate-800/60 backdrop-blur-sm',
  link: 'bg-transparent text-indigo-400 underline-offset-4 hover:underline hover:text-indigo-300 p-0 h-auto'
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  default: 'h-10 px-4',
  lg: 'h-11 px-5',
  icon: 'h-10 w-10 p-0'
};

export function Button({ variant = 'default', size = 'default', className, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-50 disabled:pointer-events-none';
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
