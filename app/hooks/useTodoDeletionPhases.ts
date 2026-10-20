import { useMemo } from 'react';
import type { Todo, UndoableActionDetails, EmptyingTrashBatchDetails } from '../types';
import { UNDO_TIMEOUT, FILTER_SWITCH_DELAY } from '../lib/constants';

interface UseTodoDeletionPhasesProps {
  todo: Todo;
  currentTime: number;
  undoableAction: UndoableActionDetails | null;
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  undoTimeoutDuration: number;
}

export function useTodoDeletionPhases({
  todo,
  currentTime,
  undoableAction,
  emptyingTrashBatch,
  undoTimeoutDuration,
}: UseTodoDeletionPhasesProps) {
  const isYellowBorderPhase = useMemo(() => {
    if (!todo.markedForDeletionAt || !currentTime) return false;
    const timeSinceMarked = currentTime - todo.markedForDeletionAt;
    return !todo.isDeleted && timeSinceMarked < (UNDO_TIMEOUT + FILTER_SWITCH_DELAY) && undoableAction?.actionType === 'delete' && undoableAction.id === todo.id;
  }, [todo.id, todo.markedForDeletionAt, todo.isDeleted, currentTime, undoableAction]);

  const yellowBorderCountdown = useMemo(() => {
    if (!isYellowBorderPhase || !todo.markedForDeletionAt || !currentTime || !undoableAction) return 0;
    const timeSinceUndoActionStarted = currentTime - undoableAction.timestamp;
    return Math.max(0, Math.ceil((UNDO_TIMEOUT - timeSinceUndoActionStarted) / 1000));
  }, [isYellowBorderPhase, todo.markedForDeletionAt, currentTime, undoableAction]);

  const isRedBorderPhase = useMemo(() => {
    if (!todo.pendingFinalDeletionTimestamp || !currentTime || !emptyingTrashBatch || !todo.stage2BatchId) return false;
    return todo.stage2BatchId === emptyingTrashBatch.batchId && currentTime < todo.pendingFinalDeletionTimestamp;
  }, [todo.pendingFinalDeletionTimestamp, todo.stage2BatchId, currentTime, emptyingTrashBatch]);

  const redBorderCountdown = useMemo(() => {
    if (!isRedBorderPhase || !todo.pendingFinalDeletionTimestamp || !currentTime) return 0;
    const timeRemaining = todo.pendingFinalDeletionTimestamp - currentTime;
    return Math.max(0, Math.ceil(timeRemaining / 1000));
  }, [isRedBorderPhase, todo.pendingFinalDeletionTimestamp, currentTime]);

  const isStage1UndoActive = useMemo(() => {
    return undoableAction?.id === todo.id && undoableAction?.actionType === 'delete' && !!todo.markedForDeletionAt;
  }, [undoableAction, todo.id, todo.markedForDeletionAt]);
  
  const stage1UndoCountdown = useMemo(() => {
    if (!isStage1UndoActive || !undoableAction || !currentTime) return 0;
    const timeSinceAction = currentTime - undoableAction.timestamp;
    return Math.max(0, Math.ceil((undoTimeoutDuration - timeSinceAction) / 1000));
  }, [isStage1UndoActive, undoableAction, currentTime, undoTimeoutDuration]);

  const isUndoOrDeletionPhaseActive = isYellowBorderPhase || isRedBorderPhase || isStage1UndoActive;

  return {
    isYellowBorderPhase,
    yellowBorderCountdown,
    isRedBorderPhase,
    redBorderCountdown,
    isStage1UndoActive,
    stage1UndoCountdown,
    isUndoOrDeletionPhaseActive,
  };
}
