'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TodoList } from './components/todo/TodoList';
import { TodoAddForm, type TodoAddFormHandle } from './components/todo/TodoAddForm';
import type { Todo, UndoableActionDetails, FilterValue, EmptyingTrashBatchDetails } from './types';
import { TodoListSkeleton } from './components/todo/TodoListSkeleton';
import { VisibleStatusMessage } from './components/ui/StatusMessage';
import { TodoControls } from './components/layout/TodoControls';
import { TodoFooter } from './components/layout/TodoFooter';
import {
  LOCAL_STORAGE_KEY,
  INACTIVITY_TIMEOUT,
  UNDO_TIMEOUT,
  STATUS_MESSAGE_DURATION,
  STAGE_2_GRACE_PERIOD_DURATION,
  STAGE_4_GLOBAL_RESTORE_WINDOW,
  AUTO_FINAL_DELETE_INTERVAL,
  CURRENT_TIME_UPDATE_INTERVAL
} from './lib/constants';
import { getGlobalRestoreTimeRemaining } from './lib/utils';

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

  const clearSpecificUndoAction = useCallback((id: number, showConfirmation: boolean = false, confirmationMessage?: string, autoSwitchToDeletedFilter?: boolean) => {
    const timer = undoTimeoutRefs.current.get(id);
    if (timer) clearTimeout(timer);
    undoTimeoutRefs.current.delete(id);
    let actionDetailsToReturn: UndoableActionDetails | undefined;
    setUndoableActions(prev => {
      const newState = new Map(prev);
      actionDetailsToReturn = newState.get(id);
      const originalTodoText = actionDetailsToReturn?.originalTodo?.text ? actionDetailsToReturn.originalTodo.text.substring(0,20) + '...' : 'task';
      if (newState.delete(id) && showConfirmation && actionDetailsToReturn) {
        const finalMessage = confirmationMessage || `Action on "${originalTodoText}" confirmed.`;
        showStatusMessage(finalMessage);
      }
      return newState;
    });
    if (autoSwitchToDeletedFilter && actionDetailsToReturn?.actionType === 'delete') {
      setFilter('deleted');
      setSearchQuery(''); // Clear search when switching to deleted filter
    }
    return actionDetailsToReturn;
  }, [showStatusMessage]);

  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = { id: Date.now(), text, completed: false, isDeleted: false, pendingFinalDeletionTimestamp: null, batchId: null };
    setTodos(prev => [...prev, newTodo]);
    if (filter !== 'all') setFilter('all');
    setSearchQuery('');
    showStatusMessage(`Task "${text.substring(0, 20)}..." added.`);
    focusInput(); 
    resetInactivityTimer();
  }, [filter, focusInput, resetInactivityTimer, showStatusMessage]);

  const toggleTodo = useCallback((id: number) => {
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
  }, [clearSpecificUndoAction, resetInactivityTimer, showStatusMessage]);

  const updateTodoText = useCallback((id: number, newText: string) => {
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
  }, [clearSpecificUndoAction, focusInput, resetInactivityTimer, showStatusMessage]);

  const softDeleteTodo = useCallback((id: number) => {
    const todoToModify = todos.find(t => t.id === id);
    if (!todoToModify) return;
    if (todoToModify.pendingFinalDeletionTimestamp) {
      showStatusMessage("Task is pending final deletion. Use 'Undo' from the task options to cancel this.");
      return;
    }
    clearSpecificUndoAction(id); // Clear any existing undo action for this item
    const newIsDeleted = !todoToModify.isDeleted;
    const actionType = newIsDeleted ? 'delete' : 'restore';
    const originalTodoForUndo: Todo = { ...todoToModify }; // Snapshot before change

    // Update the todo's state immediately
    setTodos(prev => prev.map(t => t.id === id ? { ...t, isDeleted: newIsDeleted, completed: newIsDeleted ? t.completed : false } : t));
    
    // Set up the undo action
    setUndoableActions(prev => {
      const newState = new Map(prev);
      newState.set(id, { id, originalTodo: originalTodoForUndo, actionType, timestamp: Date.now() });
      return newState;
    });

    // Set a timer to auto-confirm the action and potentially switch filter
    const timer = setTimeout(() => {
      const actionDetails = clearSpecificUndoAction(id, true, `Task "${originalTodoForUndo.text.substring(0, 20)}..." ${actionType} auto-confirmed.`, actionType === 'delete');
       // If it was a delete action that just got auto-confirmed, and the user hasn't undone it,
      // and the current filter is not already 'deleted', then switch to 'deleted' filter.
      if (actionDetails && actionDetails.actionType === 'delete') {
          // Check current filter *after* clearSpecificUndoAction (which might have already switched it if autoSwitch was true and it was a delete)
          // This additional check ensures we only switch if not already on 'deleted' or if clearSpecificUndoAction didn't switch it for some reason.
          // The main auto-switch is now handled by clearSpecificUndoAction directly.
      }
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(id, timer);

    showStatusMessage(`Task "${originalTodoForUndo.text.substring(0, 20)}..." marked for ${actionType}. You have ${UNDO_TIMEOUT/1000}s to undo.`);
    focusInput();
    resetInactivityTimer();
  }, [todos, clearSpecificUndoAction, focusInput, resetInactivityTimer, showStatusMessage]);

  const handleUndo = useCallback((idToUndo: number) => {
    const actionDetails = undoableActions.get(idToUndo);
    if (!actionDetails) return;
    setTodos(prev => prev.map(todo => todo.id === idToUndo ? { ...actionDetails.originalTodo } : todo));
    showStatusMessage(`Task "${actionDetails.originalTodo.text.substring(0, 20)}..." ${actionDetails.actionType === 'delete' ? 'restoration' : 'deletion'} undone.`);
    clearSpecificUndoAction(idToUndo, false); // Don't show confirmation for undo itself, don't auto-switch filter
    focusInput(); 
    resetInactivityTimer();
  }, [undoableActions, clearSpecificUndoAction, focusInput, resetInactivityTimer, showStatusMessage]);

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
      const isInUndoStage1 = undoableActions.has(todo.id);
      const isInGraceStage2 = !!todo.pendingFinalDeletionTimestamp;
      const actionDetails = isInUndoStage1 ? undoableActions.get(todo.id) : undefined; // Define actionDetails here

      let isVisible = false;
      switch (filter) {
        case 'all':
          isVisible = !todo.isDeleted && !isInGraceStage2 || (actionDetails?.actionType === 'restore');
          break;
        case 'active':
          isVisible = (!todo.completed && !todo.isDeleted && !isInGraceStage2) || 
                      (actionDetails?.actionType === 'restore' && !actionDetails.originalTodo.completed);
          break;
        case 'completed':
          isVisible = (todo.completed && !todo.isDeleted && !isInGraceStage2) || 
                      (actionDetails?.actionType === 'restore' && actionDetails.originalTodo.completed);
          break;
        case 'deleted':
          isVisible = (todo.isDeleted && !isInUndoStage1) || isInGraceStage2 || (actionDetails?.actionType === 'delete');
          break;
        default:
          isVisible = true; 
      }

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

  const activeTasksCount = useMemo(() => todos.filter(t => !t.completed && !t.isDeleted && !t.pendingFinalDeletionTimestamp && !undoableActions.has(t.id)).length, [todos, undoableActions]);
  
  const softDeletedAndStage2Count = useMemo(() => {
    return todos.filter(t => 
        (t.isDeleted && !undoableActions.has(t.id)) || // Confirmed soft-deleted (not in undo)
        t.pendingFinalDeletionTimestamp || // In grace period
        (undoableActions.has(t.id) && undoableActions.get(t.id)?.actionType === 'delete') // In stage 1 undo (soft-deleted)
    ).length;
}, [todos, undoableActions]);

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

  const memoizedGetGlobalRestoreTimeRemaining = useCallback(() => {
      return getGlobalRestoreTimeRemaining(emptyingTrashBatch, currentTime, STAGE_4_GLOBAL_RESTORE_WINDOW);
  }, [emptyingTrashBatch, currentTime]);

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
              <TodoControls 
                filter={filter}
                onFilterChange={setFilter}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                filterOptions={filterOptions}
                isClient={isClient}
                initialLoadComplete={initialLoadComplete}
                isActionInProgress={isActionInProgress}
              />
            </div>
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
                    Tasks are pending final deletion. You can undo this for {memoizedGetGlobalRestoreTimeRemaining()}.
                 </p>
            )}
          </CardContent>

          {isClient && initialLoadComplete && (
            <CardFooter>
              <TodoFooter 
                activeTasksCount={activeTasksCount}
                softDeletedAndStage2Count={softDeletedAndStage2Count}
                filter={filter}
                emptyingTrashBatch={emptyingTrashBatch}
                itemsEligibleForEmptyTrash={itemsEligibleForEmptyTrash}
                onInitiateEmptyTrash={initiateEmptyTrash}
                onRestoreAllPendingDeletion={handleRestoreAllPendingDeletion}
                getGlobalRestoreTimeRemaining={memoizedGetGlobalRestoreTimeRemaining}
                isClient={isClient}
                initialLoadComplete={initialLoadComplete}
                isActionInProgress={isActionInProgress}
              />
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
