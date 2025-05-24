import type { Todo, FilterValue, EmptyingTrashBatchDetails, UndoableActionDetails } from '../types';
import { STAGE_4_GLOBAL_RESTORE_WINDOW } from '../lib/constants';

interface GetEmptyStateMessageProps {
  isClient: boolean;
  initialLoadComplete: boolean;
  filteredAndSearchedTodosCount: number;
  totalTodosCount: number;
  searchQuery: string;
  filter: FilterValue;
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  showGlobalRestoreButton: boolean;
  globalRestoreTimeRemainingString: string;
  currentTime: number;
  itemsEligibleForEmptyTrash: number;
}

interface EmptyState {
  title: string;
  message: string;
}

export function getEmptyStateMessage({
  isClient,
  initialLoadComplete,
  filteredAndSearchedTodosCount,
  totalTodosCount,
  searchQuery,
  filter,
  emptyingTrashBatch,
  showGlobalRestoreButton,
  globalRestoreTimeRemainingString,
  currentTime,
  itemsEligibleForEmptyTrash,
}: GetEmptyStateMessageProps): EmptyState | null {
  if (!isClient || !initialLoadComplete) return null;
  if (filteredAndSearchedTodosCount > 0) return null;
  if (totalTodosCount === 0) return { title: "No tasks yet!", message: "Get started by adding a new task above." };
  if (searchQuery.trim() !== '') return { title: "No tasks found", message: `Your search for "${searchQuery}" did not match any tasks.` };
  if (filter === 'active') return { title: "No active tasks!", message: "All your tasks are completed or in Deleted." };
  if (filter === 'completed') return { title: "No completed tasks!", message: "Mark some tasks as completed to see them here." };
  if (filter === 'deleted') {
    if (emptyingTrashBatch && !emptyingTrashBatch.allIndividualTimersEndedForBatch) return { title: "Clearing Deleted Tasks...", message: "Tasks are in their 1-minute final countdown." };
    if (showGlobalRestoreButton) return { title: "Batch Cleared!", message: `You have ${globalRestoreTimeRemainingString} to restore the batch.` };
    if (emptyingTrashBatch && emptyingTrashBatch.allIndividualTimersEndedForBatch && !emptyingTrashBatch.isRestored && emptyingTrashBatch.batchCompletionTime && (currentTime - emptyingTrashBatch.batchCompletionTime >= STAGE_4_GLOBAL_RESTORE_WINDOW) ) return { title: "Global Restore Window Expired", message: "The chance to restore the batch has passed." };
    if (emptyingTrashBatch && emptyingTrashBatch.allIndividualTimersEndedForBatch && !emptyingTrashBatch.isRestored) return { title: "Global Restore Window Active", message: "The global restore window is currently active or just ended." }; 
    if (itemsEligibleForEmptyTrash > 0) return { title: "Deleted folder contains tasks!", message: "Use 'Clear Deleted' to start permanent deletion process." };
    return { title: "Deleted folder is empty!", message: "You haven't deleted any tasks yet, or no tasks match the current search in Deleted." };
  }
  return { title: "No tasks here", message: "Try a different filter or add some tasks!" };
}
