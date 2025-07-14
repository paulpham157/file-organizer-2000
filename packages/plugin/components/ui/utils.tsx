import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import React from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Style-isolated container component
 * 
 * This component wraps others with proper class isolation to prevent
 * Obsidian styles from affecting our custom components.
 */
export function StyledContainer({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("fo-container h-full", className)} {...props}>
      {children}
    </div>
  );
}