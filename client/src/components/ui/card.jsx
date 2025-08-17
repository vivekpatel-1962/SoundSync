import React from 'react';
import { cn } from '../../lib/utils.js';

export function Card({ className, ...props }) {
  return <div className={cn('rounded-xl border border-slate-700/50 text-slate-100 shadow-lg backdrop-blur-sm bg-gradient-to-br from-slate-800/80 to-slate-700/60', className)} {...props} />;
}
export function CardHeader({ className, ...props }) {
  return <div className={cn('p-4 pb-0', className)} {...props} />;
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />;
}
export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-slate-400', className)} {...props} />;
}
export function CardContent({ className, ...props }) {
  return <div className={cn('p-4', className)} {...props} />;
}
export function CardFooter({ className, ...props }) {
  return <div className={cn('p-4 pt-0', className)} {...props} />;
}
