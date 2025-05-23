'use client';

import { useEffect, useCallback, useRef } from 'react';
import type { Todo, EmptyingTrashBatchDetails } from '../types';
import {
  EMPTYING_TRASH_BATCH_STORAGE_KEY,
  STAGE_2_GRACE_PERIOD_DURATION,
  AUTO_FINAL_DELETE_INTERVAL,
} from '../lib/constants';
import useLocalStorage from './useLocalStorage';

interface UseEmptyingTrashProps {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  showStatusMessage: (message: string) => void;
  focusInput: () => void;
  resetInactivityTimer: () => void;
  currentTime: number; 
}

function checkAndUpdateBatchCompletion(
  currentTodos: Todo[], 
  emptyingTrashBatchRef: React.RefObject<EmptyingTrashBatchDetails | null>,
  setEmptyingTrashBatch: React.Dispatch<React.SetStateAction<EmptyingTrashBatchDetails | null>>,
  showStatusMessage: (message: string) => void,
  now: number
) {
  const currentBatch = emptyingTrashBatchRef.current;
  if (currentBatch && !currentBatch.allIndividualTimersEndedForBatch) {
    let allOriginalTasksProcessed = true;
    for (const originalTaskId of currentBatch.taskIdsInBatch) {
      const taskInCurrentList = currentTodos.find(t => String(t.id) === String(originalTaskId));
      if (taskInCurrentList && 
          taskInCurrentList.stage2BatchId === currentBatch.batchId && 
          taskInCurrentList.pendingFinalDeletionTimestamp && 
          now < taskInCurrentList.pendingFinalDeletionTimestamp) {
        allOriginalTasksProcessed = false;
        break;
      }
    }

    if (allOriginalTasksProcessed) {
      const finalBatchId: string = currentBatch.batchId;
      setEmptyingTrashBatch(prevBatch => {
          if(prevBatch && prevBatch.batchId === finalBatchId){
              return {
                  ...prevBatch,
                  allIndividualTimersEndedForBatch: true,
                  batchCompletionTime: now,
              }
          }
          return prevBatch;
      });
      showStatusMessage(`Batch processing complete. Global restore window active for batch ${finalBatchId.substring(6,10)}.`);
    }
  }
}

export function useEmptyingTrash({
  todos,
  setTodos,
  showStatusMessage,
  focusInput,
  resetInactivityTimer,
}: UseEmptyingTrashProps) {
  const [emptyingTrashBatch, setEmptyingTrashBatch, removeEmptyingTrashStorage] = useLocalStorage<EmptyingTrashBatchDetails | null>(
    EMPTYING_TRASH_BATCH_STORAGE_KEY,
    null
  );
  const emptyingTrashBatchRef = useRef<EmptyingTrashBatchDetails | null>(emptyingTrashBatch);
  const autoFinalDeleteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    emptyingTrashBatchRef.current = emptyingTrashBatch;
  }, [emptyingTrashBatch]);

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
    const taskIdsInBatch = tasksToEmpty.map(t => String(t.id)); // Ensure string IDs
    const tasksSnapshot = JSON.parse(JSON.stringify(tasksToEmpty.map(t => ({...t, id: String(t.id)})))); 
    const batchInitiationTime = Date.now();
    setTodos(prevTodos => 
      prevTodos.map(todo => 
        taskIdsInBatch.includes(String(todo.id)) 
          ? { ...todo, id: String(todo.id), pendingFinalDeletionTimestamp: batchInitiationTime + STAGE_2_GRACE_PERIOD_DURATION, stage2BatchId: newBatchId }
          : { ...todo, id: String(todo.id) }
      )
    );
    setEmptyingTrashBatch({
      batchId: newBatchId,
      taskIdsInBatch,
      tasksSnapshot,
      batchInitiationTime,
      allIndividualTimersEndedForBatch: false,
    });
    showStatusMessage(`${tasksToEmpty.length} task(s) starting 1-minute final deletion countdown.`);
    focusInput();
    resetInactivityTimer();
  }, [todos, setTodos, showStatusMessage, focusInput, resetInactivityTimer, setEmptyingTrashBatch]);

  const undoIndividualPendingFinalDeletion = useCallback((taskId: string | number) => {
    const stringTaskId = String(taskId);
    let taskText = "";
    setTodos(prevTodos => prevTodos.map(todo => {
      if (String(todo.id) === stringTaskId && todo.pendingFinalDeletionTimestamp && todo.stage2BatchId) {
        taskText = todo.text;
        return { ...todo, id: String(todo.id), pendingFinalDeletionTimestamp: null, stage2BatchId: null };
      }
      return { ...todo, id: String(todo.id) }; // Ensure all IDs are strings
    }));
    if (taskText) {
      showStatusMessage(`Final deletion of "${taskText.substring(0,20)}..." undone.`);
    }
    focusInput();
    resetInactivityTimer();
  }, [setTodos, showStatusMessage, focusInput, resetInactivityTimer]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => { if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current); };
    } 

    autoFinalDeleteIntervalRef.current = setInterval(() => {
      const now = Date.now(); 
      let tasksPermanentlyDeletedThisTick = 0;
      let todosAfterDeletion: Todo[] = [];

      setTodos(prevTodosInInterval => {
        todosAfterDeletion = prevTodosInInterval.filter(todo => {
          if (todo.pendingFinalDeletionTimestamp && now >= todo.pendingFinalDeletionTimestamp) {
            tasksPermanentlyDeletedThisTick++;
            return false; 
          }
          return true;
        }).map(t => ({...t, id: String(t.id)})); // Ensure string IDs

        if (tasksPermanentlyDeletedThisTick > 0) {
          showStatusMessage(`${tasksPermanentlyDeletedThisTick} task(s) permanently deleted.`);
        }
        return todosAfterDeletion;
      });
      
      if(tasksPermanentlyDeletedThisTick > 0 || (emptyingTrashBatchRef.current && !emptyingTrashBatchRef.current.allIndividualTimersEndedForBatch)){
         checkAndUpdateBatchCompletion(todosAfterDeletion, emptyingTrashBatchRef, setEmptyingTrashBatch, showStatusMessage, now);
      }

    }, AUTO_FINAL_DELETE_INTERVAL);

    return () => { if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current); };
  }, [showStatusMessage, setEmptyingTrashBatch, setTodos]);

  const restoreBatchFromEmptyTrash = useCallback(() => {
    const batchToRestore = emptyingTrashBatchRef.current;
    if (!batchToRestore || !batchToRestore.allIndividualTimersEndedForBatch || batchToRestore.isRestored) {
      showStatusMessage("No batch eligible for restoration or already restored.");
      return;
    }
    const restoredTasks = batchToRestore.tasksSnapshot.map(snapTodo => ({
      ...snapTodo,
      id: String(snapTodo.id), // Ensure string IDs
      isDeleted: true,
      markedForDeletionAt: null,
      pendingFinalDeletionTimestamp: null,
      stage2BatchId: null,
    }));
    setTodos(prevTodos => {
      const taskIdsAlreadyPresent = new Set(prevTodos.map(t => String(t.id)));
      const newTasksToAdd = restoredTasks.filter(rt => !taskIdsAlreadyPresent.has(String(rt.id)));
      const updatedOldTasks = prevTodos.map(t => ({...t, id: String(t.id)})); // Ensure string IDs
      return [...updatedOldTasks, ...newTasksToAdd];
    });
    setEmptyingTrashBatch(prevBatch => {
        if(prevBatch && prevBatch.batchId === batchToRestore.batchId){
            return { ...prevBatch, isRestored: true };
        }
        return prevBatch;
    });
    showStatusMessage(`Batch of ${restoredTasks.length} task(s) restored to 'Deleted' items.`);
    focusInput();
    resetInactivityTimer();
  }, [setTodos, showStatusMessage, setEmptyingTrashBatch, focusInput, resetInactivityTimer]);

  return {
    emptyingTrashBatch,
    emptyingTrashBatchRef, 
    initiateEmptyTrashProcess,
    undoIndividualPendingFinalDeletion,
    restoreBatchFromEmptyTrash,
    setEmptyingTrashBatch, 
    removeEmptyingTrashStorage
  };
}
