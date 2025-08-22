import React from 'react';
import { cn } from '../../lib/utils.js';

export function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-md bg-[var(--bg-2)]', className)} {...props} />;
}
