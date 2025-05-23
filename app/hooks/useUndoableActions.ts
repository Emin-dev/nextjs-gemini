'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Todo, UndoableActionDetails, FilterValue } from '../types';
import { UNDO_TIMEOUT, UNDOABLE_ACTIONS_STORAGE_KEY } from '../lib/constants';
import useLocalStorage from './useLocalStorage';

interface UseUndoableActionsProps {
  showStatusMessage: (message: string) => void;
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  currentFilter: FilterValue;
  setFilter: (filter: FilterValue) => void;
  setSearchQuery: (query: string) => void;
  focusInput: () => void;
  resetInactivityTimer: () => void;
}

export function useUndoableActions({
  showStatusMessage,
  setTodos,
  currentFilter,
  setFilter,
  setSearchQuery,
  focusInput,
  resetInactivityTimer,
}: UseUndoableActionsProps) {
  const [undoableActions, setUndoableActions, removeUndoableActionsStorage] = useLocalStorage<Map<number, UndoableActionDetails>>(
    UNDOABLE_ACTIONS_STORAGE_KEY,
    new Map()
  );
  const undoTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

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
  }, [setUndoableActions, showStatusMessage]);

 useEffect(() => {
    const loadedActionsMap = new Map<number, UndoableActionDetails>(undoableActions); 
    loadedActionsMap.forEach((action, id) => {
      const elapsedTime = Date.now() - action.timestamp;
      if (elapsedTime < UNDO_TIMEOUT) {
        const remainingTime = UNDO_TIMEOUT - elapsedTime;
        if (undoTimeoutRefs.current.has(id)) {
          clearTimeout(undoTimeoutRefs.current.get(id));
        }
        const undoTimer = setTimeout(() => {
          clearSpecificUndoAction(id, true, `Deletion of "${action.originalTodo.text.substring(0, 20)}..." auto-confirmed.`);
        }, remainingTime);
        undoTimeoutRefs.current.set(id, undoTimer);
      } else {
        loadedActionsMap.delete(id);
      }
    });
    setUndoableActions(loadedActionsMap);

    return () => {
      undoTimeoutRefs.current.forEach(timer => clearTimeout(timer));
    };
  }, [undoableActions, clearSpecificUndoAction, setUndoableActions]); 

  const addUndoableAction = useCallback((todoToModify: Todo, actionType: 'delete' | 'restore' = 'delete') => {
    clearSpecificUndoAction(todoToModify.id);
    const originalTodoForUndo: Todo = { ...todoToModify }; 
    const markedAt = Date.now();

    setUndoableActions(prev => {
      const newState = new Map(prev);
      newState.set(todoToModify.id, { id: todoToModify.id, originalTodo: originalTodoForUndo, actionType, timestamp: markedAt });
      return newState;
    });

    const undoTimer = setTimeout(() => {
      clearSpecificUndoAction(todoToModify.id, true, `Deletion of "${originalTodoForUndo.text.substring(0, 20)}..." auto-confirmed.`); 
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(todoToModify.id, undoTimer);
    
    showStatusMessage(`Task "${originalTodoForUndo.text.substring(0, 20)}..." marked for deletion. Undo timer started.`);
    focusInput();
    resetInactivityTimer();
  }, [clearSpecificUndoAction, setUndoableActions, showStatusMessage, focusInput, resetInactivityTimer]);

  const performUndo = useCallback((idToUndo: number) => {
    const actionDetails = undoableActions.get(idToUndo);
    if (!actionDetails) return;

    const updatedOriginalTodo = { 
        ...actionDetails.originalTodo, 
        markedForDeletionAt: null, 
        isDeleted: false,
        pendingFinalDeletionTimestamp: null,
        stage2BatchId: null,
     };
    setTodos(prev => prev.map(todo => todo.id === idToUndo ? { ...updatedOriginalTodo } : todo));
    showStatusMessage(`Task "${actionDetails.originalTodo.text.substring(0, 20)}..." ${actionDetails.actionType === 'delete' ? 'restored' : 'deletion undone'}.`);
    clearSpecificUndoAction(idToUndo, false);

    if (actionDetails.actionType === 'delete' && currentFilter === 'deleted') {
      setFilter('all');
      setSearchQuery(''); 
    }

    focusInput();
    resetInactivityTimer();
  }, [undoableActions, clearSpecificUndoAction, showStatusMessage, focusInput, resetInactivityTimer, currentFilter, setFilter, setSearchQuery, setTodos]);

  return {
    undoableActions,
    addUndoableAction,
    performUndo,
    clearSpecificUndoAction,
    removeUndoableActionsStorage
  };
}
