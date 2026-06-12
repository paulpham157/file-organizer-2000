import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: unknown[]): string {
  return twMerge(clsx(...inputs));
}

/**
 * A wrapper for className strings using Tailwind's cn utility
 * This provides proper merging of Tailwind classes
 * 
 * @param classNames The Tailwind class names
 * @returns The merged class string
 */
export function tw(...classNames: unknown[]): string {
  return cn(...classNames);
}