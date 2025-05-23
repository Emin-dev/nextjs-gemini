'use client';

import { Button } from '@/components/ui/button';

interface UndoBannerProps {
  isStage1UndoActive: boolean;
  stage1UndoCountdown: number;
  onUndo: () => void;
  isStage2GraceActive: boolean;
  stage2GraceCountdown: number;
  onRestoreDuringGracePeriod?: () => void; 
  todoText: string; // For accessibility and clarity in messages
}

export function UndoBanner({
  isStage1UndoActive,
  stage1UndoCountdown,
  onUndo,
  isStage2GraceActive,
  stage2GraceCountdown,
  onRestoreDuringGracePeriod,
  todoText
}: UndoBannerProps) {
  if (!isStage1UndoActive && !isStage2GraceActive) {
    return null;
  }

  if (isStage1UndoActive) {
    return (
      <div className="mt-2 p-2.5 sm:p-3 bg-yellow-500/90 border border-yellow-400 rounded-md flex justify-between items-center animate-pulseSlow">
        <p className="text-sm sm:text-base font-bold text-black">
          Marked for deletion. Undoing in {stage1UndoCountdown}s...
        </p>
        <Button 
          onClick={onUndo} 
          variant="default"
          size="sm"
          className="bg-yellow-300 hover:bg-yellow-200 text-black font-bold text-sm sm:text-base px-3 py-1.5 h-auto focus:ring-yellow-400 focus:ring-offset-yellow-500"
          aria-label={`Undo delete for task: ${todoText}`}
        >
          Undo Delete
        </Button>
      </div>
    );
  }

  if (isStage2GraceActive && onRestoreDuringGracePeriod) {
    return (
      <div className="mt-2 p-2.5 sm:p-3 bg-red-600/90 border border-red-500 rounded-md flex justify-between items-center animate-pulse">
        <p className="text-sm sm:text-base font-bold text-white">
          Pending final deletion. Undo in {stage2GraceCountdown}s...
        </p>
        <Button 
          onClick={onRestoreDuringGracePeriod} 
          variant="default"
          size="sm"
          className="bg-red-400 hover:bg-red-300 text-white font-bold text-sm sm:text-base px-3 py-1.5 h-auto focus:ring-red-500 focus:ring-offset-red-600"
          aria-label={`Restore task during grace period: ${todoText}`}
        >
          Undo
        </Button>
      </div>
    );
  }

  return null;
}
