'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TodoList } from './components/todo/TodoList';
import { TodoAddForm } from './components/todo/TodoAddForm';
import type { Todo } from './components/todo/TodoItem'; // Re-using the Todo interface

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = (text: string) => {
    setTodos(prevTodos => [...prevTodos, { id: Date.now(), text, completed: false }]);
  };

  const toggleTodo = (id: number) => {
    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const removeTodo = (id: number) => {
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
  };

  const pendingTasks = todos.filter(todo => !todo.completed).length;

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gradient-to-br from-slate-900 to-slate-700 text-white">
      <div className="w-full max-w-xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">My ToDo App</h1>
          <p className="text-lg text-slate-400">Organize your tasks with style!</p>
        </div>

        <Card className="bg-slate-800 shadow-2xl border-slate-700">
          <CardHeader>
            <CardTitle className="text-3xl text-sky-400">Your Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <TodoAddForm onAddTodo={addTodo} />
            <TodoList todos={todos} onToggle={toggleTodo} onRemove={removeTodo} />
          </CardContent>
          <CardFooter className="text-sm text-slate-500 justify-center">
            You have <span className="font-bold text-sky-400 mx-1">{pendingTasks}</span> pending tasks.
          </CardFooter>
        </Card>

        <footer className="text-center mt-12 text-slate-500">
          <p>Powered by Next.js, Shadcn UI & Tailwind CSS</p>
        </footer>
      </div>
    </main>
  );
}
