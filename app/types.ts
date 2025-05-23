export interface Todo {
  id: string; // Changed to string for unique IDs
  text: string;
  completed: boolean;
  isDeleted: boolean; // True if soft-deleted and confirmed
  markedForDeletionAt: number | null; // Timestamp for initial 20s undo window (yellow border)
  pendingFinalDeletionTimestamp: number | null; // Timestamp for 1-minute individual final deletion grace period (red border)
  stage2BatchId: string | null; // ID for the batch during the 1-minute individual countdowns
  isAIGenerated?: boolean; // Optional flag for AI-generated tasks
}

export interface UndoableActionDetails {
  id: string; // Changed to string
  actionType: 'delete' | 'restore';
  timestamp: number;
  originalTodo: Todo;
}

export type FilterValue = 'all' | 'active' | 'completed' | 'deleted';

// Details for managing a batch of tasks being emptied from trash
export interface EmptyingTrashBatchDetails {
  batchId: string; // Unique ID for this emptying operation
  taskIdsInBatch: string[]; // Changed to string[]
  tasksSnapshot: Todo[]; // Snapshot of tasks as they were when "Empty Trash" was clicked
  batchInitiationTime: number; // Timestamp when the "Empty Trash" was clicked (starts individual 1-min timers)
  allIndividualTimersEndedForBatch: boolean; // True when all tasks in this batch have passed their 1-min timer
  batchCompletionTime?: number; // Timestamp when the last 1-min timer in this batch ended (starts 5-min global restore window)
  isRestored?: boolean; // Flag to indicate if this batch was restored via the global restore
}
