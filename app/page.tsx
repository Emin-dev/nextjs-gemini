'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TodoList } from './components/todo/TodoList';
import { TodoAddForm, type TodoAddFormHandle } from './components/todo/TodoAddForm';
import type { Todo } from './components/todo/TodoItem';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { TodoListSkeleton } from './components/todo/TodoListSkeleton';
import { VisibleStatusMessage } from './components/ui/StatusMessage';

const LOCAL_STORAGE_KEY = 'nextjs-todo-app-todos';
type FilterValue = 'all' | 'active' | 'completed' | 'deleted';
const INACTIVITY_TIMEOUT = 5000;
const UNDO_TIMEOUT = 20000; // 20 seconds
const STATUS_MESSAGE_DURATION = 3000;

export interface UndoableActionDetails {
  id: number;
  originalTodo: Todo;
  actionType: 'delete' | 'restore';
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const todoAddFormRef = useRef<TodoAddFormHandle>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [statusMessage, setStatusMessage] = useState<string>('');
  const statusMessageTimerRef = useRef<NodeJS.Timeout | null>(null); // Ref for status message timeout

  const [undoableActions, setUndoableActions] = useState<Map<number, UndoableActionDetails>>(new Map());
  const undoTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const focusInput = () => todoAddFormRef.current?.focusInput();

  // Helper to set status messages and manage their timeouts
  const showStatusMessage = (message: string) => {
    if (statusMessageTimerRef.current) {
      clearTimeout(statusMessageTimerRef.current);
    }
    setStatusMessage(message);
    statusMessageTimerRef.current = setTimeout(() => {
      setStatusMessage('');
    }, STATUS_MESSAGE_DURATION);
  };

  const clearSpecificUndoAction = (id: number, showConfirmation: boolean = false, confirmationMessage?: string) => {
    const timer = undoTimeoutRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      undoTimeoutRefs.current.delete(id);
    }
    setUndoableActions(prev => {
      const newState = new Map(prev);
      const actionDetails = newState.get(id);
      newState.delete(id);
      if (showConfirmation && actionDetails) {
        const finalMessage = confirmationMessage || `Task "${actionDetails.originalTodo.text.substring(0, 30)}${actionDetails.originalTodo.text.length > 30 ? '...' : ''}" ${actionDetails.actionType === 'delete' ? 'deletion' : 'restoration'} confirmed.`;
        showStatusMessage(finalMessage);
      }
      return newState;
    });
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(focusInput, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    setIsClient(true);
    const storedTodos = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedTodos) {
      try {
        const parsedTodos = JSON.parse(storedTodos).map((todo: Todo) => ({ ...todo, isDeleted: todo.isDeleted || false }));
        setTodos(parsedTodos);
      } catch (error) { console.error("Error parsing todos from localStorage:", error); }
    }
    setInitialLoadComplete(true);
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    resetInactivityTimer();
    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (statusMessageTimerRef.current) clearTimeout(statusMessageTimerRef.current);
      undoTimeoutRefs.current.forEach(timer => clearTimeout(timer));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Keep resetInactivityTimer out of deps to avoid re-binding on every call if it's not memoized

  useEffect(() => {
    if (isClient && initialLoadComplete) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
    }
  }, [todos, isClient, initialLoadComplete]);

  const addTodo = (text: string) => {
    const newTodo = { id: Date.now(), text, completed: false, isDeleted: false };
    setTodos(prev => [...prev, newTodo]);
    if (filter !== 'all') setFilter('all');
    setSearchQuery('');
    showStatusMessage(`Task "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" added.`);
    focusInput();
    resetInactivityTimer();
  };

  const toggleTodo = (id: number) => {
    clearSpecificUndoAction(id);
    let taskText = '';
    let newCompletedStatus = false;
    setTodos(prev => prev.map(todo => {
      if (todo.id === id) {
        taskText = todo.text;
        newCompletedStatus = !todo.completed;
        return { ...todo, completed: newCompletedStatus };
      }
      return todo;
    }));
    showStatusMessage(`Task "${taskText.substring(0, 30)}${taskText.length > 30 ? '...' : ''}" marked as ${newCompletedStatus ? 'complete' : 'incomplete'}.`);
    resetInactivityTimer();
  };

  const softDeleteTodo = (id: number) => {
    const todoToModify = todos.find(t => t.id === id);
    if (!todoToModify) return;

    clearSpecificUndoAction(id);

    const newIsDeleted = !todoToModify.isDeleted;
    const actionType = newIsDeleted ? 'delete' : 'restore';

    setTodos(prev => prev.map(todo => todo.id === id ? { ...todo, isDeleted: newIsDeleted } : todo));

    setUndoableActions(prev => {
      const newState = new Map(prev);
      // Preserve original completion status for accurate restore
      newState.set(id, { id, originalTodo: { ...todoToModify, isDeleted: todoToModify.isDeleted }, actionType });
      return newState;
    });

    const timer = setTimeout(() => {
      clearSpecificUndoAction(id, true, `Task "${todoToModify.text.substring(0, 30)}${todoToModify.text.length > 30 ? '...' : ''}" ${actionType === 'delete' ? 'deletion' : 'restoration'} auto-confirmed.`);
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(id, timer);

    showStatusMessage(`Task "${todoToModify.text.substring(0, 30)}${todoToModify.text.length > 30 ? '...' : ''}" marked for ${actionType}.`);
    focusInput();
    resetInactivityTimer();
  };

  const handleUndo = (idToUndo: number) => {
    const actionDetails = undoableActions.get(idToUndo);
    if (!actionDetails) return;

    setTodos(prev => prev.map(todo =>
      todo.id === idToUndo ? { ...actionDetails.originalTodo } : todo
    ));
    showStatusMessage(`Task "${actionDetails.originalTodo.text.substring(0, 30)}${actionDetails.originalTodo.text.length > 30 ? '...' : ''}" ${actionDetails.actionType === 'delete' ? 'restoration' : 'deletion'} undone.`);
    clearSpecificUndoAction(idToUndo);
    resetInactivityTimer();
  };

  const updateTodoText = (id: number, newText: string) => {
    clearSpecificUndoAction(id);
    let oldText = '';
    setTodos(prev => prev.map(todo => {
      if (todo.id === id) {
        oldText = todo.text;
        return { ...todo, text: newText };
      }
      return todo;
    }));
    showStatusMessage(`Task "${oldText.substring(0, 30)}${oldText.length > 30 ? '...' : ''}" updated.`);
    focusInput();
    resetInactivityTimer();
  };

  const permanentlyDeleteTasks = () => {
    const idsToDeletePermanently = todos.filter(todo => todo.isDeleted && !undoableActions.has(todo.id)).map(todo => todo.id);
    if (idsToDeletePermanently.length === 0) return;

    if (window.confirm(`Are you sure you want to permanently delete ${idsToDeletePermanently.length} task(s)? This action cannot be undone.`)) {
      idsToDeletePermanently.forEach(id => clearSpecificUndoAction(id));
      setTodos(prev => prev.filter(todo => !idsToDeletePermanently.includes(todo.id)));
      showStatusMessage(`${idsToDeletePermanently.length} task(s) permanently deleted.`);
      focusInput();
      resetInactivityTimer();
      if (filter === 'deleted') setFilter('all');
    }
  };

  const filteredAndSearchedTodos = useMemo(() => {
    if (!isClient || !initialLoadComplete) return [];
    let currentTodos = todos;

    currentTodos = currentTodos.filter(todo => {
      const pendingAction = undoableActions.get(todo.id);
      const isEffectivelyDeleted = todo.isDeleted && (!pendingAction || pendingAction.actionType !== 'restore');
      const isEffectivelyVisible = !todo.isDeleted || (pendingAction && pendingAction.actionType === 'delete');

      switch (filter) {
        case 'all':
          return isEffectivelyVisible;
        case 'active':
          return !todo.completed && isEffectivelyVisible;
        case 'completed':
          return todo.completed && isEffectivelyVisible;
        case 'deleted':
          return isEffectivelyDeleted;
        default:
          // Should not happen with TypeScript, but good for robustness
          if (typeof filter !== 'undefined' && filter !== null) { // check if filter has an unexpected value
            console.warn(`Unknown filter type encountered: ${filter}`);
          }
          return true; 
      }
    });

    if (searchQuery.trim() !== '') {
      currentTodos = currentTodos.filter(todo =>
        todo.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return currentTodos;
  }, [todos, filter, searchQuery, isClient, initialLoadComplete, undoableActions]);

  const pendingTasks = useMemo(() => {
    if (!isClient || !initialLoadComplete) return 0;
    return todos.filter(todo => {
      const pendingAction = undoableActions.get(todo.id);
      const isEffectivelyVisible = !todo.isDeleted || (pendingAction && pendingAction.actionType === 'delete');
      return !todo.completed && isEffectivelyVisible;
    }).length;
  }, [todos, isClient, initialLoadComplete, undoableActions]);

  const totalTasks = useMemo(() => {
    if (!isClient || !initialLoadComplete) return 0;
    return todos.filter(todo => {
      const pendingAction = undoableActions.get(todo.id);
      return !todo.isDeleted || (pendingAction && pendingAction.actionType === 'delete');
    }).length;
  }, [todos, isClient, initialLoadComplete, undoableActions]);

  const deletedTasksCount = useMemo(() => {
    if (!isClient || !initialLoadComplete) return 0;
    return todos.filter(todo => todo.isDeleted && !undoableActions.has(todo.id)).length;
  }, [todos, isClient, initialLoadComplete, undoableActions]);

  const filterOptions: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'deleted', label: 'Deleted' },
  ];

  const getEmptyStateMessage = () => {
    if (!initialLoadComplete) return null;
    const hasSearch = searchQuery.trim() !== '';
    const listEffectivelyEmpty = filteredAndSearchedTodos.length === 0;
    const totalTodosNotPermanentlyDeleted = todos.filter(todo => !todo.isDeleted || undoableActions.has(todo.id)).length;

    if (totalTodosNotPermanentlyDeleted === 0 && undoableActions.size === 0) {
      return { title: "No tasks yet!", message: "Get started by adding a new task above." };
    }
    if (hasSearch && listEffectivelyEmpty) {
      return { title: "No tasks found", message: `Your search for "${searchQuery}" did not match any tasks in the current filter.` };
    }
    if (!hasSearch && listEffectivelyEmpty) {
      if (filter === 'active') return { title: "No active tasks!", message: "All your tasks are completed or in the deleted list." };
      if (filter === 'completed') return { title: "No completed tasks!", message: "Mark some tasks as completed to see them here." };
      if (filter === 'deleted' && deletedTasksCount === 0 && !Array.from(undoableActions.values()).some(action => action.actionType === 'restore')) {
        return { title: "No deleted tasks!", message: "You haven't deleted any tasks yet." };
      }
      if (filter === 'all' && totalTasks === 0 && todos.length > 0) {
        return { title: "All tasks are deleted", message: "View them in the 'Deleted' filter or add a new task." };
      }
    }
    return null;
  };

  const emptyState = getEmptyStateMessage();

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gradient-to-br from-slate-900 to-slate-700 text-white" onClick={resetInactivityTimer} >
      <div className="w-full max-w-xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">My ToDo App</h1>
          <p className="text-lg text-slate-400">Organize your tasks with style!</p>
        </div>

        <Card className="bg-slate-800 shadow-2xl border-slate-700">
          <CardHeader>
            <div className="flex justify-between items-center mb-4">
              <CardTitle className="text-3xl text-sky-400" id="tasks-heading">Your Tasks</CardTitle>
              {isClient && (
                <RadioGroup
                  value={filter}
                  defaultValue="all"
                  onValueChange={(value) => setFilter(value as FilterValue)}
                  className="flex items-center gap-2"
                  disabled={!initialLoadComplete || undoableActions.size > 0}
                  aria-labelledby="tasks-heading"
                >
                  {filterOptions.map(option => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`filter-${option.value}`} className="text-sky-400 border-sky-400" />
                      <Label htmlFor={`filter-${option.value}`} className="text-slate-300">{option.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
            {isClient && (
              <div className="mb-4">
                <Input
                  type="search"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
                  aria-label="Search tasks by keyword"
                  disabled={!initialLoadComplete || undoableActions.size > 0}
                />
              </div>
            )}
          </CardHeader>

          <CardContent>
            <TodoAddForm ref={todoAddFormRef} onAddTodo={addTodo} disabled={!initialLoadComplete || undoableActions.size > 0} />

            {!isClient || !initialLoadComplete ? (
              <TodoListSkeleton />
            ) : (
              emptyState ? (
                <div className="text-center text-slate-500 mt-10 p-6 border-2 border-dashed border-slate-700 rounded-lg">
                  <svg
                    className="mx-auto h-12 w-12 text-slate-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10h.01" />
                  </svg>
                  <h3 className="mt-2 text-xl font-semibold text-slate-400">{emptyState.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{emptyState.message}</p>
                </div>
              ) : (
                <TodoList
                  todos={filteredAndSearchedTodos}
                  onToggle={toggleTodo}
                  onRemove={softDeleteTodo}
                  onUpdateText={updateTodoText}
                  undoableActions={undoableActions}
                  onUndo={handleUndo}
                  undoTimeoutDuration={UNDO_TIMEOUT}
                  // currentTime={currentTime} // Ensure currentTime is passed if Stage 2 deletion is used
                />
              )
            )}
            {isClient && initialLoadComplete && filter === 'deleted' && filteredAndSearchedTodos.length > 0 && (
              <p className="text-center mt-4 text-sm text-yellow-400">
                You are viewing deleted tasks. These can be restored or permanently emptied using the button in the footer.
              </p>
            )}
          </CardContent>

          {isClient && initialLoadComplete && (
            <CardFooter className="text-sm text-slate-500 justify-between items-center pt-4 border-t border-slate-700">
              <div>
                You have <span className="font-bold text-sky-400 mx-1">{pendingTasks}</span> pending task(s) from a total of {totalTasks}.
                {deletedTasksCount > 0 && (
                  <span className="ml-2 text-yellow-400">({deletedTasksCount} in trash)</span>
                )}
              </div>
              {deletedTasksCount > 0 && filter === 'deleted' && (
                <Button
                  onClick={permanentlyDeleteTasks}
                  variant="destructive"
                  size="sm"
                  aria-label={`Permanently delete ${deletedTasksCount} tasks in trash`}
                  disabled={undoableActions.size > 0 || !initialLoadComplete}
                >
                  Empty Trash ({deletedTasksCount})
                </Button>
              )}
            </CardFooter>
          )}
        </Card>

        {isClient && statusMessage && (
          <VisibleStatusMessage
            message={statusMessage}
            duration={STATUS_MESSAGE_DURATION} // Duration is handled by showStatusMessage now
            onDismiss={() => {
              if (statusMessageTimerRef.current) clearTimeout(statusMessageTimerRef.current);
              setStatusMessage('');
            }}
            type="polite"
          />
        )}

        <footer className="text-center mt-12 text-slate-500" role="contentinfo">
          <p>Powered by Next.js, Shadcn UI & Tailwind CSS</p>
        </footer>
      </div>
    </main>
  );
}
