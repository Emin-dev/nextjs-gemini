'use client';

import { TodoItem } from './TodoItem';
import type { Todo, UndoableActionDetails } from '../../types'; // Updated import path for Todo

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
  onUpdateText: (id: number, newText: string) => void;
  undoableActions: Map<number, UndoableActionDetails>;
  onUndo: (id: number) => void;
  undoTimeoutDuration: number;
  // New props for Stage 2 grace period
  onRestoreDuringGracePeriod?: (id: number) => void;
  currentTime?: number;
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
  onRestoreDuringGracePeriod, // Pass down
  currentTime // Pass down
}: TodoListProps) {
  
  if (todos.length === 0) {
    return (
      <div className="text-center text-slate-500 mt-10 p-6 border-2 border-dashed border-slate-700 rounded-lg">
        <EmptyStateIcon />
        <h3 className="mt-2 text-xl font-semibold text-slate-400">No tasks to display</h3>
        <p className="mt-1 text-sm text-slate-500">Try a different filter or add new tasks.</p>
      </div>
    );
  }

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
            onRestoreDuringGracePeriod={onRestoreDuringGracePeriod}
            currentTime={currentTime}
          />
        );
      })}
    </ul>
  );
}
