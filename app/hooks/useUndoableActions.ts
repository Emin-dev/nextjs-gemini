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
  const initialUndoableActions = useMemo(() => new Map<string, UndoableActionDetails>(), []);
  const [undoableActionsData, setUndoableActions, removeUndoableActionsStorage] = useLocalStorage<Map<string, UndoableActionDetails> | Record<string, UndoableActionDetails>>(
    UNDOABLE_ACTIONS_STORAGE_KEY,
    initialUndoableActions
  );
  const undoTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearSpecificUndoAction = useCallback((id: string, showConfirmation: boolean = false, confirmationMessage?: string) => {
    const stringId = String(id); // Ensure ID is a string
    const timer = undoTimeoutRefs.current.get(stringId);
    if (timer) clearTimeout(timer);
    undoTimeoutRefs.current.delete(stringId);
    
    let actionDetailsToReturn: UndoableActionDetails | undefined;
    setUndoableActions(prev => {
      const newState = prev instanceof Map ? new Map(prev) : new Map(Object.entries(prev).map(([k, v]) => [String(k), v]));
      actionDetailsToReturn = newState.get(stringId);
      const originalTodoText = actionDetailsToReturn?.originalTodo?.text ? actionDetailsToReturn.originalTodo.text.substring(0,20) + '...' : 'task';
      if (newState.delete(stringId) && showConfirmation && actionDetailsToReturn) {
        const finalMessage = confirmationMessage || `Action on "${originalTodoText}" confirmed.`;
        showStatusMessage(finalMessage);
      }
      return newState;
    });
    return actionDetailsToReturn;
  }, [setUndoableActions, showStatusMessage]);

 useEffect(() => {
    let currentActionsAsMap: Map<string, UndoableActionDetails>;
    if (undoableActionsData instanceof Map) {
      currentActionsAsMap = new Map(undoableActionsData.entries()); // Ensure string keys
    } else if (typeof undoableActionsData === 'object' && undoableActionsData !== null) {
      currentActionsAsMap = new Map(Object.entries(undoableActionsData).map(([k, v]) => [String(k), v as UndoableActionDetails]));
    } else {
      currentActionsAsMap = new Map(); 
    }

    const updatedActionsMap = new Map<string, UndoableActionDetails>();
    let mapChanged = false;

    currentActionsAsMap.forEach((action, id) => {
      const stringId = String(id); // Ensure ID is a string
      if (!action || typeof action.timestamp !== 'number' || !action.originalTodo || typeof action.originalTodo.text !== 'string') {
        mapChanged = true;
        return;
      }

      const elapsedTime = Date.now() - action.timestamp;
      if (elapsedTime < UNDO_TIMEOUT) {
        updatedActionsMap.set(stringId, action); 
        if (undoTimeoutRefs.current.has(stringId)) {
          clearTimeout(undoTimeoutRefs.current.get(stringId)!);
        }
        const remainingTime = UNDO_TIMEOUT - elapsedTime;
        const undoTimer = setTimeout(() => {
          const todoText = action.originalTodo?.text ? `"${action.originalTodo.text.substring(0, 20)}..."` : "task";
          clearSpecificUndoAction(stringId, true, `Deletion of ${todoText} auto-confirmed.`);
        }, remainingTime);
        undoTimeoutRefs.current.set(stringId, undoTimer);
      } else {
        mapChanged = true; 
      }
    });
    
    if (mapChanged || updatedActionsMap.size !== currentActionsAsMap.size) {
        let allKeysMatch = updatedActionsMap.size === currentActionsAsMap.size;
        if (allKeysMatch) {
            for (const [key, value] of updatedActionsMap) {
                if (!currentActionsAsMap.has(key) || JSON.stringify(currentActionsAsMap.get(key)) !== JSON.stringify(value)) {
                    allKeysMatch = false;
                    break;
                }
            }
        }
        if(!allKeysMatch){
            setUndoableActions(updatedActionsMap);
        }
    }

    return () => {
      undoTimeoutRefs.current.forEach(timer => clearTimeout(timer));
    };
  }, [undoableActionsData, clearSpecificUndoAction, setUndoableActions]); 

  const addUndoableAction = useCallback((todoToModify: Todo, actionType: 'delete' | 'restore' = 'delete') => {
    const stringId = String(todoToModify.id); // Ensure ID is a string
    clearSpecificUndoAction(stringId);

    const originalTodoForUndo: Todo = { ...todoToModify, id: stringId }; 
    const markedAt = Date.now();

    setUndoableActions(prev => {
      const newState = prev instanceof Map ? new Map(prev) : new Map(Object.entries(prev).map(([k, v]) => [String(k), v]));
      newState.set(stringId, { id: stringId, originalTodo: originalTodoForUndo, actionType, timestamp: markedAt });
      return newState;
    });

    const undoTimer = setTimeout(() => {
      const todoText = originalTodoForUndo.text ? `"${originalTodoForUndo.text.substring(0, 20)}..."` : "task";
      clearSpecificUndoAction(stringId, true, `Deletion of ${todoText} auto-confirmed.`); 
    }, UNDO_TIMEOUT);
    undoTimeoutRefs.current.set(stringId, undoTimer);
    
    const todoTextForMessage = originalTodoForUndo.text ? `"${originalTodoForUndo.text.substring(0, 20)}..."` : "Task";
    showStatusMessage(`${todoTextForMessage} marked for deletion. Undo timer started.`);
    resetInactivityTimer();
  }, [clearSpecificUndoAction, setUndoableActions, showStatusMessage, resetInactivityTimer]);

  const performUndo = useCallback((idToUndo: string | number) => {
    const stringIdToUndo = String(idToUndo); // Ensure ID is a string
    let actionDetails: UndoableActionDetails | undefined;
    const currentActions = undoableActionsData instanceof Map ? undoableActionsData : new Map(Object.entries(undoableActionsData || {}).map(([k,v]) => [String(k),v]));
    actionDetails = currentActions.get(stringIdToUndo);

    if (!actionDetails || !actionDetails.originalTodo) {
        console.warn("Could not perform undo: action details or originalTodo not found for id", stringIdToUndo);
        return;
    }
    
    const originalTodoText = actionDetails.originalTodo?.text ? `"${actionDetails.originalTodo.text.substring(0, 20)}..."` : "Task";

    const updatedOriginalTodo: Todo = { 
        ...actionDetails.originalTodo, 
        id: String(actionDetails.originalTodo.id), // Ensure original todo ID is also string
        markedForDeletionAt: null, 
        isDeleted: false,
        pendingFinalDeletionTimestamp: null,
        stage2BatchId: null,
     };
    setTodos(prev => prev.map(todo => String(todo.id) === stringIdToUndo ? { ...updatedOriginalTodo } : todo));
    showStatusMessage(`${originalTodoText} ${actionDetails.actionType === 'delete' ? 'restored' : 'deletion undone'}.`);
    clearSpecificUndoAction(stringIdToUndo, false);

    if (actionDetails.actionType === 'delete' && currentFilter === 'deleted') {
      setFilter('all');
      setSearchQuery(''); 
    }

    resetInactivityTimer();
  }, [undoableActionsData, clearSpecificUndoAction, showStatusMessage, resetInactivityTimer, currentFilter, setFilter, setSearchQuery, setTodos]);

  const getUndoableActionsMap = useCallback(() => {
    if (undoableActionsData instanceof Map) {
        return new Map(Array.from(undoableActionsData.entries()).map(([k,v]) => [String(k),v]));
    } else if (typeof undoableActionsData === 'object' && undoableActionsData !== null) {
        return new Map(Object.entries(undoableActionsData).map(([k, v]) => [String(k), v as UndoableActionDetails]));
    }
    return new Map<string, UndoableActionDetails>();
  }, [undoableActionsData]);

  return {
    undoableActions: getUndoableActionsMap(),
    addUndoableAction,
    performUndo,
    clearSpecificUndoAction,
    removeUndoableActionsStorage
  };
}
