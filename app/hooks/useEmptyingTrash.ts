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
      const taskInCurrentList = currentTodos.find(t => t.id === originalTaskId);
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
      showStatusMessage("An existing empty trash process is still finalizing individual task timers. Please wait.");
      return;
    }
    // Removed the check that prevented starting a new batch if a previous one was in its global restore window.
    // A new batch can now be started for any items currently in the 'Deleted' filter 
    // that are not already part of an active pendingFinalDeletionTimestamp countdown.

    const tasksToEmpty = todos.filter(todo => todo.isDeleted && !todo.markedForDeletionAt && !todo.pendingFinalDeletionTimestamp);
    if (tasksToEmpty.length === 0) {
      showStatusMessage("No tasks in trash to empty.");
      return;
    }
    const newBatchId = `batch-${Date.now()}`;
    const taskIdsInBatch = tasksToEmpty.map(t => t.id);
    const tasksSnapshot = JSON.parse(JSON.stringify(tasksToEmpty)); 
    const batchInitiationTime = Date.now();
    setTodos(prevTodos => 
      prevTodos.map(todo => 
        taskIdsInBatch.includes(todo.id) 
          ? { ...todo, pendingFinalDeletionTimestamp: batchInitiationTime + STAGE_2_GRACE_PERIOD_DURATION, stage2BatchId: newBatchId }
          : todo
      )
    );
    setEmptyingTrashBatch({
      batchId: newBatchId,
      taskIdsInBatch,
      tasksSnapshot,
      batchInitiationTime,
      allIndividualTimersEndedForBatch: false,
      // isRestored and batchCompletionTime are not set here; they are set later.
    });
    showStatusMessage(`${tasksToEmpty.length} task(s) starting 1-minute final deletion countdown.`);
    focusInput();
    resetInactivityTimer();
  }, [todos, setTodos, showStatusMessage, focusInput, resetInactivityTimer, setEmptyingTrashBatch]);

  const undoIndividualPendingFinalDeletion = useCallback((taskId: number) => {
    let taskText = "";
    setTodos(prevTodos => prevTodos.map(todo => {
      if (todo.id === taskId && todo.pendingFinalDeletionTimestamp && todo.stage2BatchId) {
        taskText = todo.text;
        return { ...todo, pendingFinalDeletionTimestamp: null, stage2BatchId: null }; // Effectively removes it from the current batch processing
      }
      return todo;
    }));
    if (taskText) {
      showStatusMessage(`Final deletion of "${taskText.substring(0,20)}..." undone.`);
    }
    // No need to modify emptyingTrashBatch here, checkAndUpdateBatchCompletion will handle batch status.
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
      let todosAfterDeletion: Todo[] = []; // To pass the potentially modified list to checkAndUpdateBatchCompletion

      setTodos(prevTodosInInterval => {
        // Filter out tasks whose pendingFinalDeletionTimestamp has passed
        todosAfterDeletion = prevTodosInInterval.filter(todo => {
          if (todo.pendingFinalDeletionTimestamp && now >= todo.pendingFinalDeletionTimestamp) {
            tasksPermanentlyDeletedThisTick++;
            return false; // Remove task
          }
          return true;
        });

        if (tasksPermanentlyDeletedThisTick > 0) {
          showStatusMessage(`${tasksPermanentlyDeletedThisTick} task(s) permanently deleted.`);
        }
        return todosAfterDeletion; // Return the updated list
      });
      
      // Call checkAndUpdateBatchCompletion if tasks were deleted OR if there's an active batch whose individual timers might not have all ended.
      if(tasksPermanentlyDeletedThisTick > 0 || (emptyingTrashBatchRef.current && !emptyingTrashBatchRef.current.allIndividualTimersEndedForBatch)){
         checkAndUpdateBatchCompletion(todosAfterDeletion, emptyingTrashBatchRef, setEmptyingTrashBatch, showStatusMessage, now);
      }

    }, AUTO_FINAL_DELETE_INTERVAL);

    return () => { if (autoFinalDeleteIntervalRef.current) clearInterval(autoFinalDeleteIntervalRef.current); };
  }, [showStatusMessage, setEmptyingTrashBatch, setTodos]); // Removed todos from dependency array as it's accessed via setTodos callback

  const restoreBatchFromEmptyTrash = useCallback(() => {
    const batchToRestore = emptyingTrashBatchRef.current;
    if (!batchToRestore?.allIndividualTimersEndedForBatch || batchToRestore.isRestored) {
      showStatusMessage("No batch eligible for restoration or already restored.");
      return;
    }

    // Restore tasks from the snapshot
    const restoredTasks = batchToRestore.tasksSnapshot.map(snapTodo => ({
      ...snapTodo,
      isDeleted: true, // They are restored to the 'Deleted' items list
      markedForDeletionAt: null,
      pendingFinalDeletionTimestamp: null,
      stage2BatchId: null,
    }));

    setTodos(prevTodos => {
      const taskIdsAlreadyPresent = new Set(prevTodos.map(t => t.id));
      // Filter out tasks from restoredTasks that are somehow already in prevTodos (e.g., if restored by another means, though unlikely here)
      const newTasksToAdd = restoredTasks.filter(rt => !taskIdsAlreadyPresent.has(rt.id));
      return [...prevTodos, ...newTasksToAdd];
    });

    // Mark the batch as restored
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
    setEmptyingTrashBatch, // Exporting for potential direct manipulation if ever needed (e.g. clearing storage)
    removeEmptyingTrashStorage // Exporting for explicit clearing of the batch from storage
  };
}
