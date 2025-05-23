'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Todo, UndoableActionDetails, FilterValue, EmptyingTrashBatchDetails } from '../types';
import {
  LOCAL_STORAGE_KEY,
  UNDO_TIMEOUT,
  FILTER_SWITCH_DELAY,
  STAGE_2_GRACE_PERIOD_DURATION,
  AUTO_FINAL_DELETE_INTERVAL,
  // STAGE_4_GLOBAL_RESTORE_WINDOW, // This will be used in app/page.tsx for UI logic
} from '../lib/constants';

interface UseTodoManagementProps {
  isClient: boolean;
  initialLoadComplete: boolean;
  showStatusMessage: (message: string) => void;
  focusInput: () => void;
  resetInactivityTimer: () => void;
  emptyingTrashBatchRef: React.RefObject<EmptyingTrashBatchDetails | null>;
  currentFilter: FilterValue;
  setFilter: (filter: FilterValue) => void;
  setSearchQuery: (query: string) => void;
  currentTime: number;
  // Callbacks to manage EmptyingTrashBatchDetails state in app/page.tsx
  setNewEmptyingTrashBatch: (batchDetails: EmptyingTrashBatchDetails | null) => void;
  updateExistingEmptyingTrashBatch: (
    batchId: string,
    updates: Partial<Omit<EmptyingTrashBatchDetails, 'batchId' | 'taskIdsInBatch' | 'tasksSnapshot' | 'batchInitiationTime'>>
  ) => void;
}

export function useTodoManagement({
  isClient,
  initialLoadComplete,
  showStatusMessage,
  focusInput,
  resetInactivityTimer,
  emptyingTrashBatchRef,
  currentFilter,
  setFilter,
  setSearchQuery,
  currentTime,
  setNewEmptyingTrashBatch,
  updateExistingEmptyingTrashBatch,
}: UseTodoManagementProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [undoableActions, setUndoableActions] = useState<Map<number, UndoableActionDetails>>(new Map());
  const undoTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const autoFinalDeleteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isClient) {
      try {
        const storedTodos = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedTodos) {
          setTodos(JSON.parse(storedTodos).map((todo: any) => ({ 
            ...todo, 
            isDeleted: todo.isDeleted || false, 
            markedForDeletionAt: todo.markedForDeletionAt || null,
            pendingFinalDeletionTimestamp: todo.pendingFinalDeletionTimestamp || null, 
            stage2BatchId: todo.stage2BatchId || null, // Ensure this is loaded
          })));
        }
      } catch (error) {
        console.error("Error parsing todos from localStorage:", error);
        showStatusMessage("Error loading tasks from storage.");
      }
    }
  }, [isClient, showStatusMessage]);

  useEffect(() => {
    if (isClient && initialLoadComplete) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
    }
  }, [todos, isClient, initialLoadComplete]);

  const clearSpecificUndoAction = useCallback((id: number, showConfirmation: boolean = false, confirmationMessage?: string) => {
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
    return actionDetailsToReturn;
  }, [showStatusMessage]);

  const softDeleteTodo = useCallback((id: number) => {
    const todoToModify = todos.find(t => t.id === id);
    if (todoToModify?.pendingFinalDeletionTimestamp) {
      showStatusMessage("Task is pending final deletion. Use its 'Undo Permanent Delete' option.");
      return;
    }
    if (todoToModify?.markedForDeletionAt) {
      showStatusMessage("Task is already marked for deletion.");
      return;
    }
    if (!todoToModify) return;

    clearSpecificUndoAction(id);
    const originalTodoForUndo: Todo = { ...todoToModify }; 
    const markedAt = Date.now();
    setTodos(prev => prev.map(t => t.id === id ? { ...t, markedForDeletionAt: markedAt, isDeleted: false, stage2BatchId: null, pendingFinalDeletionTimestamp: null } : t));
    setUndoableActions(prev => {
      const newState = new Map(prev);
      newState.set(id, { id, originalTodo: originalTodoForUndo, actionType: 'delete', timestamp: markedAt });
      return newState;
    });
    const undoTimer = setTimeout(() => {
      clearSpecificUndoAction(id, true, `Deletion of "${originalTodoForUndo.text.substring(0, 20)}..." auto-confirmed.`); 
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(id, undoTimer);
    showStatusMessage(`Task "${originalTodoForUndo.text.substring(0, 20)}..." marked for deletion. Undo timer started.`);
    focusInput();
    resetInactivityTimer();
  }, [todos, clearSpecificUndoAction, showStatusMessage, focusInput, resetInactivityTimer, UNDO_TIMEOUT]);

  useEffect(() => {
    // ... (FILTER_SWITCH_DELAY effect - remains largely the same)
    let itemsToMove: Todo[] = [];
    setTodos(currentTodos => {
        const updatedTodos = currentTodos.map(todo => {
            if (todo.markedForDeletionAt && !todo.isDeleted) {
                const timeSinceMarked = currentTime - todo.markedForDeletionAt;
                if (timeSinceMarked >= FILTER_SWITCH_DELAY) {
                    itemsToMove.push(todo);
                    return { ...todo, isDeleted: true, markedForDeletionAt: null };
                }
            }
            return todo;
        });
        if (itemsToMove.length > 0) return updatedTodos;
        return currentTodos;
    });
    if (itemsToMove.length > 0 && currentFilter !== 'deleted') {
        showStatusMessage(`"${itemsToMove[0].text.substring(0,20)}..." ${itemsToMove.length > 1 ? `and ${itemsToMove.length-1} others ` : ''}moved to Deleted items.`);
        setFilter('deleted');
        setSearchQuery('');
    }
  }, [currentTime, currentFilter, setFilter, setSearchQuery, showStatusMessage, todos, FILTER_SWITCH_DELAY]);

  const handleUndo = useCallback((idToUndo: number) => {
    // ... (handleUndo - remains largely the same)
    const actionDetails = undoableActions.get(idToUndo);
    if (!actionDetails) return;
    const updatedOriginalTodo = { ...actionDetails.originalTodo, markedForDeletionAt: null, isDeleted: false };
    setTodos(prev => prev.map(todo => todo.id === idToUndo ? { ...updatedOriginalTodo } : todo));
    showStatusMessage(`Task "${actionDetails.originalTodo.text.substring(0, 20)}..." ${actionDetails.actionType === 'delete' ? 'restored' : 'deletion undone'}.`);
    clearSpecificUndoAction(idToUndo, false);
    focusInput();
    resetInactivityTimer();
  }, [undoableActions, clearSpecificUndoAction, showStatusMessage, focusInput, resetInactivityTimer]);

  const initiateEmptyTrashProcess = useCallback(() => {
    if (emptyingTrashBatchRef.current && !emptyingTrashBatchRef.current.allIndividualTimersEndedForBatch) {
      showStatusMessage("An existing empty trash process is still finalizing individual task timers.");
      return;
    }
    if (emptyingTrashBatchRef.current && emptyingTrashBatchRef.current.allIndividualTimersEndedForBatch && !emptyingTrashBatchRef.current.isRestored) {
      showStatusMessage("An empty trash batch is awaiting global restore or timeout. Cannot start a new one yet.");
      return;
    }

    const tasksToEmpty = todos.filter(todo => todo.isDeleted && !todo.markedForDeletionAt && !todo.pendingFinalDeletionTimestamp);
    if (tasksToEmpty.length === 0) {
      showStatusMessage("No tasks in trash to empty.");
      return;
    }

    const newBatchId = `batch-${Date.now()}`;
    const taskIdsInBatch = tasksToEmpty.map(t => t.id);
    const tasksSnapshot = JSON.parse(JSON.stringify(tasksToEmpty)); // Deep copy for snapshot
    const batchInitiationTime = Date.now();

    setTodos(prevTodos => 
      prevTodos.map(todo => 
        taskIdsInBatch.includes(todo.id) 
          ? { ...todo, pendingFinalDeletionTimestamp: batchInitiationTime + STAGE_2_GRACE_PERIOD_DURATION, stage2BatchId: newBatchId }
          : todo
      )
    );

    setNewEmptyingTrashBatch({
      batchId: newBatchId,
      taskIdsInBatch,
      tasksSnapshot,
      batchInitiationTime,
      allIndividualTimersEndedForBatch: false,
      // batchCompletionTime and isRestored will be set later
    });

    showStatusMessage(`${tasksToEmpty.length} task(s) starting 1-minute final deletion countdown.`);
    focusInput();
    resetInactivityTimer();
  }, [todos, showStatusMessage, focusInput, resetInactivityTimer, setNewEmptyingTrashBatch, emptyingTrashBatchRef]);

  const undoIndividualPendingFinalDeletion = useCallback((taskId: number) => {
    let taskText = "";
    setTodos(prevTodos => prevTodos.map(todo => {
      if (todo.id === taskId && todo.pendingFinalDeletionTimestamp && todo.stage2BatchId) {
        taskText = todo.text;
        return { ...todo, pendingFinalDeletionTimestamp: null, stage2BatchId: null };
      }
      return todo;
    }));
    if (taskText) {
      showStatusMessage(`Final deletion of "${taskText.substring(0,20)}..." undone.`);
    }
    // The AUTO_FINAL_DELETE_INTERVAL effect will handle checking if the batch is now complete.
    focusInput();
    resetInactivityTimer();
  }, [setTodos, showStatusMessage, focusInput, resetInactivityTimer]);

  // Effect for AUTO_FINAL_DELETE_INTERVAL (permanent deletion and batch completion)
  useEffect(() => {
    if (!isClient || !initialLoadComplete) return () => { if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current); };

    autoFinalDeleteIntervalRef.current = setInterval(() => {
      const now = Date.now();
      let tasksPermanentlyDeletedCount = 0;

      setTodos(prevTodos => {
        const todosAfterDeletion = prevTodos.filter(todo => {
          if (todo.pendingFinalDeletionTimestamp && now >= todo.pendingFinalDeletionTimestamp) {
            tasksPermanentlyDeletedCount++;
            return false; // Remove task
          }
          return true;
        });

        if (tasksPermanentlyDeletedCount > 0) {
          showStatusMessage(`${tasksPermanentlyDeletedCount} task(s) permanently deleted.`);
        }
        return todosAfterDeletion;
      });

      // Check current batch completion
      const currentBatch = emptyingTrashBatchRef.current;
      if (currentBatch && !currentBatch.allIndividualTimersEndedForBatch) {
        // Re-fetch todos to ensure we have the latest after potential deletions above
        setTodos(currentLiveTodos => {
            const stillPendingInBatch = currentLiveTodos.filter(todo => 
                todo.stage2BatchId === currentBatch.batchId && 
                todo.pendingFinalDeletionTimestamp && 
                now < todo.pendingFinalDeletionTimestamp
            ).length;

            if (stillPendingInBatch === 0) {
                // All tasks in this batch have either been permanently deleted or individually undone.
                // Verify against original task IDs in batch to be sure none were missed if individually undone.
                let allProcessed = true;
                for (const originalTaskId of currentBatch.taskIdsInBatch) {
                    const task = currentLiveTodos.find(t => t.id === originalTaskId);
                    if (task && task.stage2BatchId === currentBatch.batchId && task.pendingFinalDeletionTimestamp) {
                        // This task from the original batch is still somehow pending, batch not complete
                        allProcessed = false;
                        break;
                    }
                }

                if (allProcessed) {
                    updateExistingEmptyingTrashBatch(currentBatch.batchId, {
                        allIndividualTimersEndedForBatch: true,
                        batchCompletionTime: now,
                    });
                    showStatusMessage(`Batch ${currentBatch.batchId.substring(6,10)} processing complete. Global restore window active.`);
                }
            }
            return currentLiveTodos; // No change to todos from this part of the logic
        });
      }
    }, AUTO_FINAL_DELETE_INTERVAL);

    return () => { if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current); };
  }, [isClient, initialLoadComplete, setTodos, showStatusMessage, emptyingTrashBatchRef, updateExistingEmptyingTrashBatch, currentTime]);

  const restoreBatchFromEmptyTrash = useCallback(() => {
    const batchToRestore = emptyingTrashBatchRef.current;
    if (!batchToRestore || !batchToRestore.allIndividualTimersEndedForBatch || batchToRestore.isRestored) {
      showStatusMessage("No batch eligible for restoration or already restored.");
      return;
    }
    
    // Note: STAGE_4_GLOBAL_RESTORE_WINDOW logic will be handled in app/page.tsx for UI button visibility
    // This function just performs the restoration if called.

    const restoredTasks = batchToRestore.tasksSnapshot.map(snapTodo => ({
      ...snapTodo,
      isDeleted: true, // Should reappear in deleted filter
      markedForDeletionAt: null,
      pendingFinalDeletionTimestamp: null,
      stage2BatchId: null,
    }));

    setTodos(prevTodos => {
      const taskIdsAlreadyPresent = new Set(prevTodos.map(t => t.id));
      const newTasksToAdd = restoredTasks.filter(rt => !taskIdsAlreadyPresent.has(rt.id));
      return [...prevTodos, ...newTasksToAdd];
    });

    updateExistingEmptyingTrashBatch(batchToRestore.batchId, { isRestored: true });
    showStatusMessage(`Batch of ${restoredTasks.length} task(s) restored to 'Deleted' items.`);
    focusInput();
    resetInactivityTimer();
  }, [setTodos, showStatusMessage, emptyingTrashBatchRef, updateExistingEmptyingTrashBatch, focusInput, resetInactivityTimer]);


  // --- Other functions (addTodo, toggleTodo, updateTodoText) remain the same ---
  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = { id: Date.now(), text, completed: false, isDeleted: false, markedForDeletionAt: null, pendingFinalDeletionTimestamp: null, stage2BatchId: null };
    setTodos(prev => [...prev, newTodo]);
    if (currentFilter !== 'all') setFilter('all');
    setSearchQuery('');
    showStatusMessage(`Task "${text.substring(0, 20)}..." added.`);
    focusInput();
    resetInactivityTimer();
  }, [currentFilter, setFilter, setSearchQuery, showStatusMessage, focusInput, resetInactivityTimer]);

  const toggleTodo = useCallback((id: number) => {
    const todo = todos.find(t => t.id === id);
    if (todo?.markedForDeletionAt || todo?.pendingFinalDeletionTimestamp || emptyingTrashBatchRef.current?.taskIdsInBatch.includes(id)) {
      showStatusMessage("Cannot modify task during deletion process.");
      return;
    }
    clearSpecificUndoAction(id);
    let taskText = '';
    let newCompletedStatus = false;
    setTodos(prev => prev.map(t => {
      if (t.id === id) {
        taskText = t.text;
        newCompletedStatus = !t.completed;
        return { ...t, completed: newCompletedStatus };
      }
      return t;
    }));
    if (taskText) {
      showStatusMessage(`Task "${taskText.substring(0, 20)}..." marked as ${newCompletedStatus ? 'complete' : 'active'}.`);
    }
    resetInactivityTimer();
  }, [todos, clearSpecificUndoAction, showStatusMessage, resetInactivityTimer, emptyingTrashBatchRef]);

  const updateTodoText = useCallback((id: number, newText: string) => {
    const todo = todos.find(t => t.id === id);
    if (todo?.markedForDeletionAt || todo?.pendingFinalDeletionTimestamp || emptyingTrashBatchRef.current?.taskIdsInBatch.includes(id)) {
      showStatusMessage("Cannot modify task during deletion process.");
      return;
    }
    clearSpecificUndoAction(id);
    let oldText = '';
    setTodos(prev => prev.map(t => {
      if (t.id === id) {
        oldText = t.text;
        return { ...t, text: newText };
      }
      return t;
    }));
    if (oldText) {
      showStatusMessage(`Task "${oldText.substring(0, 20)}..." updated.`);
    }
    focusInput();
    resetInactivityTimer();
  }, [todos, clearSpecificUndoAction, showStatusMessage, focusInput, resetInactivityTimer, emptyingTrashBatchRef]);

  return {
    todos,
    setTodos, 
    undoableActions,
    addTodo,
    toggleTodo,
    updateTodoText,
    softDeleteTodo,
    handleUndo,
    undoTimeoutRefs,
    // New functions for empty trash flow
    initiateEmptyTrashProcess,
    undoIndividualPendingFinalDeletion,
    restoreBatchFromEmptyTrash,
  };
}
