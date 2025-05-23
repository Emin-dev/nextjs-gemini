'use client';

import { TodoItem } from './TodoItem';
import type { Todo, UndoableActionDetails, EmptyingTrashBatchDetails } from '../../types';

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: number) => void;
  onRemove: (id: number) => void; // Initial delete (yellow border)
  onUpdateText: (id: number, newText: string) => void;
  undoableActions: Map<number, UndoableActionDetails>; // For initial soft delete
  onUndo: (id: number) => void; // Handles undo for initial soft delete
  undoTimeoutDuration: number;
  onRestorePendingDeletion?: (id: number) => void; // For undoing a red-border item
  currentTime?: number;
  emptyingTrashBatch: EmptyingTrashBatchDetails | null; // To know if a task is part of the current batch
}

const EmptyStateIcon = () => (
  <svg 
    className="mx-auto h-12 w-12 text-slate-600" 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor" 
    aria-hidden="true"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth="2" 
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
    />
  </svg>
);

export function TodoList({ 
  todos, 
  onToggle, 
  onRemove, 
  onUpdateText, 
  undoableActions, 
  onUndo, 
  undoTimeoutDuration,
  onRestorePendingDeletion,
  currentTime,
  emptyingTrashBatch
}: TodoListProps) {
  
  // Empty state is now handled by the Home component itself.
  // If todos array is empty here, it means they were filtered out, which is fine.
  // We will still render the ul if todos is empty, and map will render nothing.

  return (
    <ul className="space-y-3 mt-4">
      {todos.map(todo => {
        const currentUndoAction = undoableActions.get(todo.id) || null;
        return (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onRemove={onRemove} // Pass down initial delete handler
            onUpdateText={onUpdateText}
            undoableAction={currentUndoAction} // For initial soft delete (yellow border phase)
            onUndo={onUndo} // For initial soft delete (yellow border phase)
            undoTimeoutDuration={undoTimeoutDuration}
            onRestorePendingDeletion={onRestorePendingDeletion} // For red-border items
            currentTime={currentTime}
            emptyingTrashBatch={emptyingTrashBatch} // For red-border items
          />
        );
      })}
    </ul>
  );
}
