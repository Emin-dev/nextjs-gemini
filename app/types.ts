export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  isDeleted?: boolean; // True if soft-deleted and confirmed (e.g., after 20s delay, or if undo for initial delete expires)
  markedForDeletionAt?: number | null; // Timestamp when user initially clicks delete (starts 20s yellow border phase)
  pendingFinalDeletionTimestamp?: number | null; // Timestamp for 1-minute red border individual undo window (when in emptying trash batch)
  batchId?: string | null; // Identifies tasks belonging to the same "empty trash" batch
}

export interface UndoableActionDetails {
  id: number;
  actionType: 'delete' | 'restore'; // 'delete' for initial soft delete, 'restore' for undoing that
  timestamp: number;
  originalTodo: Todo; // Snapshot of the todo before the action
}

export type FilterValue = 'all' | 'active' | 'completed' | 'deleted';

export interface EmptyingTrashBatchDetails {
  batchId: string;
  taskIds: number[];
  initiatedAt: number; // Timestamp when this batch was created (for 5-min "Restore All" window)
  tasksSnapshot: Todo[]; // Snapshot of tasks at the moment of batch initiation (for "Restore All")
}
