'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

// Durations
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes for inactivity to focus input
const UNDO_TIMEOUT = 20000; // 20 seconds for Stage 1 Undo
const STATUS_MESSAGE_DURATION = 3000; // 3 seconds for general status messages
const STAGE_2_GRACE_PERIOD_DURATION = 60000; // 1 minute for Stage 2 individual restore
const STAGE_4_GLOBAL_RESTORE_WINDOW = 2 * 60 * 1000; // 2 minutes for Stage 4 global restore window
const AUTO_FINAL_DELETE_INTERVAL = 5000; // Check every 5 seconds for Stage 3 auto-deletion
const CURRENT_TIME_UPDATE_INTERVAL = 1000; // Update current time every second for countdowns

export interface UndoableActionDetails {
  id: number;
  originalTodo: Todo;
  actionType: 'delete' | 'restore'; // For Stage 1
}

export interface EmptyingTrashBatchDetails {
  batchId: string;
  taskIds: number[];
  initiatedAt: number;
  tasksSnapshot: Todo[]; // Snapshot of tasks as they were when batch was initiated
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Refs for managing timeouts, intervals, and complex state to avoid stale closures
  const todoAddFormRef = useRef<TodoAddFormHandle>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusMessageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoFinalDeleteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const globalRestoreWindowTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stage 1: Soft Delete Undo Actions
  const [undoableActions, setUndoableActions] = useState<Map<number, UndoableActionDetails>>(new Map());
  const undoTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Stage 2 & 4: Emptying Trash Batch
  const [emptyingTrashBatch, setEmptyingTrashBatch] = useState<EmptyingTrashBatchDetails | null>(null);
  const emptyingTrashBatchRef = useRef<EmptyingTrashBatchDetails | null>(null);
  useEffect(() => {
    emptyingTrashBatchRef.current = emptyingTrashBatch;
  }, [emptyingTrashBatch]);

  const focusInput = useCallback(() => todoAddFormRef.current?.focusInput(), []);

  const showStatusMessage = useCallback((message: string) => {
    if (statusMessageTimerRef.current) clearTimeout(statusMessageTimerRef.current);
    setStatusMessage(message);
    statusMessageTimerRef.current = setTimeout(() => setStatusMessage(''), STATUS_MESSAGE_DURATION);
  }, []);

  const clearSpecificUndoAction = useCallback((id: number, showConfirmation: boolean = false, confirmationMessage?: string) => {
    const timer = undoTimeoutRefs.current.get(id);
    if (timer) clearTimeout(timer);
    undoTimeoutRefs.current.delete(id);
    setUndoableActions(prev => {
      const newState = new Map(prev);
      const actionDetails = newState.get(id);
      if (newState.delete(id) && showConfirmation && actionDetails) {
        const finalMessage = confirmationMessage || `Task "${actionDetails.originalTodo.text.substring(0,20)}..." ${actionDetails.actionType === 'delete' ? 'deletion' : 'restoration'} confirmed.`;
        showStatusMessage(finalMessage);
      }
      return newState;
    });
  }, [showStatusMessage]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(focusInput, INACTIVITY_TIMEOUT);
  }, [focusInput]);

  // Effect for initial load and global event listeners
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

  // Effect for saving todos to localStorage
  useEffect(() => {
    if (isClient && initialLoadComplete) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
    }
  }, [todos, isClient, initialLoadComplete]);

  // Task 1: Add Todo
  const addTodo = (text: string) => {
    const newTodo: Todo = { id: Date.now(), text, completed: false, isDeleted: false, pendingFinalDeletionTimestamp: null, batchId: null };
    setTodos(prev => [...prev, newTodo]);
    if (filter !== 'all') setFilter('all');
    setSearchQuery('');
    showStatusMessage(`Task "${text.substring(0, 20)}..." added.`);
    focusInput();
    resetInactivityTimer();
  };

  // Task 2: Toggle Todo Completion
  const toggleTodo = (id: number) => {
    clearSpecificUndoAction(id); // Clear Stage 1 undo if active
    // Cannot toggle if task is part of an active emptying trash batch
    if (emptyingTrashBatch?.taskIds.includes(id)) {
        showStatusMessage("Cannot modify task during batch deletion process.");
        return;
    }
    let taskText = '';
    let newCompletedStatus = false;
    setTodos(prev => prev.map(todo => {
      if (todo.id === id && !todo.pendingFinalDeletionTimestamp) { // Can only toggle if not in Stage 2 grace period
        taskText = todo.text;
        newCompletedStatus = !todo.completed;
        return { ...todo, completed: newCompletedStatus };
      }
      return todo;
    }));
    if (taskText) {
        showStatusMessage(`Task "${taskText.substring(0, 20)}..." marked as ${newCompletedStatus ? 'complete' : 'incomplete'}.`);
    }
    resetInactivityTimer();
  };

  // Task 3: Update Todo Text
  const updateTodoText = (id: number, newText: string) => {
    clearSpecificUndoAction(id); // Clear Stage 1 undo if active
    if (emptyingTrashBatch?.taskIds.includes(id)) {
        showStatusMessage("Cannot modify task during batch deletion process.");
        return;
    }
    let oldText = '';
    setTodos(prev => prev.map(todo => {
      if (todo.id === id && !todo.pendingFinalDeletionTimestamp) { // Can only update if not in Stage 2 grace period
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

  // Task 4: Soft Delete (Stage 1 Undo) / Restore Soft Deleted Task
  const softDeleteTodo = (id: number) => {
    const todoToModify = todos.find(t => t.id === id);
    if (!todoToModify) return;

    // If task is in Stage 2 (pending final deletion), this action should not proceed via Stage 1 logic
    if (todoToModify.pendingFinalDeletionTimestamp) {
      showStatusMessage("Task is already pending final deletion. Restore it from the grace period option.");
      return;
    }

    clearSpecificUndoAction(id); // Clear any previous undo action for this ID

    const newIsDeleted = !todoToModify.isDeleted; // Toggle soft delete state
    const actionType = newIsDeleted ? 'delete' : 'restore';

    setTodos(prev => prev.map(t => t.id === id ? { ...t, isDeleted: newIsDeleted, completed: newIsDeleted ? t.completed : false } : t));

    setUndoableActions(prev => {
      const newState = new Map(prev);
      newState.set(id, { id, originalTodo: { ...todoToModify }, actionType });
      return newState;
    });

    const timer = setTimeout(() => {
      clearSpecificUndoAction(id, true, `Task "${todoToModify.text.substring(0, 20)}..." ${actionType} auto-confirmed.`);
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(id, timer);

    showStatusMessage(`Task "${todoToModify.text.substring(0, 20)}..." marked for ${actionType}. You have ${UNDO_TIMEOUT/1000}s to undo.`);
    focusInput();
    resetInactivityTimer();
  };

  // Task 5: Handle Undo for Stage 1
  const handleUndo = (idToUndo: number) => {
    const actionDetails = undoableActions.get(idToUndo);
    if (!actionDetails) return;
    setTodos(prev => prev.map(todo => todo.id === idToUndo ? { ...actionDetails.originalTodo } : todo));
    showStatusMessage(`Task "${actionDetails.originalTodo.text.substring(0, 20)}..." ${actionDetails.actionType === 'delete' ? 'restoration' : 'deletion'} undone.`);
    clearSpecificUndoAction(idToUndo);
    resetInactivityTimer();
  };

  // Task 2.2: Initiate Empty Trash (Moves tasks to Stage 2)
  const initiateEmptyTrash = useCallback(() => {
    const targetTasks = todos.filter(todo => todo.isDeleted && !undoableActions.has(todo.id) && !todo.pendingFinalDeletionTimestamp);
    if (targetTasks.length === 0) {
      showStatusMessage("No tasks eligible for emptying from trash.");
      return;
    }

    const currentBatchId = `batch-${Date.now()}`;
    const tasksSnapshot = JSON.parse(JSON.stringify(targetTasks)); // Deep copy
    const taskIdsInBatch = targetTasks.map(t => t.id);

    setTodos(prevTodos => prevTodos.map(todo => {
      if (taskIdsInBatch.includes(todo.id)) {
        return { 
          ...todo, 
          pendingFinalDeletionTimestamp: Date.now() + STAGE_2_GRACE_PERIOD_DURATION, 
          batchId: currentBatchId 
        };
      }
      return todo;
    }));

    const newEmptyingTrashBatch: EmptyingTrashBatchDetails = {
      batchId: currentBatchId,
      taskIds: taskIdsInBatch,
      initiatedAt: Date.now(),
      tasksSnapshot
    };
    setEmptyingTrashBatch(newEmptyingTrashBatch);
    showStatusMessage(`${targetTasks.length} task(s) moved to final deletion queue. ${STAGE_2_GRACE_PERIOD_DURATION/1000}s grace period / ${STAGE_4_GLOBAL_RESTORE_WINDOW/(60*1000)} min global restore window.`);
  }, [todos, showStatusMessage, undoableActions]);

  // Task 2.3: Restore Task During Stage 2 Grace Period
  const onRestoreDuringGracePeriod = useCallback((taskId: number) => {
    setTodos(prevTodos => prevTodos.map(todo => {
      if (todo.id === taskId && todo.pendingFinalDeletionTimestamp) {
        showStatusMessage(`Task "${todo.text.substring(0,20)}..." restored from grace period.`);
        return { ...todo, isDeleted: false, completed: false, pendingFinalDeletionTimestamp: null, batchId: null }; 
      }
      return todo;
    }));
    // Check if this was the last task in the current batch
    if (emptyingTrashBatchRef.current) {
        const remainingTasksInBatch = todos.filter(t => 
            emptyingTrashBatchRef.current?.taskIds.includes(t.id) && 
            t.id !== taskId && 
            t.pendingFinalDeletionTimestamp && 
            t.batchId === emptyingTrashBatchRef.current.batchId
        );
        if (remainingTasksInBatch.length === 0) {
            setEmptyingTrashBatch(null); // Clears the batch if no more tasks from it are pending
            showStatusMessage("All tasks from the current batch have been processed or restored.");
        }
    }
  }, [showStatusMessage, todos]);

  // Task 2.4: useEffect for Automatic Final Deletion (Stage 3)
  useEffect(() => {
    if (!isClient || !initialLoadComplete) return;

    autoFinalDeleteIntervalRef.current = setInterval(() => {
      const now = Date.now();
      let tasksWereAutoDeleted = false;
      setTodos(prevTodos => {
        const updatedTodos = prevTodos.filter(todo => {
          if (todo.pendingFinalDeletionTimestamp && now >= todo.pendingFinalDeletionTimestamp) {
            // Check against the emptyingTrashBatchRef for the global restore window
            const batchInfo = emptyingTrashBatchRef.current;
            if (batchInfo && todo.batchId === batchInfo.batchId && now < batchInfo.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) {
              return true; // Keep it, global restore window is active for its batch
            }
            // Otherwise, delete it
            console.log(`Auto-deleting task ID: ${todo.id} (Grace period expired)`);
            tasksWereAutoDeleted = true;
            return false; 
          }
          return true;
        });
        return updatedTodos;
      });
      if (tasksWereAutoDeleted) {
        showStatusMessage("Tasks with expired grace periods have been permanently deleted.");
      }
    }, AUTO_FINAL_DELETE_INTERVAL);

    return () => {
      if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current);
    };
  }, [isClient, initialLoadComplete, showStatusMessage]);

  // Task 2.5: Handle Global Restore All from Batch (Stage 4)
  const handleGlobalRestoreAllFromBatch = useCallback(() => {
    const batchInfo = emptyingTrashBatchRef.current;
    if (!batchInfo) {
      showStatusMessage("No active batch to restore.");
      return;
    }
    if (Date.now() >= batchInfo.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) {
      showStatusMessage("Global restore window for this batch has expired.");
      setEmptyingTrashBatch(null); // Clear the expired batch
      return;
    }

    const restoredTasks: Todo[] = batchInfo.tasksSnapshot.map(snapTodo => ({
      ...snapTodo, // Takes all original properties from snapshot
      isDeleted: false,
      completed: snapTodo.completed, // Restore original completed status
      pendingFinalDeletionTimestamp: null,
      batchId: null,
    }));

    setTodos(prevTodos => {
      // Filter out tasks that were part of the batch from current todos
      const remainingTodos = prevTodos.filter(t => !batchInfo.taskIds.includes(t.id));
      // Add the restored tasks
      return [...remainingTodos, ...restoredTasks];
    });

    showStatusMessage(`${restoredTasks.length} task(s) restored from batch '${batchInfo.batchId}'.`);
    setEmptyingTrashBatch(null);
    if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);

  }, [showStatusMessage]);
  
  // Task 2.6: useEffect for Emptying Trash Batch Timeout (Stage 4 Window Expiry)
  useEffect(() => {
    if (emptyingTrashBatch) {
      const timeRemaining = (emptyingTrashBatch.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) - Date.now();
      if (timeRemaining > 0) {
        if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
        globalRestoreWindowTimeoutRef.current = setTimeout(() => {
          showStatusMessage(`Global restore window for batch '${emptyingTrashBatch.batchId}' has ended.`);
          setEmptyingTrashBatch(null);
        }, timeRemaining);
      }
    } else {
      // Clear timeout if batch is cleared for other reasons (e.g. manual restore)
      if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
    }
    return () => {
      if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
    };
  }, [emptyingTrashBatch, showStatusMessage]);

  // Task 2.7: Update Derived State / Filter Logic
  const filteredAndSearchedTodos = useMemo(() => {
    if (!isClient || !initialLoadComplete) return [];
    return todos.filter(todo => {
      const isInUndoStage1 = undoableActions.has(todo.id) && undoableActions.get(todo.id)?.actionType === 'delete';
      const isInGraceStage2 = !!todo.pendingFinalDeletionTimestamp;

      // Visibility based on stages
      let isVisible = true;
      if (filter === 'active') isVisible = !todo.completed && !todo.isDeleted && !isInGraceStage2 || isInUndoStage1 && !undoableActions.get(todo.id)!.originalTodo.completed;
      else if (filter === 'completed') isVisible = todo.completed && !todo.isDeleted && !isInGraceStage2 || isInUndoStage1 && undoableActions.get(todo.id)!.originalTodo.completed;
      else if (filter === 'deleted') isVisible = (todo.isDeleted || isInGraceStage2) && !isInUndoStage1;
      else if (filter === 'all') isVisible = !todo.isDeleted || isInUndoStage1 || isInGraceStage2;
      else {
          console.warn(`Unknown filter type: ${filter}`);
          isVisible = true; // Default to show if filter is unknown
      }
      
      if (!isVisible) return false;

      if (searchQuery.trim() !== '') {
        return todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [todos, filter, searchQuery, isClient, initialLoadComplete, undoableActions, emptyingTrashBatch]);

  const itemsEligibleForEmptyTrash = useMemo(() => {
      return todos.filter(todo => todo.isDeleted && !undoableActions.has(todo.id) && !todo.pendingFinalDeletionTimestamp).length;
  }, [todos, undoableActions]);

  // --- Updated Counters ---
  const activeTasksCount = useMemo(() => todos.filter(t => !t.completed && !t.isDeleted && !t.pendingFinalDeletionTimestamp && !undoableActions.has(t.id)).length, [todos, undoableActions]);
  const totalVisibleTasksCount = useMemo(() => filteredAndSearchedTodos.length, [filteredAndSearchedTodos]); // Based on current filter
  const softDeletedAndStage2Count = useMemo(() => todos.filter(t => (t.isDeleted || t.pendingFinalDeletionTimestamp) && !undoableActions.has(t.id)).length, [todos, undoableActions]);

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
    const hasSearch = searchQuery.trim() !== '';
    if (filteredAndSearchedTodos.length > 0) return null;

    if (todos.length === 0) return { title: "No tasks yet!", message: "Get started by adding a new task above." };
    if (hasSearch) return { title: "No tasks found", message: `Your search for "${searchQuery}" did not match any tasks.` };
    if (filter === 'active' && activeTasksCount === 0) return { title: "No active tasks!", message: "All your tasks are completed or deleted." };
    if (filter === 'completed' && todos.filter(t=>t.completed).length === 0) return { title: "No completed tasks!", message: "Mark some tasks as completed to see them here." };
    if (filter === 'deleted' && softDeletedAndStage2Count === 0) return { title: "Trash is empty!", message: "You haven't deleted any tasks yet." };
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
                  {/* Basic Icon, consider a more descriptive one based on emptyState.title */} 
                  <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10h.01" /></svg>
                  <h3 className="mt-2 text-xl font-semibold text-slate-400">{emptyState.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{emptyState.message}</p>
                </div>
              ) : (
                <TodoList
                  todos={filteredAndSearchedTodos}
                  onToggle={toggleTodo}
                  onRemove={softDeleteTodo} // This now handles Stage 1: soft delete / restore from soft delete
                  onUpdateText={updateTodoText}
                  undoableActions={undoableActions}
                  onUndo={handleUndo} // Stage 1 undo
                  undoTimeoutDuration={UNDO_TIMEOUT}
                  onRestoreDuringGracePeriod={onRestoreDuringGracePeriod} // Stage 2 restore
                  currentTime={currentTime} // For countdowns
                />
              )
            )}
             {isClient && initialLoadComplete && filter === 'deleted' && filteredAndSearchedTodos.length > 0 && !emptyingTrashBatch && itemsEligibleForEmptyTrash > 0 && (
              <p className="text-center mt-4 text-xs sm:text-sm text-slate-400">
                These tasks are soft-deleted. Use "Empty Trash" to start final deletion process.
              </p>
            )}
            {isClient && initialLoadComplete && filter === 'deleted' && emptyingTrashBatch && (
                 <p className="text-center mt-4 text-xs sm:text-sm text-orange-400">
                    Batch '{emptyingTrashBatch.batchId.substring(6)}' is pending final deletion. Global restore window: {getGlobalRestoreTimeRemaining()}
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
                        onClick={handleGlobalRestoreAllFromBatch}
                        variant="outline"
                        size="sm"
                        className="text-green-400 border-green-500 hover:bg-green-700 hover:text-green-200"
                        disabled={isActionInProgress && !emptyingTrashBatch} // Allow if only this batch is the action
                    >
                        Restore Batch ({emptyingTrashBatch.tasksSnapshot.length}) - {getGlobalRestoreTimeRemaining()}
                    </Button>
                )}
              </div>
            </CardFooter>
          )}
        </Card>

        {isClient && statusMessage && (
          <VisibleStatusMessage
            message={statusMessage}
            // duration is handled by showStatusMessage now
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
