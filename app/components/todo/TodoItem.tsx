'use client';

import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { useRef, MouseEvent, useMemo } from 'react'; 
import type { Todo, UndoableActionDetails, EmptyingTrashBatchDetails } from '../../types';
import { useSaveFeedback } from '../../hooks/useSaveFeedback';
import { useTodoEditing } from '../../hooks/useTodoEditing';
import { TodoDisplay } from './TodoDisplay';
import { TodoActions, type PrimaryActionType } from './TodoActions'; // Import PrimaryActionType
import { UndoBanner } from './UndoBanner';
import { Trash2, Undo2, RotateCcw } from 'lucide-react';
import { FILTER_SWITCH_DELAY, UNDO_TIMEOUT } from '../../lib/constants';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void; 
  onUpdateText: (id: number, newText: string) => void;
  undoableAction: UndoableActionDetails | null; 
  onUndo: (id: number) => void; 
  undoTimeoutDuration: number; 
  onRestorePendingDeletion?: (id: number) => void; 
  currentTime?: number;
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
}

export function TodoItem({ 
  todo, 
  onToggle, 
  onRemove, 
  onUpdateText, 
  undoableAction, 
  onUndo, 
  undoTimeoutDuration, 
  onRestorePendingDeletion,
  currentTime,
  emptyingTrashBatch
}: TodoItemProps) {
  const itemRef = useRef<HTMLLIElement>(null);
  const justSaved = useSaveFeedback(todo.text, todo.completed);

  const isYellowBorderPhase = useMemo(() => {
    if (!todo.markedForDeletionAt || !currentTime) return false;
    return !todo.isDeleted && (currentTime - todo.markedForDeletionAt < FILTER_SWITCH_DELAY) && undoableAction?.actionType === 'delete';
  }, [todo.markedForDeletionAt, todo.isDeleted, currentTime, undoableAction]);

  const yellowBorderCountdown = useMemo(() => {
    if (!isYellowBorderPhase || !todo.markedForDeletionAt || !currentTime) return 0;
    return Math.max(0, Math.ceil((FILTER_SWITCH_DELAY - (currentTime - todo.markedForDeletionAt)) / 1000));
  }, [isYellowBorderPhase, todo.markedForDeletionAt, currentTime]);

  const isRedBorderPhase = useMemo(() => {
    if (!todo.pendingFinalDeletionTimestamp || !currentTime || !emptyingTrashBatch) return false;
    return todo.batchId === emptyingTrashBatch.batchId && currentTime < todo.pendingFinalDeletionTimestamp;
  }, [todo.pendingFinalDeletionTimestamp, todo.batchId, currentTime, emptyingTrashBatch]);

  const redBorderCountdown = useMemo(() => {
    if (!isRedBorderPhase || !todo.pendingFinalDeletionTimestamp || !currentTime) return 0;
    return Math.max(0, Math.ceil((todo.pendingFinalDeletionTimestamp - currentTime) / 1000));
  }, [isRedBorderPhase, todo.pendingFinalDeletionTimestamp, currentTime]);

  const isStage1UndoActive = useMemo(() => {
    return undoableAction?.actionType === 'delete' && !!todo.markedForDeletionAt;
  }, [undoableAction, todo.markedForDeletionAt]);
  
  const stage1UndoCountdown = useMemo(() => {
    if (!isStage1UndoActive || !undoableAction || !currentTime) return 0;
    return Math.max(0, Math.ceil((undoTimeoutDuration - (currentTime - undoableAction.timestamp)) / 1000));
  }, [isStage1UndoActive, undoableAction, currentTime, undoTimeoutDuration]);

  const isUndoOrDeletionPhaseActive = isYellowBorderPhase || isRedBorderPhase || isStage1UndoActive;

  const {
    isEditing,
    editText,
    setEditText,
    inputRef,
    handleSave,
    handleInputKeyDown,
    startEditing,
  } = useTodoEditing({
    initialText: todo.text,
    onUpdateText: (newText: string) => onUpdateText(todo.id, newText),
    onRemove: () => onRemove(todo.id),
    isUndoOrGraceActive: isUndoOrDeletionPhaseActive 
  });

  const isInteractive = !isUndoOrDeletionPhaseActive && !isEditing;

  const handleToggleCompletion = () => {
    if (!isInteractive || todo.isDeleted || todo.markedForDeletionAt || todo.pendingFinalDeletionTimestamp) return;
    onToggle(todo.id);
  }

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isInteractive || todo.isDeleted || todo.markedForDeletionAt || todo.pendingFinalDeletionTimestamp) return;
    let target = event.target as HTMLElement;
    while (target && target !== event.currentTarget) {
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.getAttribute('role') === 'checkbox' || target.closest('[data-no-toggle]')) {
        return;
      }
      target = target.parentElement as HTMLElement;
    }
    handleToggleCompletion();
  };

  const checkboxId = `todo-item-checkbox-${todo.id}`;
  const labelId = `todo-item-label-${todo.id}`;
  
  const cardClasses = [
    'bg-slate-700',
    'border-slate-600',
    'hover:shadow-lg',
    'focus-within:shadow-lg focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-800',
    'transition-all duration-300',
    'w-full',
    (todo.isDeleted && !isYellowBorderPhase && !isRedBorderPhase && !isStage1UndoActive) ? 'opacity-60' : '',
    isYellowBorderPhase ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-800 animate-pulseSlow' : '',
    isRedBorderPhase ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-slate-800 animate-pulse' : '',
    justSaved && isInteractive ? 'border-sky-500 shadow-sky-md' : 'border-slate-600',
    isInteractive && !todo.isDeleted && !todo.markedForDeletionAt && !todo.pendingFinalDeletionTimestamp ? 'cursor-pointer' : '',
  ].filter(Boolean).join(' ');

  const showEditButton = !isEditing && !todo.isDeleted && !isUndoOrDeletionPhaseActive;
  const showMainActionButtons = !isUndoOrDeletionPhaseActive;

  let primaryActionIcon: React.ReactElement;
  let primaryActionLabel: string;
  let primaryActionTitle: string;
  let onPrimaryAction: () => void;
  let primaryActionDisabled = false;
  let currentActionType: PrimaryActionType = 'initial-delete'; // Default

  if (isRedBorderPhase && onRestorePendingDeletion) {
    primaryActionIcon = <RotateCcw size={16} />;
    primaryActionLabel = `Undo permanent delete: ${todo.text}`;
    primaryActionTitle = `Undo permanent delete (${redBorderCountdown}s left)`;
    onPrimaryAction = () => onRestorePendingDeletion(todo.id);
    currentActionType = 'undo-pending-deletion';
  } else if (todo.isDeleted && !isYellowBorderPhase && !isRedBorderPhase && undoableAction?.actionType === 'restore' && onUndo) {
    // This case means the *original* undoable action was to 'restore' this item (which is currently isDeleted:true).
    // So the button should offer to undo that restoration, effectively re-deleting it (softly).
    primaryActionIcon = <Trash2 size={16} />;
    primaryActionLabel = `Undo restoration for: ${todo.text}`;
    primaryActionTitle = `Undo restoration (will re-delete task)`;
    onPrimaryAction = () => onUndo(todo.id); // onUndo will use the originalTodo from actionDetails to revert.
    currentActionType = 'initial-delete'; // Visually like a delete button
  } else if (todo.isDeleted && !isYellowBorderPhase && !isRedBorderPhase) {
    primaryActionIcon = <Undo2 size={16} />;
    primaryActionLabel = `Restore task: ${todo.text}`;
    primaryActionTitle = `Restore task from trash`;
    onPrimaryAction = () => onUndo(todo.id); // This will trigger onUndo with an actionType 'restore'
    currentActionType = 'restore-from-trash'; 
  } else if (isYellowBorderPhase) {
    primaryActionIcon = <Trash2 size={16} />;
    primaryActionLabel = `Deleting...`;
    primaryActionTitle = `Task is being deleted (yellow phase)`;
    onPrimaryAction = () => {};
    primaryActionDisabled = true;
    currentActionType = 'disabled';
  } else {
    primaryActionIcon = <Trash2 size={16} />;
    primaryActionLabel = `Delete task: ${todo.text}`;
    primaryActionTitle = `Delete task (will start yellow phase)`;
    onPrimaryAction = () => onRemove(todo.id);
    currentActionType = 'initial-delete';
  }

  if (!todo) return null;

  return (
    <li 
      ref={itemRef}
      aria-labelledby={labelId}
      tabIndex={-1}
      className="list-none w-full flex"
    >
      <Card className={cardClasses} onClick={handleCardClick}>
        <CardContent className="p-2 sm:p-3 flex flex-col gap-1 sm:gap-2"> 
          <div className="flex items-center justify-between gap-1 sm:gap-2"> 
            <div className="flex flex-col flex-grow min-w-0">
              <TodoDisplay
                todo={todo}
                isEditing={isEditing}
                editText={editText}
                onEditTextChange={setEditText}
                onToggleCompletion={handleToggleCompletion}
                onSaveEdit={handleSave}
                onInputKeyDown={handleInputKeyDown}
                onLabelDoubleClick={startEditing}
                onLabelKeyDown={(e) => { 
                  if ((e.key === 'Enter' || e.key === ' ') && isInteractive && !todo.isDeleted) {
                    e.preventDefault(); 
                    startEditing();
                  }
                }}
                inputRef={inputRef}
                checkboxId={checkboxId}
                labelId={labelId}
                isInteractive={isInteractive}
                isUndoOrDeletionPhaseActive={isUndoOrDeletionPhaseActive}
              />
            </div>
            <TodoActions
              todoText={todo.text}
              isInteractive={isInteractive}
              showEditButton={showEditButton}
              showMainActionButtons={!primaryActionDisabled && showMainActionButtons}
              onEdit={startEditing}
              onPrimaryAction={onPrimaryAction}
              primaryActionIcon={primaryActionIcon}
              primaryActionLabel={primaryActionLabel}
              primaryActionTitle={primaryActionTitle}
              primaryActionDisabled={primaryActionDisabled}
              primaryActionType={currentActionType} // Pass the determined type
            />
          </div>
          
          <UndoBanner 
            todo={todo}
            undoableAction={undoableAction}
            onUndo={() => onUndo(todo.id)}
            onRestorePendingDeletion={onRestorePendingDeletion && isRedBorderPhase ? () => onRestorePendingDeletion(todo.id) : undefined}
            currentTime={currentTime}
            undoTimeoutDuration={undoTimeoutDuration}
            filterSwitchDelay={FILTER_SWITCH_DELAY}
            isYellowBorderPhase={isYellowBorderPhase}
            yellowBorderCountdown={yellowBorderCountdown}
            isRedBorderPhase={isRedBorderPhase}
            redBorderCountdown={redBorderCountdown}
            isStage1UndoActive={isStage1UndoActive}
            stage1UndoCountdown={stage1UndoCountdown}
          />
        </CardContent>
      </Card>
    </li>
  );
}
