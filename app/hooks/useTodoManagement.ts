'use client';

import { useEffect, useCallback, useMemo } from 'react';
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

const generateUniqueId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

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
  const [storedTodos, setStoredTodos] = useLocalStorage<Todo[]>(LOCAL_STORAGE_KEY, []);

  const todos = useMemo(() => {
    return storedTodos.map(todo => ({ ...todo, id: String(todo.id) }));
  }, [storedTodos]);

  const setTodos = useCallback((value: Todo[] | ((val: Todo[]) => Todo[])) => {
    const newTodos = typeof value === 'function' ? value(storedTodos) : value;
    setStoredTodos(newTodos.map(todo => ({ ...todo, id: String(todo.id) })));
  }, [storedTodos, setStoredTodos]);
  
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
    setStoredTodos(currentStored => {
        const currentTodosWithStringIds = currentStored.map(todo => ({ ...todo, id: String(todo.id) }));
        const updatedTodos = currentTodosWithStringIds.map(todo => {
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
        return currentStored; 
    });

    if (itemsToMove.length > 0 && currentFilter !== 'deleted') {
        showStatusMessage(`"${itemsToMove[0].text.substring(0,20)}..." ${itemsToMove.length > 1 ? `and ${itemsToMove.length-1} others ` : ''}moved to Deleted items.`);
        // setFilter('deleted'); // Prevent automatic filter switch
        setSearchQuery('');
    }
  }, [currentTime, currentFilter, setFilter, setSearchQuery, showStatusMessage, storedTodos, setTodos, undoableActions, setStoredTodos]);

  const softDeleteTodo = useCallback((id: string | number) => {
    const stringId = String(id);
    const todoToModify = todos.find(t => t.id === stringId); 
    if (!todoToModify) return;

    if (todoToModify.pendingFinalDeletionTimestamp) {
      showStatusMessage("Task is pending final deletion. Use its 'Undo Permanent Delete' option.");
      return;
    }
    if (undoableActions.has(stringId) || todoToModify.markedForDeletionAt) {
      showStatusMessage("Task is already marked for deletion.");
      return;
    }
    
    setTodos(prev => prev.map(t => t.id === stringId ? { ...t, markedForDeletionAt: Date.now(), isDeleted: false, stage2BatchId: null, pendingFinalDeletionTimestamp: null } : t));
    addUndoableAction(todoToModify); 
  }, [todos, setTodos, undoableActions, addUndoableAction, showStatusMessage]);

  const addTodo = useCallback(async (text: string) => {
    const GEMINI_API_KEY = "AIzaSyBKF87K98dAzdT9Fs4-v23QVzsLGn0MH98"; 
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; 

    let improvedText = text;
    try {
      console.log("Calling Gemini API (gemini-1.5-flash-latest) to improve text...");
      const response = await fetch(API_ENDPOINT, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Rewrite the following to-do item to be clearer, more actionable, and ideally under 30 characters: "${text}"`
            }]
          }]
        })
      });
      if (!response.ok) {
        console.error(`API error for improvement: ${response.status}`, await response.text());
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
        improvedText = data.candidates[0].content.parts[0].text.trim();
        showStatusMessage("Task text improved by AI (1.5 Flash).");
      } else {
        console.warn("Could not parse improved text from API response (1.5 Flash), using original.");
        showStatusMessage("AI (1.5 Flash) text improvement response unclear, using original.");
      }
    } catch (error) {
      console.error("Error calling Gemini API (1.5 Flash) for text improvement:", error);
      showStatusMessage("Failed to improve text via AI (1.5 Flash). Using original.");
    }

    const newTodo: Todo = { id: generateUniqueId(), text: improvedText, completed: false, isDeleted: false, markedForDeletionAt: null, pendingFinalDeletionTimestamp: null, stage2BatchId: null, isAIGenerated: false };
    setTodos(prev => [...prev, newTodo]);
    setSearchQuery('');
    showStatusMessage(`Task "${improvedText.substring(0, 30)}..." added.`);
    focusInput();
    resetInactivityTimer();

    let suggestedTasksTexts: string[] = [];
    try {
      console.log("Calling Gemini API (gemini-1.5-flash-latest) to suggest tasks...");
      const response = await fetch(API_ENDPOINT, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Based on the to-do item "${improvedText}", suggest two distinct follow-up tasks. Each task should be a short, actionable item, and strictly under 30 characters. Present each task on a new line, without numbering or bullet points.`
            }]
          }]
        })
      });
      if (!response.ok) {
        console.error(`API error for suggestions: ${response.status}`, await response.text());
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
        const rawSuggestions = data.candidates[0].content.parts[0].text;
        suggestedTasksTexts = rawSuggestions.split(String.fromCharCode(10)).map((s: string) => s.trim()).filter((s: string) => s.length > 0 && s.length <= 30).slice(0, 2);
        if(suggestedTasksTexts.length > 0) {
          showStatusMessage("AI (1.5 Flash) suggested follow-up tasks.");
        } else {
          showStatusMessage("AI (1.5 Flash) analyzed, but no suitable suggestions found.");
        }
      } else {
        console.warn("Could not parse suggestions from API response (1.5 Flash).");
        showStatusMessage("AI (1.5 Flash) task suggestion response unclear.");
      }
    } catch (error) {
      console.error("Error calling Gemini API (1.5 Flash) for task suggestion:", error);
      showStatusMessage("Failed to get AI (1.5 Flash) task suggestions.");
    }

    if (suggestedTasksTexts.length > 0) {
      const userAccepted = true; 
      if (userAccepted) {
        const aiTasks: Todo[] = suggestedTasksTexts.map((taskText) => ({
          id: generateUniqueId(), 
          text: taskText,
          completed: false,
          isDeleted: false,
          markedForDeletionAt: null,
          pendingFinalDeletionTimestamp: null,
          stage2BatchId: null,
          isAIGenerated: true, 
        }));
        setTodos(prev => [...prev, ...aiTasks]);
        showStatusMessage(`${aiTasks.length} AI (1.5 Flash)-suggested task(s) added.`);
      }
    }
  }, [setTodos, setSearchQuery, showStatusMessage, focusInput, resetInactivityTimer]);

  const toggleTodo = useCallback((id: string | number) => {
    const stringId = String(id);
    const todo = todos.find(t => t.id === stringId);
    const isTaskInActiveBatch = emptyingTrashBatchRef.current?.taskIdsInBatch.includes(stringId) && emptyingTrashBatchRef.current?.allIndividualTimersEndedForBatch === false;

    if (todo?.markedForDeletionAt || todo?.pendingFinalDeletionTimestamp || isTaskInActiveBatch ) {
      showStatusMessage("Cannot modify task during deletion process or if it's in an active trash emptying batch.");
      return;
    }
    clearSpecificUndoAction(stringId);
    let taskText = '';
    let newCompletedStatus = false;
    setTodos(prev => prev.map(t => {
      if (t.id === stringId) {
        taskText = t.text;
        newCompletedStatus = !t.completed;
        return { ...t, completed: newCompletedStatus };
      }
      return t;
    }));
    if (taskText) {
      showStatusMessage(`Task "${taskText.substring(0, 30)}..." marked as ${newCompletedStatus ? 'complete' : 'active'}.`);
    }
    resetInactivityTimer();
  }, [todos, setTodos, clearSpecificUndoAction, showStatusMessage, resetInactivityTimer, emptyingTrashBatchRef]);

  const updateTodoText = useCallback((id: string | number, newText: string) => {
    const stringId = String(id);
    const todo = todos.find(t => t.id === stringId);
    const isTaskInActiveBatch = emptyingTrashBatchRef.current?.taskIdsInBatch.includes(stringId) && emptyingTrashBatchRef.current?.allIndividualTimersEndedForBatch === false;

    if (todo?.markedForDeletionAt || todo?.pendingFinalDeletionTimestamp || isTaskInActiveBatch) {
      showStatusMessage("Cannot modify task during deletion process or if it's in an active trash emptying batch.");
      return;
    }
    clearSpecificUndoAction(stringId);
    let oldText = '';
    setTodos(prev => prev.map(t => {
      if (t.id === stringId) {
        oldText = t.text;
        return { ...t, text: newText };
      }
      return t;
    }));
    if (oldText) {
      showStatusMessage(`Task "${oldText.substring(0, 30)}..." updated.`);
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
