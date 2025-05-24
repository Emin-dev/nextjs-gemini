'use client';

import { TodoItem } from './TodoItem';
import type { Todo, UndoableActionDetails, EmptyingTrashBatchDetails, FilterValue } from '../../types';

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: number) => void;
  onRemove: (id: number) => void; 
  onUpdateText: (id: number, newText: string) => void;
  onRestoreItem: (id: number) => void; // Added for individual restore
  undoableActions: Map<number, UndoableActionDetails>; 
  onUndo: (id: number) => void; 
  undoTimeoutDuration: number;
  onRestorePendingDeletion?: (id: number) => void; 
  currentTime: number; 
  emptyingTrashBatch: EmptyingTrashBatchDetails | null; 
  currentFilter: FilterValue;
}

export function TodoList({ 
  todos, 
  onToggle, 
  onRemove, 
  onUpdateText, 
  onRestoreItem, // Destructure new prop
  undoableActions, 
  onUndo, 
  undoTimeoutDuration,
  onRestorePendingDeletion,
  currentTime,
  emptyingTrashBatch,
  currentFilter
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
            onRestoreItem={onRestoreItem} // Pass onRestoreItem to TodoItem
            undoableAction={currentUndoAction}
            onUndo={onUndo}
            undoTimeoutDuration={undoTimeoutDuration}
            onRestorePendingDeletion={onRestorePendingDeletion}
            currentTime={currentTime}
            emptyingTrashBatch={emptyingTrashBatch}
            currentFilter={currentFilter}
          />
        );
      })}
    </ul>
  );
}
