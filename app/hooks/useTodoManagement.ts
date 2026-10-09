'use client';

import { useEffect, useCallback } from 'react';
import type { Todo, FilterValue } from '../types';
import {
  LOCAL_STORAGE_KEY,
  FILTER_SWITCH_DELAY, 
  STAGE_2_GRACE_PERIOD_DURATION,
} from '../lib/constants';
import useLocalStorage from './useLocalStorage';
import { useUndoableActions } from './useUndoableActions';
import { useEmptyingTrash } from './useEmptyingTrash';

interface UseTodoManagementProps {
  isClient: boolean;
  initialLoadComplete: boolean;
  showStatusMessage: (message: string) => void;
  focusInput: () => void;
  resetInactivityTimer: () => void;
  currentFilter: FilterValue;
  setFilter: (filter: FilterValue) => void;
  setSearchQuery: (query: string) => void;
  currentTime: number; 
}

export function useTodoManagement({
  showStatusMessage,
  focusInput,
  resetInactivityTimer,
  currentFilter,
  setFilter,
  setSearchQuery,
  currentTime,
}: UseTodoManagementProps) {
  const [todos, setTodos] = useLocalStorage<Todo[]>(LOCAL_STORAGE_KEY, []);
  
  const { 
    undoableActions, 
    addUndoableAction, 
    performUndo, 
    clearSpecificUndoAction, 
  } = useUndoableActions({
    showStatusMessage,
    setTodos,
    currentFilter,
    setFilter,
    setSearchQuery,
    focusInput,
    resetInactivityTimer,
  });

  const {
    emptyingTrashBatch,
    emptyingTrashBatchRef,
    initiateEmptyTrashProcess,
    undoIndividualPendingFinalDeletion,
    restoreBatchFromEmptyTrash,
  } = useEmptyingTrash({
    todos,
    setTodos,
    showStatusMessage,
    focusInput,
    resetInactivityTimer,
    currentTime
  });

  useEffect(() => {
    const itemsToMove: Todo[] = [];
    let wasUpdated = false;
    setTodos(currentTodos => {
        const updatedTodos = currentTodos.map(todo => {
            if (todo.markedForDeletionAt && 
                !todo.isDeleted && 
                !undoableActions.has(todo.id)) {
                
                const timeSinceMarked = currentTime - todo.markedForDeletionAt;
                if (timeSinceMarked >= FILTER_SWITCH_DELAY) {
                    itemsToMove.push(todo);
                    wasUpdated = true;
                    return { ...todo, isDeleted: true, markedForDeletionAt: null };
                }
            }
            return todo;
        });
        return wasUpdated ? updatedTodos : currentTodos;
    });

    if (itemsToMove.length > 0 && currentFilter !== 'deleted') {
        const message = itemsToMove.length === 1
            ? `"${itemsToMove[0].text.substring(0, 20)}..." moved to Deleted.`
            : `"${itemsToMove[0].text.substring(0, 20)}..." and ${itemsToMove.length - 1} other(s) moved to Deleted.`;
        showStatusMessage(message);
    }
  }, [currentTime, currentFilter, setTodos, showStatusMessage, undoableActions]);

  const restoreItem = useCallback((id: number) => {
    const todoToRestore = todos.find(t => t.id === id);
    if (!todoToRestore) return;

    setTodos(prev => prev.map(t => 
      t.id === id 
        ? { 
            ...t, 
            isDeleted: false, 
            markedForDeletionAt: null, 
            pendingFinalDeletionTimestamp: null, 
            stage2BatchId: null 
          } 
        : t
    ));
    addUndoableAction(todoToRestore, 'restore'); // Make restore action undoable
    showStatusMessage(`Task "${todoToRestore.text.substring(0,20)}..." restored.`);
    resetInactivityTimer();
    // Optionally, switch filter to 'all' or 'active' if desired after restore
    // if (currentFilter === 'deleted') {
    //   setFilter('all'); 
    // }
  }, [todos, setTodos, addUndoableAction, showStatusMessage, resetInactivityTimer]);

  const softDeleteTodo = useCallback((id: number) => {
    const todoToModify = todos.find(t => t.id === id);
    if (!todoToModify) return;

    if (todoToModify.pendingFinalDeletionTimestamp) {
      showStatusMessage("Task is already pending final deletion. Use its 'Undo Permanent Delete' option.");
      return;
    }

    if (todoToModify.markedForDeletionAt) { 
      showStatusMessage("Task is already marked for deletion (undo window active).");
      return;
    }

    if (todoToModify.isDeleted) {
      // This is for items in the 'Deleted' filter that are *not* yet in stage 2 countdown.
      // The action here is to initiate stage 2 (permanent deletion countdown).
      // This is typically triggered by the "Clear Deleted (X)" button, not by clicking a delete icon on an already deleted item.
      // For safety, we can prevent this specific path if not intended, or let it proceed if desired.
      // For now, let's assume the main way to trigger stage 2 is the "Clear Deleted" button.
      // If an individual item in 'Deleted' list has a 'delete' icon, it should perhaps be 'Clear Permanently Now'
      // For current setup, this 'delete' icon on a deleted item is effectively a 'start permanent delete process for this item'
      setTodos(prev => prev.map(t => 
        t.id === id 
          ? { 
              ...t, 
              pendingFinalDeletionTimestamp: Date.now() + STAGE_2_GRACE_PERIOD_DURATION, 
              stage2BatchId: null // Individual item, not part of a batch yet
            } 
          : t
      ));
      showStatusMessage(`Task "${todoToModify.text.substring(0,20)}..." has begun its 1-minute final deletion countdown.`);
    } else {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, markedForDeletionAt: Date.now(), isDeleted: false, stage2BatchId: null, pendingFinalDeletionTimestamp: null } : t));
      addUndoableAction(todoToModify, 'delete');
    }
    focusInput();
    resetInactivityTimer();

  }, [todos, setTodos, addUndoableAction, showStatusMessage, focusInput, resetInactivityTimer]);

  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = { id: Date.now(), text, completed: false, isDeleted: false, markedForDeletionAt: null, pendingFinalDeletionTimestamp: null, stage2BatchId: null };
    setTodos(prev => [...prev, newTodo]);
    setSearchQuery('');
    showStatusMessage(`Task "${text.substring(0, 20)}..." added.`);
    focusInput();
    resetInactivityTimer();
  }, [setTodos, setSearchQuery, showStatusMessage, focusInput, resetInactivityTimer]);

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
  }, [todos, setTodos, clearSpecificUndoAction, showStatusMessage, resetInactivityTimer, emptyingTrashBatchRef]);

  const updateTodoText = useCallback((id: number, newText: string) => {
    const todo = todos.find(t => t.id.toString() === id.toString());
    if (todo?.markedForDeletionAt || todo?.pendingFinalDeletionTimestamp || emptyingTrashBatchRef.current?.taskIdsInBatch.includes(id)) {
      showStatusMessage("Cannot modify task during deletion process.");
      return;
    }
    clearSpecificUndoAction(id);
    let oldText = '';
    setTodos(prev => prev.map(t => {
      if (t.id.toString() === id.toString()) { 
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
  }, [todos, setTodos, clearSpecificUndoAction, showStatusMessage, focusInput, resetInactivityTimer, emptyingTrashBatchRef]);

  return {
    todos,
    undoableActions,
    addTodo,
    toggleTodo,
    updateTodoText,
    softDeleteTodo,
    restoreItem, // Expose new function
    handleUndo: performUndo,
    emptyingTrashBatch, 
    emptyingTrashBatchRef, 
    initiateEmptyTrashProcess,
    undoIndividualPendingFinalDeletion,
    restoreBatchFromEmptyTrash,
  };
}
