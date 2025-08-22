import React from 'react';
import { cn } from '../../lib/utils.js';

export function Card({ className, ...props }) {
  return <div className={cn('rounded-[var(--radius)] border border-[var(--border)] text-[var(--text-0)] shadow-xl backdrop-blur-md bg-[var(--panel)]', className)} {...props} />;
}
export function CardHeader({ className, ...props }) {
  return <div className={cn('p-4 pb-0', className)} {...props} />;
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />;
}
export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-[var(--text-1)]', className)} {...props} />;
}
export function CardContent({ className, ...props }) {
  return <div className={cn('p-4', className)} {...props} />;
}
export function CardFooter({ className, ...props }) {
  return <div className={cn('p-4 pt-0', className)} {...props} />;
}
