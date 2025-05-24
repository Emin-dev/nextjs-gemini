'use client';

import { Button } from "@/components/ui/button";
import type { Todo } from "../../types";

interface UndoBannerProps {
  todo: Todo;
  isStage1UndoActive: boolean;
  stage1UndoCountdown: number;
  onUndo?: () => void; // Optional: Only for stage 1 (soft delete undo)
  isRedBorderPhase: boolean;
  redBorderCountdown: number;
  onRestorePendingDeletion?: () => void; // Optional: Only for stage 2 (pending final deletion undo)
  isBatchRestorePhase?: boolean;
  batchRestoreCountdown?: number;
  onRestoreBatch?: () => void;
  batchTaskCount?: number;
}

export function UndoBanner({
  todo,
  isStage1UndoActive,
  stage1UndoCountdown,
  onUndo,
  isRedBorderPhase,
  redBorderCountdown,
  onRestorePendingDeletion,
  isBatchRestorePhase,
  batchRestoreCountdown,
  onRestoreBatch,
  batchTaskCount
}: UndoBannerProps) {

  // Batch Restore Banner (Footer Global)
  if (isBatchRestorePhase && onRestoreBatch && batchTaskCount && typeof batchRestoreCountdown !== 'undefined') {
    return (
      <div className="p-3 bg-blue-600/90 border border-blue-500 rounded-md flex flex-col sm:flex-row justify-between items-center gap-2 animate-pulse">
        <p className="text-sm sm:text-base font-bold text-white text-center sm:text-left">
          Restore batch of {batchTaskCount} tasks? Global restore ends in {batchRestoreCountdown}s...
        </p>
        <Button 
          onClick={onRestoreBatch} 
          variant="default"
          size="sm"
          className="bg-blue-400 hover:bg-blue-300 text-white font-bold text-xs sm:text-sm px-3 py-1.5 h-auto focus:ring-blue-500 focus:ring-offset-blue-600 whitespace-nowrap"
          aria-label={`Restore batch of ${batchTaskCount} tasks`}
        >
          Restore Batch ({batchRestoreCountdown}s)
        </Button>
      </div>
    );
  }

  // Stage 1 Undo Active (Yellow Banner for initial 20s delete)
  if (isStage1UndoActive && onUndo) { // Check if onUndo exists
    return (
      <div className="mt-2 p-1.5 bg-yellow-500/90 border border-yellow-400 rounded-md flex justify-center items-center animate-pulseSlow">
        <Button 
          onClick={onUndo} 
          variant="default"
          size="sm"
          className="bg-yellow-300 hover:bg-yellow-200 text-black font-bold text-xs sm:text-sm px-3 py-1 h-auto focus:ring-yellow-400 focus:ring-offset-yellow-500 whitespace-nowrap"
          aria-label={`Undo delete for task: ${todo.text}`}
        >
          Undo ({stage1UndoCountdown}s)
        </Button>
      </div>
    );
  }

  // Red Border Phase: Task is pending permanent deletion.
  if (isRedBorderPhase && onRestorePendingDeletion) {
    return (
      <div className="mt-2 p-2 bg-red-600/90 border border-red-500 rounded-md flex flex-col sm:flex-row justify-between items-center gap-1.5 animate-pulse">
        <p className="text-sm sm:text-base font-bold text-white text-center sm:text-left">
          Permanently deleting in {redBorderCountdown}s...
        </p>
        <Button 
          onClick={onRestorePendingDeletion} 
          variant="default"
          size="sm"
          className="bg-red-400 hover:bg-red-300 text-white font-bold text-xs sm:text-sm px-2 sm:px-3 py-1 h-auto focus:ring-red-500 focus:ring-offset-red-600 whitespace-nowrap"
          aria-label={`Undo permanent deletion for task: ${todo.text}`}
        >
          Undo ({redBorderCountdown}s)
        </Button>
      </div>
    );
  }
  
  // The fallback case for already deleted items with an active undo seems covered by the first block 
  // if `isStage1UndoActive` is true even when `todo.isDeleted` is true.

  return null; // No active undo state for this specific task or covered by global batch restore
}
