'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TodoList } from './components/todo/TodoList';
import { TodoAddForm, type TodoAddFormHandle } from './components/todo/TodoAddForm';
import type { Todo, FilterValue, EmptyingTrashBatchDetails } from './types';
import { TodoListSkeleton } from './components/todo/TodoListSkeleton';
import { VisibleStatusMessage } from './components/ui/StatusMessage';
import { TodoControls } from './components/layout/TodoControls';
import { TodoFooter } from './components/layout/TodoFooter';
import {
  INACTIVITY_TIMEOUT,
  STATUS_MESSAGE_DURATION,
  UNDO_TIMEOUT, 
  STAGE_4_GLOBAL_RESTORE_WINDOW,
  CURRENT_TIME_UPDATE_INTERVAL,
  FILTER_STORAGE_KEY,
  SEARCH_QUERY_STORAGE_KEY,
  EMPTYING_TRASH_BATCH_STORAGE_KEY
} from './lib/constants';
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

  const handleSetNewEmptyingTrashBatch = useCallback((batchDetails: EmptyingTrashBatchDetails | null) => {
    setEmptyingTrashBatch(batchDetails);
  }, []);

  const handleUpdateExistingEmptyingTrashBatch = useCallback((batchId: string, updates: Partial<Omit<EmptyingTrashBatchDetails, 'batchId' | 'taskIdsInBatch' | 'tasksSnapshot' | 'batchInitiationTime'>>) => {
    setEmptyingTrashBatch(prev => {
      if (prev && prev.batchId === batchId) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, []);

  const {
    todos,
    undoableActions,
    addTodo,
    toggleTodo,
    updateTodoText,
    softDeleteTodo, 
    handleUndo,
    initiateEmptyTrashProcess,
    undoIndividualPendingFinalDeletion,
    restoreBatchFromEmptyTrash,
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
    currentTime, 
    setNewEmptyingTrashBatch: handleSetNewEmptyingTrashBatch,
    updateExistingEmptyingTrashBatch: handleUpdateExistingEmptyingTrashBatch,
  });

  useEffect(() => {
    emptyingTrashBatchRef.current = emptyingTrashBatch;
  }, [emptyingTrashBatch]);

  useEffect(() => {
    setIsClient(true);
    try {
      const storedFilter = localStorage.getItem(FILTER_STORAGE_KEY) as FilterValue | null;
      if (storedFilter) setFilter(storedFilter);
      const storedSearchQuery = localStorage.getItem(SEARCH_QUERY_STORAGE_KEY);
      if (storedSearchQuery) setSearchQuery(storedSearchQuery);
      const storedEmptyingTrashBatch = localStorage.getItem(EMPTYING_TRASH_BATCH_STORAGE_KEY);
      if (storedEmptyingTrashBatch) {
        setEmptyingTrashBatch(JSON.parse(storedEmptyingTrashBatch));
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      showStatusMessage("Error loading saved preferences.");
    }
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
      if (globalRestoreWindowTimeoutRef.current) clearTimeout(globalRestoreWindowTimeoutRef.current);
      clearInterval(timeUpdateInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetInactivityTimer]); 

  useEffect(() => {
    if (isClient && initialLoadComplete) {
      try {
        localStorage.setItem(FILTER_STORAGE_KEY, filter);
      } catch (error) {
        console.error("Error saving filter to localStorage:", error);
        showStatusMessage("Error saving filter preference.");
      }
    }
  }, [filter, isClient, initialLoadComplete, showStatusMessage]);

  useEffect(() => {
    if (isClient && initialLoadComplete) {
      try {
        localStorage.setItem(SEARCH_QUERY_STORAGE_KEY, searchQuery);
      } catch (error) {
        console.error("Error saving search query to localStorage:", error);
        showStatusMessage("Error saving search preference.");
      }
    }
  }, [searchQuery, isClient, initialLoadComplete, showStatusMessage]);

  useEffect(() => {
    if (isClient && initialLoadComplete) {
      try {
        if (emptyingTrashBatch) {
          localStorage.setItem(EMPTYING_TRASH_BATCH_STORAGE_KEY, JSON.stringify(emptyingTrashBatch));
        } else {
          localStorage.removeItem(EMPTYING_TRASH_BATCH_STORAGE_KEY);
        }
      } catch (error) {
        console.error("Error saving emptyingTrashBatch to localStorage:", error);
        showStatusMessage("Error saving trash processing state.");
      }
    }
  }, [emptyingTrashBatch, isClient, initialLoadComplete, showStatusMessage]);

  const showGlobalRestoreButton = useMemo(() => {
    if (filter !== 'deleted') return false; 
    if (!emptyingTrashBatch || !emptyingTrashBatch.allIndividualTimersEndedForBatch || emptyingTrashBatch.isRestored) {
      return false;
    }
    if (emptyingTrashBatch.batchCompletionTime) {
      const timeSinceCompletion = currentTime - emptyingTrashBatch.batchCompletionTime;
      return timeSinceCompletion < STAGE_4_GLOBAL_RESTORE_WINDOW;
    }
    return false;
  }, [emptyingTrashBatch, currentTime, filter]);

  const globalRestoreTimeRemainingString = useMemo(() => {
    if (!showGlobalRestoreButton || !emptyingTrashBatch || !emptyingTrashBatch.batchCompletionTime) return "";
    const timeRemaining = (emptyingTrashBatch.batchCompletionTime + STAGE_4_GLOBAL_RESTORE_WINDOW) - currentTime;
    if (timeRemaining <= 0) return "0s";
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }, [emptyingTrashBatch, currentTime, showGlobalRestoreButton]);

  const filteredAndSearchedTodos = useMemo(() => {
    if (!isClient || !initialLoadComplete) return [];
    return todos.filter(todo => {
      const isInYellowBorderUndo = undoableActions.has(todo.id) && undoableActions.get(todo.id)?.actionType === 'delete';
      const isPendingFinalDeletion = !!todo.pendingFinalDeletionTimestamp; 

      let isVisible = false;
      switch (filter) {
        case 'all':
          isVisible = !todo.isDeleted || isInYellowBorderUndo;
          break;
        case 'active':
          isVisible = !todo.completed && (!todo.isDeleted || isInYellowBorderUndo);
          break;
        case 'completed':
          isVisible = todo.completed && (!todo.isDeleted || isInYellowBorderUndo);
          break;
        case 'deleted':
          isVisible = todo.isDeleted && !isInYellowBorderUndo;
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
    return todos.filter(todo => 
        todo.isDeleted && 
        !undoableActions.has(todo.id) && 
        !todo.pendingFinalDeletionTimestamp
    ).length;
  }, [todos, undoableActions]);
  
  const activeTasksCount = useMemo(() => {
    return todos.filter(t => 
        !t.completed && 
        (!t.isDeleted || (undoableActions.has(t.id) && undoableActions.get(t.id)?.actionType === 'delete')) &&
        !t.pendingFinalDeletionTimestamp 
    ).length;
  }, [todos, undoableActions]);
  
  const softDeletedAndStage2Count = useMemo(() => {
    return todos.filter(t => 
        t.isDeleted && 
        !(undoableActions.has(t.id) && undoableActions.get(t.id)?.actionType === 'delete')
    ).length;
  }, [todos, undoableActions]);

  const isActionInProgress = undoableActions.size > 0 || (!!emptyingTrashBatch && !emptyingTrashBatch.isRestored) ;

  const filterOptions: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'deleted', label: 'Deleted' },
  ];

  const getEmptyStateMessage = () => {
    if (!isClient || !initialLoadComplete) return null;
    if (filteredAndSearchedTodos.length > 0) return null;
    if (todos.length === 0) return { title: "No tasks yet!", message: "Get started by adding a new task above." };
    if (searchQuery.trim() !== '') return { title: "No tasks found", message: `Your search for "${searchQuery}" did not match any tasks.` };
    if (filter === 'active') return { title: "No active tasks!", message: "All your tasks are completed or deleted." };
    if (filter === 'completed') return { title: "No completed tasks!", message: "Mark some tasks as completed to see them here." };
    if (filter === 'deleted') {
      if (emptyingTrashBatch && !emptyingTrashBatch.allIndividualTimersEndedForBatch) return { title: "Emptying Trash...", message: "Tasks are in their 1-minute final countdown." };
      if (showGlobalRestoreButton) return { title: "Batch Deleted!", message: `You have ${globalRestoreTimeRemainingString} to restore the batch.` };
      if (emptyingTrashBatch && emptyingTrashBatch.allIndividualTimersEndedForBatch && !emptyingTrashBatch.isRestored && emptyingTrashBatch.batchCompletionTime && (currentTime - emptyingTrashBatch.batchCompletionTime >= STAGE_4_GLOBAL_RESTORE_WINDOW) ) return { title: "Global Restore Window Expired", message: "The chance to restore the batch has passed." };
      if (emptyingTrashBatch && emptyingTrashBatch.allIndividualTimersEndedForBatch && !emptyingTrashBatch.isRestored) return { title: "Global Restore Window Active", message: "The global restore window is currently active or just ended." };
      if (itemsEligibleForEmptyTrash > 0) return { title: "Trash contains items!", message: "Use 'Empty Trash' to start permanent deletion process." };
      return { title: "Trash is empty!", message: "You haven't deleted any tasks yet, or no tasks match the current search in trash." };
    }
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
            <TodoAddForm ref={todoAddFormRef} onAddTodo={addTodo} disabled={!initialLoadComplete} />

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
                  onRestorePendingDeletion={undoIndividualPendingFinalDeletion} 
                  currentTime={currentTime}
                  emptyingTrashBatch={emptyingTrashBatch}
                  currentFilter={filter} 
                />
              )
            )}
             {isClient && initialLoadComplete && filter === 'deleted' && filteredAndSearchedTodos.length > 0 && !emptyingTrashBatch && itemsEligibleForEmptyTrash > 0 && (
              <p className="text-center mt-4 text-xs sm:text-sm text-slate-400">
                These tasks are in trash. Use "Empty Trash" to start final deletion process.
              </p>
            )}
            {isClient && initialLoadComplete && filter === 'deleted' && emptyingTrashBatch && !emptyingTrashBatch.allIndividualTimersEndedForBatch && (
                 <p className="text-center mt-4 text-xs sm:text-sm text-orange-400">
                    Emptying trash... Tasks have a 1-minute countdown for individual undo.
                 </p>
            )}
            {isClient && initialLoadComplete && filter === 'deleted' && showGlobalRestoreButton && (
                 <p className="text-center mt-4 text-xs sm:text-sm text-green-400">
                    Batch deleted! You have {globalRestoreTimeRemainingString} to restore all items.
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
                onInitiateEmptyTrash={initiateEmptyTrashProcess}
                onRestoreAllPendingDeletion={restoreBatchFromEmptyTrash}
                globalRestoreTimeRemainingString={globalRestoreTimeRemainingString}
                showGlobalRestoreButton={showGlobalRestoreButton}
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
