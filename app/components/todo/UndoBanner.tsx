'use client';

import { Button } from "@/components/ui/button";
import type { Todo } from "../../types";

interface UndoBannerProps {
  todo: Todo; 
  isRedBorderPhase: boolean;
  redBorderCountdown: string; 
  onRestorePendingDeletion?: () => void; 
}

export function UndoBanner({
  todo,
  isRedBorderPhase,
  redBorderCountdown,
  onRestorePendingDeletion,
}: UndoBannerProps) {

  // Red Border Phase: Task is pending permanent deletion (Stage 2 grace period / part of emptying trash batch).
  if (isRedBorderPhase && onRestorePendingDeletion) {
    return (
      <div className="mt-2 p-2 bg-red-600/80 border border-red-500 rounded-md flex flex-col sm:flex-row justify-between items-center gap-1.5 animate-pulse">
        <p className="text-xs sm:text-sm font-medium text-white text-center sm:text-left">
          Permanently deleting in {redBorderCountdown}...
        </p>
        <Button 
          onClick={onRestorePendingDeletion} 
          variant="default"
          size="sm" // Changed from "xs" to "sm"
          className="bg-red-400 hover:bg-red-300 text-white font-semibold text-xs px-2 py-1 h-auto focus:ring-red-500 focus:ring-offset-red-600 whitespace-nowrap"
          aria-label={`Undo permanent deletion for task. ${redBorderCountdown} remaining.`}
          title={`Undo permanent deletion (${redBorderCountdown} remaining)`}
        >
          Undo ({redBorderCountdown})
        </Button>
      </div>
    );
  }
  
  return null; 
}
