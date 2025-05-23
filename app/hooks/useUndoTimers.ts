'use client';

import { useState, useEffect } from 'react';
import type { Todo, UndoableActionDetails } from '../types'; // Updated import path

interface UseUndoTimersParams {
  todo: Todo | null;
  undoableAction: UndoableActionDetails | null;
  currentTime: number | undefined;
  undoTimeoutDuration: number;
  onRestoreDuringGracePeriod?: (id: number) => void; 
}

export function useUndoTimers({
  todo,
  undoableAction,
  currentTime,
  undoTimeoutDuration,
  onRestoreDuringGracePeriod
}: UseUndoTimersParams) {
  const [stage1UndoCountdown, setStage1UndoCountdown] = useState(0);
  const [stage2GraceCountdown, setStage2GraceCountdown] = useState(0);

  const isStage1UndoActive = todo ? (undoableAction?.id === todo.id && undoableAction?.actionType === 'delete') : false;
  const isStage2GraceActive = todo ? !!(todo.isDeleted && todo.pendingFinalDeletionTimestamp && currentTime && currentTime < todo.pendingFinalDeletionTimestamp && onRestoreDuringGracePeriod) : false;

  useEffect(() => {
    if (isStage1UndoActive) {
      setStage1UndoCountdown(Math.ceil(undoTimeoutDuration / 1000));
      const interval = setInterval(() => {
        setStage1UndoCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setStage1UndoCountdown(0);
    }
  }, [isStage1UndoActive, undoTimeoutDuration]);

  useEffect(() => {
    if (isStage2GraceActive && todo && todo.pendingFinalDeletionTimestamp && currentTime) {
      const timeLeft = Math.max(0, Math.ceil((todo.pendingFinalDeletionTimestamp - currentTime) / 1000));
      setStage2GraceCountdown(timeLeft);
    } else {
      setStage2GraceCountdown(0);
    }
  }, [isStage2GraceActive, todo, todo?.pendingFinalDeletionTimestamp, currentTime]);

  return {
    stage1UndoCountdown,
    stage2GraceCountdown,
    isStage1UndoActive,
    isStage2GraceActive
  };
}
