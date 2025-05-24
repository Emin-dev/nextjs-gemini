'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
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
  const initialUndoableActions = useMemo(() => new Map<number, UndoableActionDetails>(), []);
  const [undoableActionsData, setUndoableActions, removeUndoableActionsStorage] = useLocalStorage<Map<number, UndoableActionDetails> | Record<string, UndoableActionDetails>>(
    UNDOABLE_ACTIONS_STORAGE_KEY,
    initialUndoableActions
  );
  const undoTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const clearSpecificUndoAction = useCallback((id: number, showConfirmation: boolean = false, confirmationMessage?: string) => {
    const timer = undoTimeoutRefs.current.get(id);
    if (timer) clearTimeout(timer);
    undoTimeoutRefs.current.delete(id);
    
    let actionDetailsToReturn: UndoableActionDetails | undefined;
    setUndoableActions(prev => {
      const newState = prev instanceof Map ? new Map(prev) : new Map(Object.entries(prev).map(([k, v]) => [Number(k), v]));
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
    let currentActionsAsMap: Map<number, UndoableActionDetails>;
    if (undoableActionsData instanceof Map) {
      currentActionsAsMap = new Map(undoableActionsData);
    } else if (typeof undoableActionsData === 'object' && undoableActionsData !== null) {
      currentActionsAsMap = new Map(Object.entries(undoableActionsData).map(([k, v]) => [Number(k), v as UndoableActionDetails]));
    } else {
      currentActionsAsMap = new Map(); 
    }

    const updatedActionsMap = new Map<number, UndoableActionDetails>();
    let mapChanged = false;

    currentActionsAsMap.forEach((action, id) => {
      if (!action || typeof action.timestamp !== 'number' || !action.originalTodo || typeof action.originalTodo.text !== 'string') {
        mapChanged = true;
        return;
      }

      const elapsedTime = Date.now() - action.timestamp;
      if (elapsedTime < UNDO_TIMEOUT) {
        updatedActionsMap.set(id, action); 
        if (undoTimeoutRefs.current.has(id)) {
          clearTimeout(undoTimeoutRefs.current.get(id)!);
        }
        const remainingTime = UNDO_TIMEOUT - elapsedTime;
        const undoTimer = setTimeout(() => {
          const todoText = action.originalTodo?.text ? `"${action.originalTodo.text.substring(0, 20)}..."` : "task";
          clearSpecificUndoAction(id, true, `Deletion of ${todoText} auto-confirmed.`);
        }, remainingTime);
        undoTimeoutRefs.current.set(id, undoTimer);
      } else {
        mapChanged = true; 
      }
    });
    
    // Simplified update logic
    if (mapChanged || updatedActionsMap.size !== currentActionsAsMap.size) {
        setUndoableActions(updatedActionsMap);
    }

    return () => {
      undoTimeoutRefs.current.forEach(timer => clearTimeout(timer));
    };
  }, [undoableActionsData, clearSpecificUndoAction, setUndoableActions]); 

  const addUndoableAction = useCallback((todoToModify: Todo, actionType: 'delete' | 'restore' = 'delete') => {
    if (typeof todoToModify.id !== 'number') {
        console.error("todoToModify.id is not a number", todoToModify);
        showStatusMessage("Error: Could not process action due to invalid todo ID.");
        return;
    }
    clearSpecificUndoAction(todoToModify.id);

    const originalTodoForUndo: Todo = { ...todoToModify }; 
    const markedAt = Date.now();

    setUndoableActions(prev => {
      const newState = prev instanceof Map ? new Map(prev) : new Map(Object.entries(prev).map(([k, v]) => [Number(k), v]));
      newState.set(todoToModify.id, { id: todoToModify.id, originalTodo: originalTodoForUndo, actionType, timestamp: markedAt });
      return newState;
    });

    const undoTimer = setTimeout(() => {
      const todoText = originalTodoForUndo.text ? `"${originalTodoForUndo.text.substring(0, 20)}..."` : "task";
      clearSpecificUndoAction(todoToModify.id, true, `Deletion of ${todoText} auto-confirmed.`); 
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(todoToModify.id, undoTimer);
    
    const todoTextForMessage = originalTodoForUndo.text ? `"${originalTodoForUndo.text.substring(0, 20)}..."` : "Task";
    showStatusMessage(`${todoTextForMessage} marked for deletion. Undo timer started.`);
    resetInactivityTimer();
  }, [clearSpecificUndoAction, setUndoableActions, showStatusMessage, resetInactivityTimer]);

  const performUndo = useCallback((idToUndo: number) => {
    let actionDetails: UndoableActionDetails | undefined;
    const currentActions = undoableActionsData instanceof Map ? undoableActionsData : new Map(Object.entries(undoableActionsData || {}).map(([k,v]) => [Number(k),v]));
    actionDetails = currentActions.get(idToUndo);

    if (!actionDetails || !actionDetails.originalTodo) {
        console.warn("Could not perform undo: action details or originalTodo not found for id", idToUndo);
        return;
    }
    
    const originalTodoText = actionDetails.originalTodo?.text ? `"${actionDetails.originalTodo.text.substring(0, 20)}..."` : "Task";

    const updatedOriginalTodo = { 
        ...actionDetails.originalTodo, 
        markedForDeletionAt: null, 
        isDeleted: false,
        pendingFinalDeletionTimestamp: null,
        stage2BatchId: null,
     };
    setTodos(prev => prev.map(todo => todo.id === idToUndo ? { ...updatedOriginalTodo } : todo));
    showStatusMessage(`${originalTodoText} ${actionDetails.actionType === 'delete' ? 'restored' : 'deletion undone'}.`);
    clearSpecificUndoAction(idToUndo, false);

    if (actionDetails.actionType === 'delete' && currentFilter === 'deleted') {
      setFilter('all');
      setSearchQuery(''); 
    }

    resetInactivityTimer();
  }, [undoableActionsData, clearSpecificUndoAction, showStatusMessage, resetInactivityTimer, currentFilter, setFilter, setSearchQuery, setTodos]);

  const getUndoableActionsMap = useCallback(() => {
    if (undoableActionsData instanceof Map) {
        return undoableActionsData;
    } else if (typeof undoableActionsData === 'object' && undoableActionsData !== null) {
        return new Map(Object.entries(undoableActionsData).map(([k, v]) => [Number(k), v as UndoableActionDetails]));
    }
    return new Map<number, UndoableActionDetails>();
  }, [undoableActionsData]);

  return {
    undoableActions: getUndoableActionsMap(),
    addUndoableAction,
    performUndo,
    clearSpecificUndoAction,
    removeUndoableActionsStorage
  };
}
