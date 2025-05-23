'use client';

import { useState, KeyboardEvent, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TodoAddFormProps {
  onAddTodo: (text: string) => void;
}

export interface TodoAddFormHandle {
  focusInput: () => void;
}

export const TodoAddForm = forwardRef<TodoAddFormHandle, TodoAddFormProps>(({ onAddTodo }, ref) => {
  const [newTodoText, setNewTodoText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
    }
  }));

  const handleSubmit = () => {
    const trimmedText = newTodoText.trim();
    if (trimmedText === '') return;
    onAddTodo(trimmedText);
    setNewTodoText('');
    // No need to focus here, parent will handle it
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-4 mb-6">
      <Input
        ref={inputRef} // Assign ref to the input element
        type="text"
        value={newTodoText}
        onChange={(e) => setNewTodoText(e.target.value)}
        placeholder="Add a new task"
        className="flex-grow bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
        onKeyDown={handleKeyDown}
        aria-label="New task text"
      />
      <Button
        onClick={handleSubmit}
        className="bg-sky-600 hover:bg-sky-700 text-white"
        disabled={newTodoText.trim() === ''}
      >
        Add Task
      </Button>
    </div>
  );
});

TodoAddForm.displayName = 'TodoAddForm'; // for better debugging
