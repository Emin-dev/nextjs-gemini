'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TodoList } from './components/todo/TodoList';
import { TodoAddForm, type TodoAddFormHandle } from './components/todo/TodoAddForm';
import type { FilterValue } from './types';
import { TodoListSkeleton } from './components/todo/TodoListSkeleton';
import { VisibleStatusMessage } from './components/ui/StatusMessage';
import { TodoControls } from './components/layout/TodoControls';
import { TodoFooter } from './components/layout/TodoFooter';
import { EmptyTodoListState } from './components/layout/EmptyTodoListState';

import {
  INACTIVITY_TIMEOUT,
  STATUS_MESSAGE_DURATION,
  UNDO_TIMEOUT, 
  STAGE_4_GLOBAL_RESTORE_WINDOW,
  CURRENT_TIME_UPDATE_INTERVAL,
} from './lib/constants';
import { useTodoManagement } from './hooks/useTodoManagement';
import { usePagePersistence } from './hooks/usePagePersistence';
import { getEmptyStateMessage } from './utils/emptyStateMessages';

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
    undoableActions,
    addTodo,
    toggleTodo,
    updateTodoText,
    softDeleteTodo, 
    restoreItem, // Get new function from hook
    handleUndo,
    emptyingTrashBatch, 
    initiateEmptyTrashProcess, 
    undoIndividualPendingFinalDeletion,
    restoreBatchFromEmptyTrash, 
  } = useTodoManagement({
    isClient,
    initialLoadComplete,
    showStatusMessage,
    focusInput,
    resetInactivityTimer,
    currentFilter: filter,
    setFilter,
    setSearchQuery,
    currentTime,
  });

  usePagePersistence({
    isClient,
    initialLoadComplete,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    showStatusMessage,
  });

  useEffect(() => {
    setIsClient(true);
    setInitialLoadComplete(true);

    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('click', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    resetInactivityTimer(); 
    const timeUpdateInterval = setInterval(() => setCurrentTime(Date.now()), CURRENT_TIME_UPDATE_INTERVAL);
    
    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('click', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (statusMessageTimerRef.current) clearTimeout(statusMessageTimerRef.current);
      clearInterval(timeUpdateInterval);
    };
  }, [resetInactivityTimer]); 

  const showGlobalRestoreButton = useMemo(() => {
    if (filter !== 'deleted') return false; 
    if (!emptyingTrashBatch?.allIndividualTimersEndedForBatch || emptyingTrashBatch.isRestored) {
      return false;
    }
    if (emptyingTrashBatch.batchCompletionTime) {
      const timeSinceCompletion = currentTime - emptyingTrashBatch.batchCompletionTime;
      return timeSinceCompletion < STAGE_4_GLOBAL_RESTORE_WINDOW;
    }
    return false;
  }, [emptyingTrashBatch, currentTime, filter]);

  const globalRestoreTimeRemainingString = useMemo(() => {
    if (!showGlobalRestoreButton || !emptyingTrashBatch?.batchCompletionTime) return "";
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

      let matchesFilter: boolean;
      switch (filter) {
        case 'all':
          matchesFilter = !todo.isDeleted || isInYellowBorderUndo || (todo.isDeleted && isPendingFinalDeletion);
          break;
        case 'active':
          matchesFilter = !todo.completed && (!todo.isDeleted || isInYellowBorderUndo || (todo.isDeleted && isPendingFinalDeletion));
          break;
        case 'completed':
          matchesFilter = todo.completed && (!todo.isDeleted || isInYellowBorderUndo || (todo.isDeleted && isPendingFinalDeletion));
          break;
        case 'deleted':
          matchesFilter = todo.isDeleted && !isInYellowBorderUndo;
          break;
        default:
          matchesFilter = true; 
      }

      if (!matchesFilter) return false;

      if (searchQuery.trim() !== '') {
        return todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [todos, filter, searchQuery, isClient, initialLoadComplete, undoableActions]);

  const itemsEligibleForClearAll = useMemo(() => {
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

  const isActionInProgress = useMemo(() => {
    return undoableActions.size > 0 || 
           (!!emptyingTrashBatch && 
            !emptyingTrashBatch.allIndividualTimersEndedForBatch && 
            !emptyingTrashBatch.isRestored);
  }, [undoableActions, emptyingTrashBatch]);

  const filterOptions: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'deleted', label: 'Deleted' },
  ];

  const emptyState = getEmptyStateMessage({
    isClient,
    initialLoadComplete,
    filteredAndSearchedTodosCount: filteredAndSearchedTodos.length,
    totalTodosCount: todos.length,
    searchQuery,
    filter,
    emptyingTrashBatch,
    showGlobalRestoreButton,
    globalRestoreTimeRemainingString,
    currentTime,
    itemsEligibleForEmptyTrash: itemsEligibleForClearAll, 
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:py-12 lg:py-16 bg-gradient-to-br from-slate-900 to-slate-700 text-white">
      <div className="w-full max-w-xl">

        <Card className="bg-slate-800 shadow-xl border-slate-700">
          <CardHeader className="p-4 sm:p-6"> 
            <div className="flex flex-col items-start mb-4 gap-3"> 
              <CardTitle className="text-2xl md:text-3xl text-cyan-400" id="tasks-heading">
                Your Tasks
              </CardTitle>
              <div className="w-full">
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
            </div>
          </CardHeader>

          <CardContent className="pt-0 sm:px-6 sm:pb-6">
            <TodoAddForm ref={todoAddFormRef} onAddTodo={addTodo} disabled={!initialLoadComplete} />

            {!isClient || !initialLoadComplete ? (
              <TodoListSkeleton />
            ) : (
              emptyState ? (
                <EmptyTodoListState title={emptyState.title} message={emptyState.message} />
              ) : (
                <TodoList
                  todos={filteredAndSearchedTodos}
                  onToggle={toggleTodo}
                  onRemove={softDeleteTodo}
                  onUpdateText={updateTodoText}
                  onRestoreItem={restoreItem} // Pass restoreItem to TodoList
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
             {isClient && initialLoadComplete && filter === 'deleted' && filteredAndSearchedTodos.length > 0 && !emptyingTrashBatch && itemsEligibleForClearAll > 0 && (
              <p className="text-center mt-4 text-xs sm:text-sm text-slate-400">
                These are your deleted tasks. Use &quot;Clear Deleted&quot; to start the permanent deletion process.
              </p>
            )}
            {isClient && initialLoadComplete && filter === 'deleted' && emptyingTrashBatch && !emptyingTrashBatch.allIndividualTimersEndedForBatch && (
                 <p className="text-center mt-4 text-xs sm:text-sm text-orange-400">
                    Clearing Deleted Tasks... Tasks have a 1-minute countdown for individual undo.
                 </p>
            )}
            {isClient && initialLoadComplete && filter === 'deleted' && showGlobalRestoreButton && (
                 <p className="text-center mt-4 text-xs sm:text-sm text-green-400">
                    Batch Cleared! You have {globalRestoreTimeRemainingString} to restore all items.
                 </p>
            )}
          </CardContent>

          {isClient && initialLoadComplete && (
            <CardFooter className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
              <TodoFooter 
                activeTasksCount={activeTasksCount}
                softDeletedAndStage2Count={softDeletedAndStage2Count} 
                filter={filter}
                emptyingTrashBatch={emptyingTrashBatch} 
                itemsEligibleForEmptyTrash={itemsEligibleForClearAll} 
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

        <footer className="text-center mt-8 md:mt-12 text-xs sm:text-sm text-slate-400" role="contentinfo">
          <p>Powered by BakuEdu</p> 
        </footer>
      </div>
    </main>
  );
}
