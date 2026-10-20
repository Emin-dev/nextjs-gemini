'use client';

import { Button } from '@/components/ui/button';
import type { EmptyingTrashBatchDetails, FilterValue } from '../../types';

interface TodoFooterProps {
  activeTasksCount: number;
  softDeletedAndStage2Count: number;
  filter: FilterValue;
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  itemsEligibleForEmptyTrash: number; 
  onInitiateEmptyTrash: () => void; 
  onRestoreAllPendingDeletion: () => void;
  globalRestoreTimeRemainingString: string; 
  showGlobalRestoreButton: boolean; 
  isClient: boolean;
  initialLoadComplete: boolean;
  isActionInProgress: boolean;
}

export function TodoFooter({
  activeTasksCount,
  softDeletedAndStage2Count,
  filter,
  emptyingTrashBatch,
  itemsEligibleForEmptyTrash,
  onInitiateEmptyTrash,
  onRestoreAllPendingDeletion,
  globalRestoreTimeRemainingString,
  showGlobalRestoreButton,
  isClient,
  initialLoadComplete,
  isActionInProgress,
}: TodoFooterProps) {
  if (!isClient || !initialLoadComplete) return null;

  const displayClearDeletedButton = 
    filter === 'deleted' && 
    itemsEligibleForEmptyTrash > 0 &&
    (!emptyingTrashBatch || emptyingTrashBatch.isRestored || emptyingTrashBatch.allIndividualTimersEndedForBatch);

  return (
    <div className="text-xs sm:text-sm text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 pt-4 border-t border-slate-700">
      <div className="text-center sm:text-left">
        You have <span className="font-bold text-cyan-400 mx-1">{activeTasksCount}</span> active task(s).
        {softDeletedAndStage2Count > 0 && filter !== 'deleted' && (
          <span className="ml-1 text-yellow-500">({softDeletedAndStage2Count} deleted)</span>
        )}
         {filter === 'deleted' && softDeletedAndStage2Count > 0 && (
          <span className="ml-1 text-yellow-500">({softDeletedAndStage2Count} task(s) in Deleted)</span>
        )}
      </div>
      <div className="flex gap-2">
        {displayClearDeletedButton && (
            <Button
            onClick={onInitiateEmptyTrash} 
            variant="destructive"
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white font-semibold focus:ring-red-400 focus:ring-offset-slate-800"
            aria-label={`Initiate permanent deletion for ${itemsEligibleForEmptyTrash} deleted tasks`}
            disabled={isActionInProgress && !emptyingTrashBatch?.isRestored}
            >
            Clear Deleted ({itemsEligibleForEmptyTrash})
            </Button>
        )}
        {showGlobalRestoreButton && emptyingTrashBatch && !emptyingTrashBatch.isRestored && (
            <Button
                onClick={onRestoreAllPendingDeletion}
                variant="default"
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white font-semibold focus:ring-green-400 focus:ring-offset-slate-800"
                aria-label={`Restore ${emptyingTrashBatch.tasksSnapshot.length} tasks from recently cleared batch. ${globalRestoreTimeRemainingString} left.`}
                disabled={isActionInProgress && !showGlobalRestoreButton} 
            >
                Restore Batch ({emptyingTrashBatch.tasksSnapshot.length}) - {globalRestoreTimeRemainingString}
            </Button>
        )}
      </div>
    </div>
  );
}
