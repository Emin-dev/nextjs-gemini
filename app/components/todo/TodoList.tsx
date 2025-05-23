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
  currentTime: number; // Changed from optional to required number
  emptyingTrashBatch: EmptyingTrashBatchDetails | null; // To know if a task is part of the current batch
}

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

  return (
    <ul className="space-y-3 mt-4">
      {todos.map(todo => {
        const currentUndoAction = undoableActions.get(todo.id) || null;
        return (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onRemove={onRemove}
            onUpdateText={onUpdateText}
            undoableAction={currentUndoAction}
            onUndo={onUndo}
            undoTimeoutDuration={undoTimeoutDuration}
            onRestorePendingDeletion={onRestorePendingDeletion}
            currentTime={currentTime}
            emptyingTrashBatch={emptyingTrashBatch}
          />
        );
      })}
    </ul>
  );
}
