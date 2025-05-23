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
  actionType: 'delete' | 'restore'; // Simplified for current use, was: 'delete' | 'complete' | 'uncomplete'
  timestamp: number; // Keep this for potential future use, though not directly used in page.tsx logic for undo
  originalTodo: Todo; // Changed from originalState: Partial<Todo>
}
