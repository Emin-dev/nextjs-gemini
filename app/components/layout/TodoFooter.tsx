'use client';

import { Button } from '@/components/ui/button';
import type { EmptyingTrashBatchDetails } from '../../types';

interface TodoFooterProps {
  activeTasksCount: number;
  softDeletedAndStage2Count: number;
  filter: string; // current filter
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  itemsEligibleForEmptyTrash: number;
  onInitiateEmptyTrash: () => void;
  onRestoreAllPendingDeletion: () => void;
  getGlobalRestoreTimeRemaining: () => string;
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
  getGlobalRestoreTimeRemaining,
  isClient,
  initialLoadComplete,
  isActionInProgress
}: TodoFooterProps) {
  if (!isClient || !initialLoadComplete) return null;

  return (
    <div className="text-xs sm:text-sm text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 pt-4 border-t border-slate-700">
      <div className="text-center sm:text-left">
        You have <span className="font-bold text-sky-400 mx-1">{activeTasksCount}</span> active task(s).
        {softDeletedAndStage2Count > 0 && (
          <span className="ml-1 text-yellow-400">({softDeletedAndStage2Count} in trash/pending final deletion)</span>
        )}
      </div>
      <div className="flex gap-2">
        {filter === 'deleted' && !emptyingTrashBatch && itemsEligibleForEmptyTrash > 0 && (
            <Button
            onClick={onInitiateEmptyTrash}
            variant="destructive"
            size="sm"
            aria-label={`Initiate final deletion for ${itemsEligibleForEmptyTrash} tasks`}
            disabled={isActionInProgress || itemsEligibleForEmptyTrash === 0}
            >
            Empty Trash ({itemsEligibleForEmptyTrash})
            </Button>
        )}
        {emptyingTrashBatch && (
            <Button
                onClick={onRestoreAllPendingDeletion}
                variant="default"
                size="sm"
                className="bg-green-500 hover:bg-green-400 text-black font-bold text-sm sm:text-base px-3 py-1.5 h-auto focus:ring-green-600 focus:ring-offset-slate-800"
            >
                Restore All ({emptyingTrashBatch.tasksSnapshot.length}) - {getGlobalRestoreTimeRemaining()}
            </Button>
        )}
      </div>
    </div>
  );
}
