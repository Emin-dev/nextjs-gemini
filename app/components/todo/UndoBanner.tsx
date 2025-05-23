'use client';

import { Button } from '@/components/ui/button';
import type { Todo, UndoableActionDetails } from '../../types'; // Assuming types are in this path

interface UndoBannerProps {
  todo: Todo;
  undoableAction: UndoableActionDetails | null; // For initial (yellow) delete undo
  onUndo: () => void; // For initial (yellow) delete undo
  onRestorePendingDeletion?: () => void; // For red border undo
  currentTime?: number; // For calculating countdowns
  undoTimeoutDuration: number; // General 1-min undo
  filterSwitchDelay: number; // 20s for yellow phase

  // New props for detailed state display
  isYellowBorderPhase: boolean;
  yellowBorderCountdown: number; // Countdown for 20s yellow phase (time until move to deleted filter)
  isRedBorderPhase: boolean;
  redBorderCountdown: number; // Countdown for 1-min red phase (time until permanent delete)
  isStage1UndoActive: boolean; // Is the 1-min undo for the initial (yellow) delete active?
  stage1UndoCountdown: number; // Countdown for that 1-min undo
}

export function UndoBanner({
  todo,
  undoableAction,
  onUndo,
  onRestorePendingDeletion,
  currentTime,
  undoTimeoutDuration,
  filterSwitchDelay,
  isYellowBorderPhase,
  yellowBorderCountdown,
  isRedBorderPhase,
  redBorderCountdown,
  isStage1UndoActive,
  stage1UndoCountdown
}: UndoBannerProps) {

  if (!isYellowBorderPhase && !isRedBorderPhase && !isStage1UndoActive) {
    // If not in any specific deletion phase that requires a banner, render nothing.
    // Note: isStage1UndoActive is linked to isYellowBorderPhase but might have a slightly different lifespan (1min vs 20s focus)
    return null;
  }

  // Yellow Border Phase: Task marked for deletion, will move to 'Deleted' filter soon.
  // Also shows the 1-minute undo option for this initial deletion.
  if (isYellowBorderPhase && isStage1UndoActive) {
    return (
      <div className="mt-2 p-2.5 sm:p-3 bg-yellow-500/90 border border-yellow-400 rounded-md flex flex-col sm:flex-row justify-between items-center gap-2 animate-pulseSlow">
        <div className="text-sm sm:text-base font-bold text-black text-center sm:text-left">
          <p>Marked for deletion. Stays in this filter for {yellowBorderCountdown}s.</p>
          <p>Undo delete within {stage1UndoCountdown}s.</p>
        </div>
        <Button 
          onClick={onUndo} 
          variant="default"
          size="sm"
          className="bg-yellow-300 hover:bg-yellow-200 text-black font-bold text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5 h-auto focus:ring-yellow-400 focus:ring-offset-yellow-500 whitespace-nowrap"
          aria-label={`Undo initial delete for task: ${todo.text}`}
        >
          Undo ({stage1UndoCountdown}s)
        </Button>
      </div>
    );
  }

  // Red Border Phase: Task is in 'Deleted' filter, part of an "Empty Trash" batch, pending permanent deletion.
  if (isRedBorderPhase && onRestorePendingDeletion) {
    return (
      <div className="mt-2 p-2.5 sm:p-3 bg-red-600/90 border border-red-500 rounded-md flex flex-col sm:flex-row justify-between items-center gap-2 animate-pulse">
        <p className="text-sm sm:text-base font-bold text-white text-center sm:text-left">
          Permanently deleting in {redBorderCountdown}s...
        </p>
        <Button 
          onClick={onRestorePendingDeletion} 
          variant="default"
          size="sm"
          className="bg-red-400 hover:bg-red-300 text-white font-bold text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5 h-auto focus:ring-red-500 focus:ring-offset-red-600 whitespace-nowrap"
          aria-label={`Undo permanent deletion for task: ${todo.text}`}
        >
          Undo ({redBorderCountdown}s)
        </Button>
      </div>
    );
  }
  
  // Fallback or if only isStage1UndoActive is true without yellow border (should be rare with new logic)
  // This might happen if FILTER_SWITCH_DELAY is very short and 1-min undo is still active.
  if (isStage1UndoActive) {
     return (
      <div className="mt-2 p-2.5 sm:p-3 bg-yellow-500/90 border border-yellow-400 rounded-md flex justify-between items-center animate-pulseSlow">
        <p className="text-sm sm:text-base font-bold text-black">
          Task action can be undone ({stage1UndoCountdown}s left).
        </p>
        <Button 
          onClick={onUndo} 
          variant="default"
          size="sm"
          className="bg-yellow-300 hover:bg-yellow-200 text-black font-bold text-sm sm:text-base px-3 py-1.5 h-auto focus:ring-yellow-400 focus:ring-offset-yellow-500"
          aria-label={`Undo action for task: ${todo.text}`}
        >
          Undo Action
        </Button>
      </div>
    );
  }

  return null;
}
