'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TodoAddFormProps {
  onAddTodo: (text: string) => void;
}

export function TodoAddForm({ onAddTodo }: TodoAddFormProps) {
  const [newTodoText, setNewTodoText] = useState('');

  const handleSubmit = () => {
    if (newTodoText.trim() === '') return;
    onAddTodo(newTodoText);
    setNewTodoText('');
  };

  return (
    <div className="flex gap-4 mb-6">
      <Input
        type="text"
        value={newTodoText}
        onChange={(e) => setNewTodoText(e.target.value)}
        placeholder="Add a new task"
        className="flex-grow bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <Button
        onClick={handleSubmit}
        className="bg-sky-600 hover:bg-sky-700 text-white"
      >
        Add Task
      </Button>
    </div>
  );
}
