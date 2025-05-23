'use client';

import { Button } from '@/components/ui/button';
import type { EmptyingTrashBatchDetails, FilterValue } from '../../types'; // Ensure FilterValue is imported if used explicitly
import { STAGE_4_GLOBAL_RESTORE_WINDOW } from '../../lib/constants'; // For restore all button timer

interface TodoFooterProps {
  activeTasksCount: number;
  softDeletedAndStage2Count: number;
  filter: FilterValue; // Use FilterValue type
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  itemsEligibleForEmptyTrash: number;
  onInitiateEmptyTrash: () => void;
  onRestoreAllPendingDeletion: () => void;
  getGlobalRestoreTimeRemaining: () => string; // This function will format the time
  isClient: boolean;
  initialLoadComplete: boolean;
  isActionInProgress: boolean;
  currentTime: number; // Pass current time to determine if restore button is active
}

export function TodoFooter({
  activeTasksCount,
  softDeletedAndStage2Count,
  filter,
  emptyingTrashBatch,
  itemsEligibleForEmptyTrash,
  onInitiateEmptyTrash,
  onRestoreAllPendingDeletion,
  getGlobalRestoreTimeRemaining, // This is now just for display formatting
  isClient,
  initialLoadComplete,
  isActionInProgress,
  currentTime
}: TodoFooterProps) {
  if (!isClient || !initialLoadComplete) return null;

  const showEmptyTrashButton = filter === 'deleted' && 
                               !emptyingTrashBatch && 
                               itemsEligibleForEmptyTrash > 0;

  const showRestoreAllButton = emptyingTrashBatch && 
                               emptyingTrashBatch.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW > currentTime;

  return (
    <div className="text-xs sm:text-sm text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 pt-4 border-t border-slate-700">
      <div className="text-center sm:text-left">
        You have <span className="font-bold text-sky-400 mx-1">{activeTasksCount}</span> active task(s).
        {softDeletedAndStage2Count > 0 && filter !== 'deleted' && (
          <span className="ml-1 text-yellow-400">({softDeletedAndStage2Count} in trash)</span>
        )}
         {filter === 'deleted' && softDeletedAndStage2Count > 0 && (
          <span className="ml-1 text-yellow-400">({softDeletedAndStage2Count} item(s) in trash)</span>
        )}
      </div>
      <div className="flex gap-2">
        {showEmptyTrashButton && (
            <Button
            onClick={onInitiateEmptyTrash}
            variant="destructive"
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white font-semibold focus:ring-red-400"
            aria-label={`Initiate final deletion for ${itemsEligibleForEmptyTrash} tasks`}
            disabled={isActionInProgress || itemsEligibleForEmptyTrash === 0}
            >
            Empty Trash ({itemsEligibleForEmptyTrash})
            </Button>
        )}
        {showRestoreAllButton && emptyingTrashBatch && (
            <Button
                onClick={onRestoreAllPendingDeletion}
                variant="default"
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white font-semibold focus:ring-green-400"
            >
                Restore All ({emptyingTrashBatch.tasksSnapshot.length}) - {getGlobalRestoreTimeRemaining()}
            </Button>
        )}
      </div>
    </div>
  );
}
