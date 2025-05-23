import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { EmptyingTrashBatchDetails } from "../types"; // Assuming types.ts is in app/

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getGlobalRestoreTimeRemaining = (
  emptyingTrashBatch: EmptyingTrashBatchDetails | null,
  currentTime: number,
  restoreWindowDuration: number
): string => {
  if (!emptyingTrashBatch) return '';
  const timeLeftMs = (emptyingTrashBatch.initiatedAt + restoreWindowDuration) - currentTime;
  if (timeLeftMs <= 0) return '0:00';
  const minutes = Math.floor(timeLeftMs / 60000);
  const seconds = Math.floor((timeLeftMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
