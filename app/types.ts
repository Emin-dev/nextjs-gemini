export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  isDeleted?: boolean;
  pendingFinalDeletionTimestamp?: number | null;
  batchId?: string | null;
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
  tasksSnapshot: Todo[];
}
