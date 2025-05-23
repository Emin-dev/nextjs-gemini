'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TodoList } from './components/todo/TodoList';
import { TodoAddForm, type TodoAddFormHandle } from './components/todo/TodoAddForm';
import type { Todo, UndoableActionDetails } from './types'; // Corrected import path
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { TodoListSkeleton } from './components/todo/TodoListSkeleton';
import { VisibleStatusMessage } from './components/ui/StatusMessage';

const LOCAL_STORAGE_KEY = 'nextjs-todo-app-todos';
type FilterValue = 'all' | 'active' | 'completed' | 'deleted';

// Durations
const INACTIVITY_TIMEOUT = 3000;
const UNDO_TIMEOUT = 20000;
const STATUS_MESSAGE_DURATION = 3000;
const STAGE_2_GRACE_PERIOD_DURATION = 60000;
const STAGE_4_GLOBAL_RESTORE_WINDOW = 5 * 60 * 1000;
const AUTO_FINAL_DELETE_INTERVAL = 5000;
const CURRENT_TIME_UPDATE_INTERVAL = 1000;

export interface EmptyingTrashBatchDetails {
  batchId: string;
  taskIds: number[];
  initiatedAt: number;
  tasksSnapshot: Todo[];
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  const todoAddFormRef = useRef<TodoAddFormHandle>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusMessageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoFinalDeleteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const globalRestoreWindowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [undoableActions, setUndoableActions] = useState<Map<number, UndoableActionDetails>>(new Map());
  const undoTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const [emptyingTrashBatch, setEmptyingTrashBatch] = useState<EmptyingTrashBatchDetails | null>(null);
  const emptyingTrashBatchRef = useRef<EmptyingTrashBatchDetails | null>(null);

  useEffect(() => {
    emptyingTrashBatchRef.current = emptyingTrashBatch;
  }, [emptyingTrashBatch]);

  const focusInput = useCallback(() => {
    todoAddFormRef.current?.focusInput();
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(focusInput, INACTIVITY_TIMEOUT);
  }, [focusInput]);

  const showStatusMessage = useCallback((message: string) => {
    if (statusMessageTimerRef.current) clearTimeout(statusMessageTimerRef.current);
    setStatusMessage(message);
    statusMessageTimerRef.current = setTimeout(() => setStatusMessage(''), STATUS_MESSAGE_DURATION);
    resetInactivityTimer(); 
  }, [resetInactivityTimer]);

  useEffect(() => {
    setIsClient(true);
    try {
      const storedTodos = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedTodos) setTodos(JSON.parse(storedTodos).map((todo: any) => ({ ...todo, isDeleted: todo.isDeleted || false, pendingFinalDeletionTimestamp: todo.pendingFinalDeletionTimestamp || null, batchId: todo.batchId || null })));
    } catch (error) { console.error("Error parsing todos from localStorage:", error); }
    setInitialLoadComplete(true);
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    resetInactivityTimer(); 
    const timeUpdateInterval = setInterval(() => setCurrentTime(Date.now()), CURRENT_TIME_UPDATE_INTERVAL);
    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (statusMessageTimerRef.current) clearTimeout(statusMessageTimerRef.current);
      undoTimeoutRefs.current.forEach(timer => clearTimeout(timer));
      if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current);
      if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
      clearInterval(timeUpdateInterval);
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (isClient && initialLoadComplete) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
    }
  }, [todos, isClient, initialLoadComplete]);

  const clearSpecificUndoAction = useCallback((id: number, showConfirmation: boolean = false, confirmationMessage?: string) => {
    const timer = undoTimeoutRefs.current.get(id);
    if (timer) clearTimeout(timer);
    undoTimeoutRefs.current.delete(id);
    setUndoableActions(prev => {
      const newState = new Map(prev);
      const actionDetails = newState.get(id);
      const originalTodoText = actionDetails?.originalTodo?.text ? actionDetails.originalTodo.text.substring(0,20) + '...' : 'task';
      if (newState.delete(id) && showConfirmation && actionDetails) {
        const finalMessage = confirmationMessage || `Action on "${originalTodoText}" confirmed.`;
        showStatusMessage(finalMessage);
      }
      return newState;
    });
  }, [showStatusMessage]);

  const addTodo = (text: string) => {
    const newTodo: Todo = { id: Date.now(), text, completed: false, isDeleted: false, pendingFinalDeletionTimestamp: null, batchId: null };
    setTodos(prev => [...prev, newTodo]);
    if (filter !== 'all') setFilter('all');
    setSearchQuery('');
    showStatusMessage(`Task "${text.substring(0, 20)}..." added.`);
    focusInput(); 
    resetInactivityTimer();
  };

  const toggleTodo = (id: number) => {
    clearSpecificUndoAction(id);
    if (emptyingTrashBatchRef.current?.taskIds.includes(id)) {
        showStatusMessage("Cannot modify task during batch deletion process.");
        return;
    }
    let taskText = '';
    let newCompletedStatus = false;
    setTodos(prev => prev.map(todo => {
      if (todo.id === id && !todo.pendingFinalDeletionTimestamp && !todo.isDeleted) {
        taskText = todo.text;
        newCompletedStatus = !todo.completed;
        return { ...todo, completed: newCompletedStatus };
      }
      return todo;
    }));
    if (taskText) {
        showStatusMessage(`Task "${taskText.substring(0, 20)}..." marked as ${newCompletedStatus ? 'complete' : 'active'}.`);
    }
    resetInactivityTimer();
  };

  const updateTodoText = (id: number, newText: string) => {
    clearSpecificUndoAction(id);
    if (emptyingTrashBatchRef.current?.taskIds.includes(id)) {
        showStatusMessage("Cannot modify task during batch deletion process.");
        return;
    }
    let oldText = '';
    setTodos(prev => prev.map(todo => {
      if (todo.id === id && !todo.pendingFinalDeletionTimestamp && !todo.isDeleted) {
        oldText = todo.text;
        return { ...todo, text: newText };
      }
      return todo;
    }));
    if (oldText) {
        showStatusMessage(`Task "${oldText.substring(0, 20)}..." updated.`);
    }
    focusInput(); 
    resetInactivityTimer();
  };

  const softDeleteTodo = (id: number) => {
    const todoToModify = todos.find(t => t.id === id);
    if (!todoToModify) return;
    if (todoToModify.pendingFinalDeletionTimestamp) {
      showStatusMessage("Task is pending final deletion. Use 'Undo' from the task options to cancel this.");
      return;
    }
    clearSpecificUndoAction(id);
    const newIsDeleted = !todoToModify.isDeleted;
    const actionType = newIsDeleted ? 'delete' : 'restore';
    
    // Create a full copy for the originalTodo state
    const originalTodoForUndo: Todo = { ...todoToModify };

    setTodos(prev => prev.map(t => t.id === id ? { ...t, isDeleted: newIsDeleted, completed: newIsDeleted ? t.completed : false } : t));
    
    setUndoableActions(prev => {
      const newState = new Map(prev);
      // Pass the full original todo
      newState.set(id, { id, originalTodo: originalTodoForUndo, actionType, timestamp: Date.now() });
      return newState;
    });
    const timer = setTimeout(() => {
      const currentAction = undoableActions.get(id);
      const textForMessage = currentAction?.originalTodo?.text || todoToModify.text;
      clearSpecificUndoAction(id, true, `Task "${textForMessage.substring(0, 20)}..." ${actionType} auto-confirmed.`);
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(id, timer);
    showStatusMessage(`Task "${todoToModify.text.substring(0, 20)}..." marked for ${actionType}. You have ${UNDO_TIMEOUT/1000}s to undo.`);
    focusInput();
    resetInactivityTimer();
  };

  const handleUndo = (idToUndo: number) => {
    const actionDetails = undoableActions.get(idToUndo);
    if (!actionDetails) return;
    setTodos(prev => prev.map(todo => todo.id === idToUndo ? { ...actionDetails.originalTodo } : todo));
    showStatusMessage(`Task "${actionDetails.originalTodo.text.substring(0, 20)}..." ${actionDetails.actionType === 'delete' ? 'restoration' : 'deletion'} undone.`);
    clearSpecificUndoAction(idToUndo);
    focusInput(); 
    resetInactivityTimer();
  };

  const initiateEmptyTrash = useCallback(() => {
    const targetTasks = todos.filter(todo => todo.isDeleted && !undoableActions.has(todo.id) && !todo.pendingFinalDeletionTimestamp);
    if (targetTasks.length === 0) {
      showStatusMessage("No tasks eligible for emptying from trash.");
      return;
    }
    const currentBatchId = `batch-${Date.now()}`;
    const tasksSnapshot = JSON.parse(JSON.stringify(targetTasks));
    const taskIdsInBatch = targetTasks.map(t => t.id);
    setTodos(prevTodos => prevTodos.map(todo => {
      if (taskIdsInBatch.includes(todo.id)) {
        return { ...todo, pendingFinalDeletionTimestamp: Date.now() + STAGE_2_GRACE_PERIOD_DURATION, batchId: currentBatchId };
      }
      return todo;
    }));
    setEmptyingTrashBatch({ batchId: currentBatchId, taskIds: taskIdsInBatch, initiatedAt: Date.now(), tasksSnapshot });
    showStatusMessage(`${targetTasks.length} task(s) are now pending final deletion. You can undo this for the next ${STAGE_4_GLOBAL_RESTORE_WINDOW/(60*1000)} minutes.`);
    focusInput(); 
    resetInactivityTimer();
  }, [todos, undoableActions, showStatusMessage, focusInput, resetInactivityTimer]);

  const onUndoPendingFinalDeletion = useCallback((taskId: number) => {
    setTodos(prevTodos => {
      let taskRestored = false;
      let restoredTaskText = "";
      const newTodos = prevTodos.map(todo => {
        if (todo.id === taskId && todo.pendingFinalDeletionTimestamp) {
          taskRestored = true;
          restoredTaskText = todo.text;
          return { ...todo, isDeleted: true, completed: false, pendingFinalDeletionTimestamp: null, batchId: null };
        }
        return todo;
      });
      if (taskRestored) {
        showStatusMessage(`Pending deletion of "${restoredTaskText.substring(0,20)}..." undone.`);
        const currentBatch = emptyingTrashBatchRef.current;
        if (currentBatch) {
          const anyOtherTasksFromThisBatchStillPending = newTodos.some(t => t.id !== taskId && currentBatch.taskIds.includes(t.id) && t.batchId === currentBatch.batchId && t.pendingFinalDeletionTimestamp);
          if (!anyOtherTasksFromThisBatchStillPending) {
            setEmptyingTrashBatch(null);
            showStatusMessage("All tasks in the current pending group have been processed or undone.");
          }
        }
      }
      return newTodos;
    });
    focusInput(); 
    resetInactivityTimer();
  }, [showStatusMessage, focusInput, resetInactivityTimer]);

  useEffect(() => {
    if (!isClient || !initialLoadComplete) return;
    autoFinalDeleteIntervalRef.current = setInterval(() => {
      const now = Date.now();
      let tasksWereAutoDeleted = false;
      setTodos(prevTodos => {
        const updatedTodos = prevTodos.filter(todo => {
          if (todo.pendingFinalDeletionTimestamp && now >= todo.pendingFinalDeletionTimestamp) {
            const batchInfo = emptyingTrashBatchRef.current;
            if (batchInfo && todo.batchId === batchInfo.batchId && now < batchInfo.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) {
              return true; 
            }
            tasksWereAutoDeleted = true;
            return false;
          }
          return true;
        });
        const currentBatch = emptyingTrashBatchRef.current;
        if (currentBatch && tasksWereAutoDeleted) {
            const remainingBatchTasks = updatedTodos.filter(t => t.batchId === currentBatch.batchId && t.pendingFinalDeletionTimestamp);
            if (remainingBatchTasks.length === 0) {
                setEmptyingTrashBatch(null);
            }
        }
        return updatedTodos;
      });
      if (tasksWereAutoDeleted) {
        showStatusMessage("Tasks with expired grace periods have been permanently deleted.");
      }
    }, AUTO_FINAL_DELETE_INTERVAL);
    return () => { if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current); };
  }, [isClient, initialLoadComplete, showStatusMessage]);

  const handleRestoreAllPendingDeletion = useCallback(() => {
    const batchInfo = emptyingTrashBatchRef.current;
    if (!batchInfo) {
      showStatusMessage("No tasks pending deletion to restore.");
      return;
    }
    if (Date.now() >= batchInfo.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) {
      showStatusMessage("Restore window for these tasks has expired.");
      setEmptyingTrashBatch(null);
      return;
    }
    const tasksToRestoreFromSnapshot = batchInfo.tasksSnapshot;
    setTodos(prevTodos => {
      const updatedTodos = prevTodos.map(currentTodo => {
        const snapshotVersion = tasksToRestoreFromSnapshot.find(snapTodo => snapTodo.id === currentTodo.id);
        if (snapshotVersion && currentTodo.batchId === batchInfo.batchId) {
          return { 
            ...currentTodo, 
            text: snapshotVersion.text, 
            completed: false, 
            isDeleted: true, 
            pendingFinalDeletionTimestamp: null, 
            batchId: null 
          };
        }
        return currentTodo;
      });
      return updatedTodos;
    });
    showStatusMessage(`${tasksToRestoreFromSnapshot.length} task(s) restored to deleted items list.`);
    setEmptyingTrashBatch(null);
    if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
    focusInput(); 
    resetInactivityTimer();
  }, [showStatusMessage, focusInput, resetInactivityTimer]);

  useEffect(() => {
    if (emptyingTrashBatch) {
      const timeRemaining = (emptyingTrashBatch.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) - currentTime;
      if (timeRemaining <= 0) {
        if (emptyingTrashBatchRef.current && emptyingTrashBatchRef.current.batchId === emptyingTrashBatch.batchId) {
            showStatusMessage(`Global restore window for recently deleted tasks has ended.`);
            setEmptyingTrashBatch(null);
            if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
        }
      } else {
        if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
        globalRestoreWindowTimeoutRef.current = setTimeout(() => {
          if (emptyingTrashBatchRef.current && emptyingTrashBatchRef.current.batchId === emptyingTrashBatch.batchId) {
            showStatusMessage(`Global restore window for recently deleted tasks has ended.`);
            setEmptyingTrashBatch(null);
          }
        }, timeRemaining);
      }
    } else {
      if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
    }
    return () => { if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current); };
  }, [emptyingTrashBatch, showStatusMessage, currentTime]);

  const filteredAndSearchedTodos = useMemo(() => {
    if (!isClient || !initialLoadComplete) return [];
    return todos.filter(todo => {
      const isInUndoStage1 = undoableActions.has(todo.id) && undoableActions.get(todo.id)?.actionType === 'delete';
      const isInGraceStage2 = !!todo.pendingFinalDeletionTimestamp;
      let isVisible = true;
      if (filter === 'active') isVisible = !todo.completed && !todo.isDeleted && !isInGraceStage2 || isInUndoStage1 && !undoableActions.get(todo.id)!.originalTodo.completed;
      else if (filter === 'completed') isVisible = todo.completed && !todo.isDeleted && !isInGraceStage2 || isInUndoStage1 && undoableActions.get(todo.id)!.originalTodo.completed;
      else if (filter === 'deleted') isVisible = (todo.isDeleted || isInGraceStage2) && !isInUndoStage1;
      else if (filter === 'all') isVisible = !isInGraceStage2;
      else { isVisible = true; }
      if (!isVisible) return false;
      if (searchQuery.trim() !== '') {
        return todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [todos, filter, searchQuery, isClient, initialLoadComplete, undoableActions]);

  const itemsEligibleForEmptyTrash = useMemo(() => {
    return todos.filter(todo => todo.isDeleted && !undoableActions.has(todo.id) && !todo.pendingFinalDeletionTimestamp).length;
  }, [todos, undoableActions]);

  const activeTasksCount = useMemo(() => todos.filter(t => !t.completed && !t.isDeleted && !t.pendingFinalDeletionTimestamp && !(undoableActions.has(t.id) && undoableActions.get(t.id)?.actionType === 'delete')).length, [todos, undoableActions]);
  const softDeletedAndStage2Count = useMemo(() => todos.filter(t => (t.isDeleted || t.pendingFinalDeletionTimestamp) && !(undoableActions.has(t.id) && undoableActions.get(t.id)?.actionType === 'restore')).length, [todos, undoableActions]);

  const getGlobalRestoreTimeRemaining = () => {
    if (!emptyingTrashBatch) return '';
    const timeLeftMs = (emptyingTrashBatch.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) - currentTime;
    if (timeLeftMs <= 0) return '0:00';
    const minutes = Math.floor(timeLeftMs / 60000);
    const seconds = Math.floor((timeLeftMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isActionInProgress = undoableActions.size > 0 || !!emptyingTrashBatch;

  const filterOptions: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'deleted', label: 'Deleted' },
  ];

  const getEmptyStateMessage = () => {
    if (!initialLoadComplete) return null;
    if (filteredAndSearchedTodos.length > 0) return null;
    if (todos.length === 0) return { title: "No tasks yet!", message: "Get started by adding a new task above." };
    if (searchQuery.trim() !== '') return { title: "No tasks found", message: `Your search for "${searchQuery}" did not match any tasks.` };
    if (filter === 'active') return { title: "No active tasks!", message: "All your tasks are completed or deleted." };
    if (filter === 'completed') return { title: "No completed tasks!", message: "Mark some tasks as completed to see them here." };
    if (filter === 'deleted') return { title: "Trash is empty!", message: "You haven't deleted any tasks yet, or no tasks match the current search in trash." };
    return { title: "No tasks here", message: "Try a different filter or add some tasks!" };
  };

  const emptyState = getEmptyStateMessage();

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-gradient-to-br from-slate-900 to-slate-700 text-white" onClick={resetInactivityTimer}>
      <div className="w-full max-w-xl">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 md:mb-4">My ToDo App</h1>
          <p className="text-md md:text-lg text-slate-400">Organize your tasks with style!</p>
        </div>

        <Card className="bg-slate-800 shadow-2xl border-slate-700">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3 sm:gap-4">
              <CardTitle className="text-2xl md:text-3xl text-sky-400 whitespace-nowrap" id="tasks-heading">Your Tasks</CardTitle>
              {isClient && (
                <RadioGroup
                  value={filter}
                  defaultValue="all"
                  onValueChange={(value) => setFilter(value as FilterValue)}
                  className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center"
                  disabled={!initialLoadComplete || isActionInProgress}
                  aria-labelledby="tasks-heading"
                >
                  {filterOptions.map(option => (
                    <div key={option.value} className="flex items-center space-x-1 sm:space-x-2">
                      <RadioGroupItem value={option.value} id={`filter-${option.value}`} className="text-sky-400 border-sky-400" />
                      <Label htmlFor={`filter-${option.value}`} className="text-slate-300 text-sm sm:text-base">{option.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
            {isClient && (
              <div className="mb-2">
                <Input
                  type="search"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500 text-sm sm:text-base"
                  aria-label="Search tasks by keyword"
                  disabled={!initialLoadComplete || isActionInProgress}
                />
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-2">
            <TodoAddForm ref={todoAddFormRef} onAddTodo={addTodo} disabled={!initialLoadComplete || isActionInProgress} />

            {!isClient || !initialLoadComplete ? (
              <TodoListSkeleton />
            ) : (
              emptyState ? (
                <div className="text-center text-slate-500 mt-10 p-6 border-2 border-dashed border-slate-700 rounded-lg">
                  <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10h.01" /></svg>
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
                  onRestoreDuringGracePeriod={onUndoPendingFinalDeletion}
                  currentTime={currentTime}
                />
              )
            )}
             {isClient && initialLoadComplete && filter === 'deleted' && filteredAndSearchedTodos.length > 0 && !emptyingTrashBatch && itemsEligibleForEmptyTrash > 0 && (
              <p className="text-center mt-4 text-xs sm:text-sm text-slate-400">
                These tasks are in trash. Use "Empty Trash" to start final deletion process.
              </p>
            )}
            {isClient && initialLoadComplete && filter === 'deleted' && emptyingTrashBatch && (
                 <p className="text-center mt-4 text-xs sm:text-sm text-orange-400">
                    Tasks are pending final deletion. You can undo this for {getGlobalRestoreTimeRemaining()}.
                 </p>
            )}
          </CardContent>

          {isClient && initialLoadComplete && (
            <CardFooter className="text-xs sm:text-sm text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 pt-4 border-t border-slate-700">
              <div className="text-center sm:text-left">
                You have <span className="font-bold text-sky-400 mx-1">{activeTasksCount}</span> active task(s).
                {softDeletedAndStage2Count > 0 && (
                  <span className="ml-1 text-yellow-400">({softDeletedAndStage2Count} in trash/pending final deletion)</span>
                )}
              </div>
              <div className="flex gap-2">
                {filter === 'deleted' && !emptyingTrashBatch && itemsEligibleForEmptyTrash > 0 && (
                    <Button
                    onClick={initiateEmptyTrash}
                    variant="destructive"
                    size="sm"
                    aria-label={`Initiate final deletion for ${itemsEligibleForEmptyTrash} tasks`}
                    disabled={isActionInProgress || itemsEligibleForEmptyTrash === 0}
                    >
                    Empty Trash ({itemsEligibleForEmptyTrash})
                    </Button>
                )}
                {emptyingTrashBatch && (
                    <Button
                        onClick={handleRestoreAllPendingDeletion}
                        variant="default"
                        size="sm"
                        className="bg-green-500 hover:bg-green-400 text-black font-bold text-sm sm:text-base px-3 py-1.5 h-auto focus:ring-green-600 focus:ring-offset-slate-800"
                    >
                        Restore All ({emptyingTrashBatch.tasksSnapshot.length}) - {getGlobalRestoreTimeRemaining()}
                    </Button>
                )}
              </div>
            </CardFooter>
          )}
        </Card>

        {isClient && statusMessage && (
          <VisibleStatusMessage
            message={statusMessage}
            onDismiss={() => {
              if (statusMessageTimerRef.current) clearTimeout(statusMessageTimerRef.current);
              setStatusMessage('');
            }}
            type="polite"
          />
        )}

        <footer className="text-center mt-8 md:mt-12 text-xs sm:text-sm text-slate-500" role="contentinfo">
          <p>Powered by Next.js, Shadcn UI & Tailwind CSS</p>
        </footer>
      </div>
    </main>
  );
}
