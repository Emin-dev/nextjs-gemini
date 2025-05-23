'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Todo, UndoableActionDetails, FilterValue, EmptyingTrashBatchDetails } from '../types';
import { LOCAL_STORAGE_KEY, UNDO_TIMEOUT, FILTER_SWITCH_DELAY } from '../lib/constants';

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
  currentTime: number; // Added currentTime for timed effects
}

export function useTodoManagement({
  isClient,
  initialLoadComplete,
  showStatusMessage,
  focusInput,
  resetInactivityTimer,
  emptyingTrashBatchRef, // This ref is for a different purpose (emptying trash batch)
  currentFilter,
  setFilter,
  setSearchQuery,
  currentTime,
}: UseTodoManagementProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [undoableActions, setUndoableActions] = useState<Map<number, UndoableActionDetails>>(new Map());
  const undoTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const delayedFilterSwitchTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

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
            batchId: todo.batchId || null 
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

  const clearSpecificUndoAction = useCallback((id: number, showConfirmation: boolean = false, confirmationMessage?: string, autoSwitchToDeletedFilter?: boolean /* This param might be less relevant now */) => {
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

    // If an undo action is cleared, also clear any pending filter switch for that item
    const delayedSwitchTimer = delayedFilterSwitchTimersRef.current.get(id);
    if (delayedSwitchTimer) {
        clearTimeout(delayedSwitchTimer);
        delayedFilterSwitchTimersRef.current.delete(id);
    }
    
    // If an item was markedForDeletionAt and its undo is confirmed (not undone by user),
    // it should be moved to isDeleted: true directly
    if (actionDetailsToReturn?.actionType === 'delete' && showConfirmation) {
        setTodos(prevTodos => prevTodos.map(t => t.id === id ? { ...t, isDeleted: true, markedForDeletionAt: null } : t));
        if (currentFilter !== 'deleted') {
            setFilter('deleted'); // Switch to deleted filter if the delete was confirmed
            setSearchQuery('');
        }
    }

    return actionDetailsToReturn;
  }, [showStatusMessage, currentFilter, setFilter, setSearchQuery]);


  const softDeleteTodo = useCallback((id: number) => {
    const todoToModify = todos.find(t => t.id === id);
    if (!todoToModify || todoToModify.markedForDeletionAt || todoToModify.pendingFinalDeletionTimestamp) {
        // Already in some state of deletion or pending deletion
        if (todoToModify?.pendingFinalDeletionTimestamp) {
             showStatusMessage("Task is pending final deletion. Use 'Undo' from the task options to cancel this.");
        }
        return;
    }

    clearSpecificUndoAction(id); // Clear any existing undo action for this item if any

    const originalTodoForUndo: Todo = { ...todoToModify }; 
    const markedAt = Date.now();

    setTodos(prev => prev.map(t => t.id === id ? { ...t, markedForDeletionAt: markedAt, isDeleted: false } : t));
    
    setUndoableActions(prev => {
      const newState = new Map(prev);
      newState.set(id, { id, originalTodo: originalTodoForUndo, actionType: 'delete', timestamp: markedAt });
      return newState;
    });

    // Standard 1-min undo timer for this soft-delete action
    const undoTimer = setTimeout(() => {
      // If this timer fires, it means the user did NOT click undo within 1 minute.
      // The 20s FILTER_SWITCH_DELAY effect will handle moving it to the deleted filter if not already handled.
      // We just confirm the action and remove it from undoableActions.
      clearSpecificUndoAction(id, true, `Deletion of "${originalTodoForUndo.text.substring(0, 20)}..." confirmed.`); 
      // No direct filter switch here; that's handled by the 20s delay effect or if undo is confirmed early.
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(id, undoTimer);

    showStatusMessage(`Task "${originalTodoForUndo.text.substring(0, 20)}..." marked for deletion. Stays in current filter for ${FILTER_SWITCH_DELAY/1000}s. You have ${UNDO_TIMEOUT/1000}s to undo.`);
    focusInput();
    resetInactivityTimer();
  }, [todos, clearSpecificUndoAction, showStatusMessage, focusInput, resetInactivityTimer]);

  // Effect to handle the 20-second delay before moving to 'deleted' filter
  useEffect(() => {
    todos.forEach(todo => {
      if (todo.markedForDeletionAt && !undoableActions.has(todo.id) && !delayedFilterSwitchTimersRef.current.has(todo.id)) {
        // Check if it's past the 20s delay AND its 1-min undo action is no longer present (meaning it was confirmed or expired)
        const timeSinceMarked = currentTime - todo.markedForDeletionAt;
        if (timeSinceMarked >= FILTER_SWITCH_DELAY) {
          setTodos(prevTodos => prevTodos.map(t => t.id === todo.id ? { ...t, isDeleted: true, markedForDeletionAt: null } : t));
          if (currentFilter !== 'deleted') {
            //showStatusMessage(`Task "${todo.text.substring(0,20)}..." moved to deleted items.`);
            //setFilter('deleted'); // Optional: auto-switch. For now, let the user find it.
          }
        } else {
          // Set a timer for the remaining duration
          const timerId = setTimeout(() => {
            setTodos(prevTodos => prevTodos.map(t => t.id === todo.id ? { ...t, isDeleted: true, markedForDeletionAt: null } : t));
            delayedFilterSwitchTimersRef.current.delete(todo.id);
            if (currentFilter !== 'deleted') {
                //showStatusMessage(`Task "${todo.text.substring(0,20)}..." moved to deleted items.`);
                //setFilter('deleted');
            }
          }, FILTER_SWITCH_DELAY - timeSinceMarked);
          delayedFilterSwitchTimersRef.current.set(todo.id, timerId);
        }
      }
    });

    // Cleanup timers
    return () => {
      delayedFilterSwitchTimersRef.current.forEach(clearTimeout);
    };
  }, [todos, currentTime, undoableActions, currentFilter, setFilter, showStatusMessage]);

  const handleUndo = useCallback((idToUndo: number) => {
    const actionDetails = undoableActions.get(idToUndo);
    if (!actionDetails) return;

    // If undoing a 'delete' action, clear markedForDeletionAt
    const updatedOriginalTodo = actionDetails.actionType === 'delete' ? 
        { ...actionDetails.originalTodo, markedForDeletionAt: null, isDeleted: false } : 
        actionDetails.originalTodo;

    setTodos(prev => prev.map(todo => todo.id === idToUndo ? { ...updatedOriginalTodo } : todo));
    showStatusMessage(`Task "${actionDetails.originalTodo.text.substring(0, 20)}..." ${actionDetails.actionType === 'delete' ? 'restoration' : 'deletion'} undone.`);
    clearSpecificUndoAction(idToUndo, false); 
    focusInput();
    resetInactivityTimer();
  }, [undoableActions, clearSpecificUndoAction, showStatusMessage, focusInput, resetInactivityTimer]);

  // addTodo, toggleTodo, updateTodoText remain largely the same but need to check for markedForDeletionAt
  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = { id: Date.now(), text, completed: false, isDeleted: false, markedForDeletionAt: null, pendingFinalDeletionTimestamp: null, batchId: null };
    setTodos(prev => [...prev, newTodo]);
    if (currentFilter !== 'all') setFilter('all');
    setSearchQuery('');
    showStatusMessage(`Task "${text.substring(0, 20)}..." added.`);
    focusInput();
    resetInactivityTimer();
  }, [currentFilter, setFilter, setSearchQuery, showStatusMessage, focusInput, resetInactivityTimer]);

  const toggleTodo = useCallback((id: number) => {
    const todo = todos.find(t => t.id === id);
    if (todo?.markedForDeletionAt || todo?.pendingFinalDeletionTimestamp || emptyingTrashBatchRef.current?.taskIds.includes(id)) {
      showStatusMessage("Cannot modify task during deletion process.");
      return;
    }
    clearSpecificUndoAction(id); // Clear any pending undo actions if toggling
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
    if (todo?.markedForDeletionAt || todo?.pendingFinalDeletionTimestamp || emptyingTrashBatchRef.current?.taskIds.includes(id)) {
      showStatusMessage("Cannot modify task during deletion process.");
      return;
    }
    clearSpecificUndoAction(id); // Clear any pending undo actions if editing
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
    delayedFilterSwitchTimersRef // Expose for cleanup in Home component
  };
}
