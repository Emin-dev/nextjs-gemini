'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
}

export function TodoItem({ todo, onToggle, onRemove }: TodoItemProps) {
  return (
    <Card className="bg-slate-700 border-slate-600 hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center flex-grow">
          <Image
            src={`https://picsum.photos/seed/${todo.id}/40/40`}
            alt="Task image"
            width={40}
            height={40}
            className="rounded-full mr-3"
          />
          <Checkbox
            id={todo.id.toString()}
            checked={todo.completed}
            onCheckedChange={() => onToggle(todo.id)}
            className="mr-3 border-slate-500 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600"
          />
          <label
            htmlFor={todo.id.toString()}
            className={`text-slate-200 cursor-pointer ${todo.completed ? 'line-through text-slate-500' : ''}`}
          >
            {todo.text}
          </label>
        </div>
        <Button
          onClick={() => onRemove(todo.id)}
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300 ml-2 flex-shrink-0"
        >
          Remove
        </Button>
      </CardContent>
    </Card>
  );
}
