import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { EmptyingTrashBatchDetails } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getGlobalRestoreTimeRemaining(
  emptyingTrashBatch: EmptyingTrashBatchDetails | null,
  currentTime: number,
  globalRestoreWindow: number
): string {
  // The global restore window starts *after* all individual timers in the batch have ended.
  if (!emptyingTrashBatch || !emptyingTrashBatch.allIndividualTimersEndedForBatch || !emptyingTrashBatch.batchCompletionTime) {
    return "0s"; // Or an appropriate string indicating the window isn't active
  }

  const timeRemaining = (emptyingTrashBatch.batchCompletionTime + globalRestoreWindow) - currentTime;
  
  if (timeRemaining <= 0) return "0s";
  
  const minutes = Math.floor(timeRemaining / (60 * 1000));
  const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
