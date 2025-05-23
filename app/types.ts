export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  isDeleted?: boolean; // True if permanently deleted
  markedForDeletionAt?: number; // Timestamp when user initially clicks delete (for 20s filter delay)
  pendingFinalDeletionTimestamp?: number | null; // End of 1-min "red timer" undo window
  deletionConfirmedAt?: number; // Timestamp when the 1-minute undo window expired
  restoreExpiresAt?: number; // Timestamp for the 5-minute "green button" restore window
  batchId?: string | null; // Added batchId back as it is used in app/page.tsx
}

export interface UndoableActionDetails {
  id: number;
  actionType: 'delete' | 'restore';
  timestamp: number;
  originalTodo: Todo;
}

export type FilterValue = 'all' | 'active' | 'completed' | 'deleted';

export interface EmptyingTrashBatchDetails {
  batchId: string;
  taskIds: number[];
  initiatedAt: number;
  tasksSnapshot: Todo[]; // To store the state of tasks at the moment of batch initiation
}
