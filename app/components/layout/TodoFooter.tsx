'use client';

import { Button } from '@/components/ui/button';
import type { EmptyingTrashBatchDetails, FilterValue } from '../../types';
// STAGE_4_GLOBAL_RESTORE_WINDOW is implicitly handled by showGlobalRestoreButton and globalRestoreTimeRemainingString props

interface TodoFooterProps {
  activeTasksCount: number;
  softDeletedAndStage2Count: number;
  filter: FilterValue;
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  itemsEligibleForEmptyTrash: number;
  onInitiateEmptyTrash: () => void;
  onRestoreAllPendingDeletion: () => void;
  globalRestoreTimeRemainingString: string; // Direct string from app/page.tsx
  showGlobalRestoreButton: boolean; // Direct boolean from app/page.tsx
  isClient: boolean;
  initialLoadComplete: boolean;
  isActionInProgress: boolean;
  // currentTime: number; // No longer explicitly needed here if button visibility is passed as prop
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

  // Button to start the "Empty Trash" process (1-minute individual timers)
  const displayEmptyTrashButton = 
    filter === 'deleted' && 
    itemsEligibleForEmptyTrash > 0 &&
    (!emptyingTrashBatch || emptyingTrashBatch.isRestored || emptyingTrashBatch.allIndividualTimersEndedForBatch);
    // Show if in deleted filter, items are eligible, AND
    // (no batch active OR current batch was restored OR current batch finished all timers (allowing a new one))

  // Green button to restore the entire batch after all individual 1-min timers have ended.
  // Visibility is now controlled by the `showGlobalRestoreButton` prop from app/page.tsx

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
        {displayEmptyTrashButton && (
            <Button
            onClick={onInitiateEmptyTrash}
            variant="destructive"
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white font-semibold focus:ring-red-400"
            aria-label={`Initiate final deletion for ${itemsEligibleForEmptyTrash} tasks`}
            disabled={isActionInProgress && !(emptyingTrashBatch && emptyingTrashBatch.isRestored)}
            >
            Empty Trash ({itemsEligibleForEmptyTrash})
            </Button>
        )}
        {showGlobalRestoreButton && emptyingTrashBatch && !emptyingTrashBatch.isRestored && (
            <Button
                onClick={onRestoreAllPendingDeletion}
                variant="default"
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white font-semibold focus:ring-green-400"
                aria-label={`Restore ${emptyingTrashBatch.tasksSnapshot.length} tasks from recently emptied batch. ${globalRestoreTimeRemainingString} left.`}
                disabled={isActionInProgress && !showGlobalRestoreButton} // Disable if another action is broadly in progress, unless this button IS the current main available action
            >
                Restore Batch ({emptyingTrashBatch.tasksSnapshot.length}) - {globalRestoreTimeRemainingString}
            </Button>
        )}
      </div>
    </div>
  );
}
