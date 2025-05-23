'use client';

import { Button } from '@/components/ui/button';
import type { Todo, UndoableActionDetails } from '../../types'; 

interface UndoBannerProps {
  todo: Todo;
  undoableAction: UndoableActionDetails | null; 
  onUndo?: () => void; // Made optional
  onRestorePendingDeletion?: () => void; 
  currentTime?: number; 
  undoTimeoutDuration: number; 
  filterSwitchDelay: number; 
  isYellowBorderPhase: boolean;
  yellowBorderCountdown: number; 
  isRedBorderPhase: boolean;
  redBorderCountdown: number; 
  isStage1UndoActive: boolean;
  stage1UndoCountdown: number;
  stage2GracePeriodDuration?: number; // Added this prop
}

export function UndoBanner({
  todo,
  onUndo,
  onRestorePendingDeletion,
  // isYellowBorderPhase, // This prop seems redundant if isStage1UndoActive is the primary driver for yellow banner
  isRedBorderPhase,
  redBorderCountdown,
  isStage1UndoActive,
  stage1UndoCountdown
}: UndoBannerProps) {

  // Stage 1 Undo Active (Yellow Banner for initial 20s delete)
  if (isStage1UndoActive && onUndo) { // Check if onUndo exists
    return (
      <div className="mt-2 p-2 bg-yellow-500/90 border border-yellow-400 rounded-lg flex justify-center items-center animate-pulseSlow">
        <Button 
          onClick={onUndo} 
          variant="default"
          size="sm"
          className="bg-yellow-300 hover:bg-yellow-200 text-black font-bold text-xs sm:text-sm px-3 py-1.5 h-auto rounded-md focus:ring-yellow-400 focus:ring-offset-yellow-500 whitespace-nowrap active:scale-95 active:opacity-75 transition-transform duration-75"
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
      <div className="mt-2 p-2.5 sm:p-3 bg-red-600/90 border border-red-500 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2 animate-pulse">
        <p className="text-sm sm:text-base font-bold text-white text-center sm:text-left">
          Permanently deleting in {redBorderCountdown}s...
        </p>
        <Button 
          onClick={onRestorePendingDeletion} 
          variant="default"
          size="sm"
          className="bg-red-400 hover:bg-red-300 text-white font-bold text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5 h-auto rounded-md focus:ring-red-500 focus:ring-offset-red-600 whitespace-nowrap active:scale-95 active:opacity-75 transition-transform duration-75"
          aria-label={`Undo permanent deletion for task: ${todo.text}`}
        >
          Undo ({redBorderCountdown}s)
        </Button>
      </div>
    );
  }
  
  // The fallback case for already deleted items with an active undo seems covered by the first block 
  // if `isStage1UndoActive` is true even when `todo.isDeleted` is true.

  return null;
}
