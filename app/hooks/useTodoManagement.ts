'use client';

import { useEffect, useCallback } from 'react';
import type { Todo, FilterValue, EmptyingTrashBatchDetails } from '../types';
import {
  LOCAL_STORAGE_KEY,
  FILTER_SWITCH_DELAY,
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
  isClient,
  initialLoadComplete,
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
    let itemsToMove: Todo[] = [];
    setTodos(currentTodos => {
        const updatedTodos = currentTodos.map(todo => {
            if (todo.markedForDeletionAt && !todo.isDeleted && !undoableActions.has(todo.id)) {
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
  }, [currentTime, currentFilter, setFilter, setSearchQuery, showStatusMessage, todos, setTodos, undoableActions]);

  const softDeleteTodo = useCallback((id: number) => {
    const todoToModify = todos.find(t => t.id === id);
    if (!todoToModify) return;

    if (todoToModify.pendingFinalDeletionTimestamp) {
      showStatusMessage("Task is pending final deletion. Use its 'Undo Permanent Delete' option.");
      return;
    }
    if (undoableActions.has(id) || todoToModify.markedForDeletionAt) {
      showStatusMessage("Task is already marked for deletion.");
      return;
    }
    
    setTodos(prev => prev.map(t => t.id === id ? { ...t, markedForDeletionAt: Date.now(), isDeleted: false, stage2BatchId: null, pendingFinalDeletionTimestamp: null } : t));
    addUndoableAction(todoToModify, 'delete');
  }, [todos, setTodos, undoableActions, addUndoableAction, showStatusMessage]);

  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = { id: Date.now(), text, completed: false, isDeleted: false, markedForDeletionAt: null, pendingFinalDeletionTimestamp: null, stage2BatchId: null };
    setTodos(prev => [...prev, newTodo]);
    // if (currentFilter !== 'all') setFilter('all'); // Removed: Keep current filter
    setSearchQuery(''); // Clear search query
    showStatusMessage(`Task "${text.substring(0, 20)}..." added.`);
    focusInput();
    resetInactivityTimer();
  }, [setSearchQuery, showStatusMessage, focusInput, resetInactivityTimer, setTodos]); // Removed currentFilter and setFilter from dependencies

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
  }, [todos, setTodos, clearSpecificUndoAction, showStatusMessage, focusInput, resetInactivityTimer, emptyingTrashBatchRef]);

  return {
    todos,
    undoableActions,
    addTodo,
    toggleTodo,
    updateTodoText,
    softDeleteTodo,
    handleUndo: performUndo,
    emptyingTrashBatch, 
    emptyingTrashBatchRef, 
    initiateEmptyTrashProcess,
    undoIndividualPendingFinalDeletion,
    restoreBatchFromEmptyTrash,
  };
}
