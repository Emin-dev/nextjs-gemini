'use client';

import { useState, KeyboardEvent, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TodoAddFormProps {
  onAddTodo: (text: string) => void;
  disabled?: boolean;
}

export interface TodoAddFormHandle {
  focusInput: () => void;
}

export const TodoAddForm = forwardRef<TodoAddFormHandle, TodoAddFormProps>(({ onAddTodo, disabled }, ref) => {
  const [newTodoText, setNewTodoText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
    }
  }));

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleSubmit = () => {
    if (disabled) return;
    const trimmedText = newTodoText.trim();
    if (trimmedText === '') return;
    onAddTodo(trimmedText);
    setNewTodoText('');
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-3 mb-6 items-center"> {/* Reduced gap and added items-center */}
      <Input
        ref={inputRef}
        type="text"
        value={newTodoText}
        onChange={(e) => setNewTodoText(e.target.value)}
        placeholder="Add a new task..." /* Added ellipsis */
        className="flex-grow bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-cyan-500 focus:border-cyan-500 h-11 px-4 text-base" /* Consistent height, padding, text size, updated focus */
        onKeyDown={handleKeyDown}
        aria-label="New task text"
        disabled={disabled}
      />
      <Button
        onClick={handleSubmit}
        className="bg-cyan-600 hover:bg-cyan-700 text-white h-11 px-5 text-sm font-medium whitespace-nowrap" /* Consistent height, padding, updated colors, added font style */
        disabled={disabled || newTodoText.trim() === ''}
      >
        Add Task
      </Button>
    </div>
  );
});

TodoAddForm.displayName = 'TodoAddForm';
