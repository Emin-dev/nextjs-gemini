import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { EmptyingTrashBatchDetails } from '../types'; // Assuming EmptyingTrashBatchDetails is in app/types.ts

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getGlobalRestoreTimeRemaining(
  emptyingTrashBatch: EmptyingTrashBatchDetails | null,
  currentTime: number,
  globalRestoreWindow: number
): string {
  if (!emptyingTrashBatch) return "0s";
  const timeRemaining = (emptyingTrashBatch.initiatedAt + globalRestoreWindow) - currentTime;
  if (timeRemaining <= 0) return "0s";
  const minutes = Math.floor(timeRemaining / (60 * 1000));
  const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
