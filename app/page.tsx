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
  INACTIVITY_TIMEOUT,
  STATUS_MESSAGE_DURATION,
  UNDO_TIMEOUT, // Using this for red-border items
  STAGE_4_GLOBAL_RESTORE_WINDOW, // This is GREEN_BUTTON_RESTORE_WINDOW
  AUTO_FINAL_DELETE_INTERVAL,
  CURRENT_TIME_UPDATE_INTERVAL,
  FILTER_SWITCH_DELAY // For yellow border phase
} from './lib/constants';
import { getGlobalRestoreTimeRemaining } from './lib/utils';
import { useTodoManagement } from './hooks/useTodoManagement';

export default function Home() {
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
  
  const [emptyingTrashBatch, setEmptyingTrashBatch] = useState<EmptyingTrashBatchDetails | null>(null);
  const emptyingTrashBatchRef = useRef<EmptyingTrashBatchDetails | null>(null);

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

  const {
    todos,
    setTodos,
    undoableActions,
    addTodo,
    toggleTodo,
    updateTodoText,
    softDeleteTodo, // This now handles the yellow border phase
    handleUndo,
    undoTimeoutRefs,
    delayedFilterSwitchTimersRef // Added from the hook
  } = useTodoManagement({
    isClient,
    initialLoadComplete,
    showStatusMessage,
    focusInput,
    resetInactivityTimer,
    emptyingTrashBatchRef,
    currentFilter: filter,
    setFilter,
    setSearchQuery,
    currentTime // Pass currentTime to the hook
  });

  useEffect(() => {
    emptyingTrashBatchRef.current = emptyingTrashBatch;
  }, [emptyingTrashBatch]);

  useEffect(() => {
    setIsClient(true);
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
      delayedFilterSwitchTimersRef.current.forEach(timer => clearTimeout(timer)); // Cleanup for new timers
      if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current);
      if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
      clearInterval(timeUpdateInterval);
    };
  }, [resetInactivityTimer, undoTimeoutRefs, delayedFilterSwitchTimersRef]);

  const initiateEmptyTrash = useCallback(() => {
    // Eligible tasks are those marked `isDeleted` and NOT in yellow-border phase (`markedForDeletionAt` is null)
    // and not already pending final deletion (`pendingFinalDeletionTimestamp` is null)
    // and not part of an active undo action for a *restore* (though this is less likely for deleted items)
    const targetTasks = todos.filter(todo => 
        todo.isDeleted && 
        !todo.markedForDeletionAt && 
        !todo.pendingFinalDeletionTimestamp &&
        !undoableActions.has(todo.id) // Ensure no active undo (e.g. if a restore was just undone)
    );

    if (targetTasks.length === 0) {
      showStatusMessage("No tasks eligible for permanent deletion from trash.");
      return;
    }
    const currentBatchId = `batch-${Date.now()}`;
    const tasksSnapshot = JSON.parse(JSON.stringify(targetTasks));
    const taskIdsInBatch = targetTasks.map(t => t.id);

    setTodos(prevTodos => prevTodos.map(todo => {
      if (taskIdsInBatch.includes(todo.id)) {
        // Red border phase: 1-minute individual undo window
        return { ...todo, pendingFinalDeletionTimestamp: Date.now() + UNDO_TIMEOUT, batchId: currentBatchId };
      }
      return todo;
    }));

    setEmptyingTrashBatch({ batchId: currentBatchId, taskIds: taskIdsInBatch, initiatedAt: Date.now(), tasksSnapshot });
    showStatusMessage(`${targetTasks.length} task(s) pending final deletion (red border). You have 1 min to undo individually, or 5 mins to restore all.`);
    focusInput(); 
    resetInactivityTimer();
  }, [todos, undoableActions, setTodos, showStatusMessage, focusInput, resetInactivityTimer]);

  const onUndoPendingFinalDeletion = useCallback((taskId: number) => {
    setTodos(prevTodos => {
      let taskRestored = false;
      let restoredTaskText = "";
      const newTodos = prevTodos.map(todo => {
        if (todo.id === taskId && todo.pendingFinalDeletionTimestamp && todo.batchId === emptyingTrashBatchRef.current?.batchId) {
          taskRestored = true;
          restoredTaskText = todo.text;
          // Restore to a normal state within the 'deleted' filter
          return { ...todo, pendingFinalDeletionTimestamp: null, batchId: null };
        }
        return todo;
      });

      if (taskRestored) {
        showStatusMessage(`Pending deletion of "${restoredTaskText.substring(0,20)}..." undone. It remains in trash.`);
        const currentBatch = emptyingTrashBatchRef.current;
        if (currentBatch) {
          const remainingTasksInBatch = newTodos.filter(t => 
            currentBatch.taskIds.includes(t.id) && 
            t.batchId === currentBatch.batchId && 
            t.pendingFinalDeletionTimestamp
          );
          if (remainingTasksInBatch.length === 0) {
            setEmptyingTrashBatch(null); // All tasks from this batch are processed or undone
            showStatusMessage("All tasks in the current pending deletion batch have been processed or undone.");
          }
        }
      }
      return newTodos;
    });
    focusInput(); 
    resetInactivityTimer();
  }, [setTodos, showStatusMessage, focusInput, resetInactivityTimer]); 

  // Effect for auto-deleting items whose pendingFinalDeletionTimestamp has passed (red-bordered items)
  useEffect(() => {
    if (!isClient || !initialLoadComplete) return;

    autoFinalDeleteIntervalRef.current = setInterval(() => {
      const now = Date.now();
      let tasksWerePermanentlyDeleted = false;
      
      setTodos(prevTodos => {
        const updatedTodos = prevTodos.filter(todo => {
          if (todo.pendingFinalDeletionTimestamp && now >= todo.pendingFinalDeletionTimestamp) {
            // Check if it's part of the current batch and if the global restore window for THAT batch is still active.
            // This check is a failsafe; primary restore capability is via onUndoPendingFinalDeletion or handleRestoreAllPendingDeletion.
            const batchInfo = emptyingTrashBatchRef.current;
            if (batchInfo && todo.batchId === batchInfo.batchId && now < batchInfo.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) {
              // It's part of an active batch whose global restore window is still open.
              // It should not be auto-deleted here yet. It stays with red border.
              return true; 
            }
            // If not part of such an active batch, or if its batch's global restore window has also passed,
            // then its individual 1-min timer has expired, so it can be permanently deleted.
            tasksWerePermanentlyDeleted = true;
            console.log(`Permanently deleting task ID: ${todo.id} - Text: ${todo.text}`);
            return false; // Permanently delete
          }
          return true;
        });

        // If permanent deletions occurred, check if the active batch needs to be cleared
        if (tasksWerePermanentlyDeleted && emptyingTrashBatchRef.current) {
          const currentBatch = emptyingTrashBatchRef.current;
          const remainingTasksInBatch = updatedTodos.filter(t => 
            t.batchId === currentBatch.batchId && 
            t.pendingFinalDeletionTimestamp
          );
          if (remainingTasksInBatch.length === 0) {
            setEmptyingTrashBatch(null); // All tasks from this batch are permanently deleted or were restored.
          }
        }
        return updatedTodos;
      });

      if (tasksWerePermanentlyDeleted) {
        showStatusMessage("Tasks with expired red-border timers have been permanently deleted.");
      }
    }, AUTO_FINAL_DELETE_INTERVAL);

    return () => { if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current); };
  }, [isClient, initialLoadComplete, setTodos, showStatusMessage]);

  const handleRestoreAllPendingDeletion = useCallback(() => {
    const batchInfo = emptyingTrashBatchRef.current;
    if (!batchInfo) {
      showStatusMessage("No tasks currently pending deletion to restore all.");
      return;
    }

    if (currentTime >= batchInfo.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) {
      showStatusMessage("The 5-minute restore window for this batch has expired.");
      // Batch might still be active if some items have not hit their 1-min expiry.
      // We don't clear emptyingTrashBatch here, let the auto-delete or individual undos handle it.
      return;
    }

    const tasksToRestoreFromSnapshot = batchInfo.tasksSnapshot; // These are already in {isDeleted: true} state

    setTodos(prevTodos => {
      const updatedTodos = prevTodos.map(currentTodo => {
        // Only revert tasks that are part of the current batch
        if (currentTodo.batchId === batchInfo.batchId && currentTodo.pendingFinalDeletionTimestamp) {
          const snapshotVersion = tasksToRestoreFromSnapshot.find(snapTodo => snapTodo.id === currentTodo.id);
          return { 
            ...(snapshotVersion || currentTodo), // Fallback to currentTodo if somehow not in snapshot
            pendingFinalDeletionTimestamp: null, 
            batchId: null, 
            isDeleted: true, // Ensure it remains in the deleted filter, but not pending final deletion
            completed: false // Typically items in trash are not considered completed
          };
        }
        return currentTodo;
      });
      return updatedTodos;
    });

    showStatusMessage(`${tasksToRestoreFromSnapshot.length} task(s) from the batch restored to normal deleted items list.`);
    setEmptyingTrashBatch(null); // Clear the batch details as it has been fully restored
    if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current); // Clear the 5-min timer for this batch
    focusInput(); 
    resetInactivityTimer();
  }, [setTodos, showStatusMessage, focusInput, resetInactivityTimer, currentTime]);
  
  // Effect for the 5-minute global restore window (green button timer)
  useEffect(() => {
    if (emptyingTrashBatch) {
      const timeRemaining = (emptyingTrashBatch.initiatedAt + STAGE_4_GLOBAL_RESTORE_WINDOW) - currentTime;
      if (timeRemaining <= 0) {
        if (emptyingTrashBatchRef.current && emptyingTrashBatchRef.current.batchId === emptyingTrashBatch.batchId) {
            showStatusMessage(`The 5-minute "Restore All" window for the current batch has ended.`);
            // Do NOT clear emptyingTrashBatch here. Tasks in it might still be within their 1-min red border phase.
            // The button will just disappear from the UI based on this timer.
            if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
        }
      } else {
        if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
        globalRestoreWindowTimeoutRef.current = setTimeout(() => {
          if (emptyingTrashBatchRef.current && emptyingTrashBatchRef.current.batchId === emptyingTrashBatch.batchId) {
            showStatusMessage(`The 5-minute "Restore All" window for the current batch has ended.`);
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
      const isInUndoStage1 = undoableActions.has(todo.id); // For initial soft delete (yellow border phase)
      const actionDetailsForUndo = isInUndoStage1 ? undoableActions.get(todo.id) : undefined;
      
      const isMarkedForDeletionWithDelay = !!todo.markedForDeletionAt; // Yellow border phase
      const isPendingFinalDeletion = !!todo.pendingFinalDeletionTimestamp; // Red border phase

      let isVisible = false;
      switch (filter) {
        case 'all':
          // Visible if NOT soft-deleted (isDeleted = false) AND NOT in yellow-border phase waiting for filter switch.
          // OR if it IS in yellow-border phase (markedForDeletionAt is true).
          // OR if it was soft-deleted but is being restored via undo.
          isVisible = (!todo.isDeleted && !isMarkedForDeletionWithDelay && !isPendingFinalDeletion) || 
                      isMarkedForDeletionWithDelay || 
                      (actionDetailsForUndo?.actionType === 'restore');
          break;
        case 'active':
          isVisible = (!todo.completed && !todo.isDeleted && !isMarkedForDeletionWithDelay && !isPendingFinalDeletion) || 
                      (isMarkedForDeletionWithDelay && !todo.completed) ||
                      (actionDetailsForUndo?.actionType === 'restore' && !actionDetailsForUndo.originalTodo.completed);
          break;
        case 'completed':
          isVisible = (todo.completed && !todo.isDeleted && !isMarkedForDeletionWithDelay && !isPendingFinalDeletion) ||
                      (isMarkedForDeletionWithDelay && todo.completed) ||
                      (actionDetailsForUndo?.actionType === 'restore' && actionDetailsForUndo.originalTodo.completed);
          break;
        case 'deleted':
          // Visible if fully soft-deleted (isDeleted = true, not in yellow phase, not in undo for delete itself)
          // OR if it's in red-border phase (pendingFinalDeletion)
          // Note: A task in yellow-border phase (markedForDeletionAt) is NOT shown in 'deleted' yet.
          //       It moves to 'deleted' (isDeleted becomes true) after FILTER_SWITCH_DELAY. 
          //       If its initial delete is being undone (actionDetailsForUndo?.actionType === 'delete'), it might also appear here temporarily if isDeleted was true on originalTodo.
          isVisible = (todo.isDeleted && !isMarkedForDeletionWithDelay) || isPendingFinalDeletion;
          if (isInUndoStage1 && actionDetailsForUndo?.actionType === 'delete' && !isMarkedForDeletionWithDelay && todo.isDeleted) {
            // This case is tricky: if we are undoing a confirmed delete, it might briefly flash here.
            // However, handleUndo should revert it to its original state (likely not isDeleted or not markedForDeletionAt).
            // The main logic for `isDeleted` filter is `todo.isDeleted && !isMarkedForDeletionWithDelay` (confirmed deleted) or `isPendingFinalDeletion` (red border)
          }
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
    // Eligible if soft-deleted, not in yellow-border phase, and not already in red-border phase, and not in an undo action
    return todos.filter(todo => todo.isDeleted && !todo.markedForDeletionAt && !todo.pendingFinalDeletionTimestamp && !undoableActions.has(todo.id)).length;
  }, [todos, undoableActions]);

  const activeTasksCount = useMemo(() => {
    // Active if not completed, not soft-deleted, not in yellow-border, not in red-border, and not in an undo action for deletion
    return todos.filter(t => 
        !t.completed && 
        !t.isDeleted && 
        !t.markedForDeletionAt && 
        !t.pendingFinalDeletionTimestamp &&
        !(undoableActions.has(t.id) && undoableActions.get(t.id)?.actionType === 'delete')
    ).length;
  }, [todos, undoableActions]);
  
  const softDeletedAndStage2Count = useMemo(() => {
    // Count items in 'deleted' filter: soft-deleted (isDeleted=true, not yellow) OR red-bordered
    return todos.filter(t => 
        (t.isDeleted && !t.markedForDeletionAt) || 
        t.pendingFinalDeletionTimestamp
    ).length;
  }, [todos]);

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
    if (filter === 'deleted') {
      if (emptyingTrashBatch) return { title: "Emptying Trash...", message: "Tasks are pending final deletion." };
      if (itemsEligibleForEmptyTrash > 0) return { title: "Trash contains items!", message: "Use 'Empty Trash' to start permanent deletion process." };
      return { title: "Trash is empty!", message: "You haven't deleted any tasks yet, or no tasks match the current search in trash." };
    }
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
                  onRemove={softDeleteTodo} // This is the initial delete (yellow border)
                  onUpdateText={updateTodoText}
                  undoableActions={undoableActions}
                  onUndo={handleUndo} // Handles undo for initial soft delete
                  undoTimeoutDuration={UNDO_TIMEOUT} 
                  onRestorePendingDeletion={onUndoPendingFinalDeletion} // Renamed for clarity: this undoes a red-border item
                  currentTime={currentTime}
                  emptyingTrashBatch={emptyingTrashBatch} // Pass for TodoItem to know about batch state for red borders
                />
              )
            )}
             {isClient && initialLoadComplete && filter === 'deleted' && filteredAndSearchedTodos.length > 0 && !emptyingTrashBatch && itemsEligibleForEmptyTrash > 0 && (
              <p className="text-center mt-4 text-xs sm:text-sm text-slate-400">
                These tasks are in trash. Use "Empty Trash" to start final deletion process.
              </p>
            )}
            {isClient && initialLoadComplete && filter === 'deleted' && emptyingTrashBatch && emptyingTrashBatch.taskIds.some(id => todos.find(t=>t.id === id && t.pendingFinalDeletionTimestamp)) && (
                 <p className="text-center mt-4 text-xs sm:text-sm text-orange-400">
                    Tasks are pending final deletion. You have {memoizedGetGlobalRestoreTimeRemaining()} to restore all, or 1 min per item.
                 </p>
            )}
          </CardContent>

          {isClient && initialLoadComplete && (
            <CardFooter>
              <TodoFooter 
                activeTasksCount={activeTasksCount}
                softDeletedAndStage2Count={softDeletedAndStage2Count} // This counts items in trash (isDeleted or pendingFinal)
                filter={filter}
                emptyingTrashBatch={emptyingTrashBatch}
                itemsEligibleForEmptyTrash={itemsEligibleForEmptyTrash}
                onInitiateEmptyTrash={initiateEmptyTrash}
                onRestoreAllPendingDeletion={handleRestoreAllPendingDeletion}
                getGlobalRestoreTimeRemaining={memoizedGetGlobalRestoreTimeRemaining}
                isClient={isClient}
                initialLoadComplete={initialLoadComplete}
                isActionInProgress={isActionInProgress} // Used to disable controls during actions
                currentTime={currentTime} // Pass for footer to decide if restore all button is active
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
