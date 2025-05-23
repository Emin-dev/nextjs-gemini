'use client';

import { TodoItem } from './TodoItem';
import type { Todo, UndoableActionDetails, EmptyingTrashBatchDetails, FilterValue } from '../../types'; // Added FilterValue

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void; 
  onUpdateText: (id: string, newText: string) => void;
  undoableActions: Map<string, UndoableActionDetails>; 
  onUndo: (id: string) => void; 
  undoTimeoutDuration: number;
  onRestorePendingDeletion?: (id: string) => void; 
  currentTime: number; 
  emptyingTrashBatch: EmptyingTrashBatchDetails | null; 
  currentFilter: FilterValue; // Added currentFilter
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
  emptyingTrashBatch,
  currentFilter // Added currentFilter
}: TodoListProps) {

  return (
    <ul className="space-y-3 mt-4">
      {todos.map(todo => {
        const currentUndoAction = undoableActions.get(String(todo.id)) || null; // Ensure string ID for map lookup
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
            currentFilter={currentFilter} // Pass currentFilter to TodoItem
          />
        );
      })}
    </ul>
  );
}
