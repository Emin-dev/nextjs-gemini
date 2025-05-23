'use client';

import { TodoItem, type Todo } from './TodoItem';
import type { UndoableActionDetails } from '../../page'; // Adjusted path

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
  onUpdateText: (id: number, newText: string) => void;
  undoableAction: UndoableActionDetails | null; // Added
  onUndo: (id: number) => void; // Added
  undoTimeoutDuration: number; // Added
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

export function TodoList({ todos, onToggle, onRemove, onUpdateText, undoableAction, onUndo, undoTimeoutDuration }: TodoListProps) {
  // The empty state logic from app/page.tsx might be preferred here to avoid duplication
  // For now, keeping the simple check. Consider centralizing empty state logic if it becomes complex.
  if (todos.length === 0 && (!undoableAction || !todos.some(t => t.id === undoableAction.id))) {
    // This is a basic empty state. The more complex logic is in page.tsx.
    // Depending on requirements, might want to pass a specific empty state component or message.
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
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onRemove={onRemove}
          onUpdateText={onUpdateText}
          undoableAction={undoableAction} // Pass down
          onUndo={onUndo} // Pass down
          undoTimeoutDuration={undoTimeoutDuration} // Pass down
        />
      ))}
    </ul>
  );
}
