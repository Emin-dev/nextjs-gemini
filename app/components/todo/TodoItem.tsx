'use client';

import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { useRef, MouseEvent, useMemo } from 'react'; 
import type { Todo, UndoableActionDetails, EmptyingTrashBatchDetails, FilterValue } from '../../types'; // Added FilterValue
import { useSaveFeedback } from '../../hooks/useSaveFeedback';
import { useTodoEditing } from '../../hooks/useTodoEditing';
import { TodoDisplay } from './TodoDisplay';
import { TodoActions, type PrimaryActionType } from './TodoActions';
import { UndoBanner } from './UndoBanner';
import { Trash2, Undo2, RotateCcw } from 'lucide-react';
import { FILTER_SWITCH_DELAY, UNDO_TIMEOUT, STAGE_2_GRACE_PERIOD_DURATION } from '../../lib/constants';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void; 
  onUpdateText: (id: number, newText: string) => void;
  undoableAction: UndoableActionDetails | null; 
  onUndo: (id: number) => void; 
  undoTimeoutDuration: number; 
  onRestorePendingDeletion?: (id: number) => void; 
  currentTime: number; 
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  currentFilter: FilterValue; // Added currentFilter
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
  emptyingTrashBatch,
  currentFilter // Added currentFilter
}: TodoItemProps) {
  const itemRef = useRef<HTMLLIElement>(null);
  const justSaved = useSaveFeedback(todo.text, todo.completed);

  const isYellowBorderPhase = useMemo(() => {
    if (!todo.markedForDeletionAt || !currentTime) return false;
    const timeSinceMarked = currentTime - todo.markedForDeletionAt;
    return !todo.isDeleted && timeSinceMarked < (UNDO_TIMEOUT + FILTER_SWITCH_DELAY) && undoableAction?.actionType === 'delete' && undoableAction.id === todo.id;
  }, [todo.markedForDeletionAt, todo.isDeleted, currentTime, undoableAction, UNDO_TIMEOUT, FILTER_SWITCH_DELAY]);

  const yellowBorderCountdown = useMemo(() => {
    if (!isYellowBorderPhase || !todo.markedForDeletionAt || !currentTime || !undoableAction) return 0;
    const timeSinceUndoActionStarted = currentTime - undoableAction.timestamp;
    return Math.max(0, Math.ceil((UNDO_TIMEOUT - timeSinceUndoActionStarted) / 1000));
  }, [isYellowBorderPhase, todo.markedForDeletionAt, currentTime, undoableAction, UNDO_TIMEOUT]);

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
    (todo.isDeleted && !isYellowBorderPhase && !isRedBorderPhase && !isStage1UndoActive && currentFilter !== 'deleted') ? 'opacity-50 line-through' : '', // Visual cue for soft-deleted items if not in special phase and not in deleted filter (should not happen with new filter logic)
    (todo.isDeleted && currentFilter === 'deleted' && !isRedBorderPhase && !isStage1UndoActive) ? 'opacity-70' : '', // Slightly different opacity for items in deleted filter
    isStage1UndoActive ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-800 animate-pulseSlow' : '',
    isRedBorderPhase ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-slate-800 animate-pulse' : '',
    justSaved && isInteractive ? 'border-sky-500 shadow-sky-md' : 'border-slate-600',
    isInteractive && !todo.isDeleted && !todo.markedForDeletionAt && !todo.pendingFinalDeletionTimestamp ? 'cursor-pointer' : '',
  ].filter(Boolean).join(' ');

  const showEditButton = !isEditing && !isUndoOrDeletionPhaseActive && currentFilter !== 'deleted';
  const showMainActionButtons = !isUndoOrDeletionPhaseActive || isRedBorderPhase || (currentFilter === 'deleted' && todo.isDeleted && !isStage1UndoActive && !isRedBorderPhase);

  let primaryActionIcon: React.ReactElement;
  let primaryActionLabel: string;
  let primaryActionTitle: string;
  let onPrimaryAction: () => void;
  let primaryActionDisabled = false;
  let currentActionType: PrimaryActionType = 'initial-delete'; 

  if (isRedBorderPhase && onRestorePendingDeletion && currentFilter === 'deleted') {
    primaryActionIcon = <RotateCcw size={16} />;
    primaryActionLabel = `Undo permanent delete for: ${todo.text}`;
    primaryActionTitle = `Undo permanent delete (${redBorderCountdown}s left)`;
    onPrimaryAction = () => onRestorePendingDeletion(todo.id);
    currentActionType = 'undo-pending-deletion';
  } else if (isStage1UndoActive && onUndo) {
    primaryActionIcon = <Undo2 size={16} />;
    primaryActionLabel = `Undo delete for: ${todo.text}`;
    primaryActionTitle = `Undo delete (${stage1UndoCountdown}s left)`;
    onPrimaryAction = () => onUndo(todo.id);
    currentActionType = 'undo-initial-delete';
  } else if (todo.isDeleted && !isRedBorderPhase && currentFilter === 'deleted') { // Only show Restore for items in 'deleted' filter
    if (undoableAction && undoableAction.actionType === 'restore' && undoableAction.id === todo.id && onUndo) {
      primaryActionIcon = <Trash2 size={16} />;
      primaryActionLabel = `Undo restoration of: ${todo.text}`;
      primaryActionTitle = `Undo restoration (re-deletes task to trash)`;
      onPrimaryAction = () => onUndo(todo.id);
      currentActionType = 'initial-delete'; 
    } else if (onUndo) {
      primaryActionIcon = <Undo2 size={16} />;
      primaryActionLabel = `Restore task: ${todo.text}`;
      primaryActionTitle = `Restore task from trash`;
      onPrimaryAction = () => onUndo(todo.id);
      currentActionType = 'restore-from-trash'; 
    } else {
        primaryActionIcon = <Trash2 size={16} />;
        primaryActionLabel = `Task is deleted`;
        primaryActionTitle = `Task is deleted`;
        onPrimaryAction = () => {};
        primaryActionDisabled = true;
        currentActionType = 'disabled';
    }
  } else if (!todo.isDeleted && !isRedBorderPhase && !isStage1UndoActive) { // Normal active/completed task, not in deleted filter
    primaryActionIcon = <Trash2 size={16} />;
    primaryActionLabel = `Delete task: ${todo.text}`;
    primaryActionTitle = `Delete task`;
    onPrimaryAction = () => onRemove(todo.id);
    currentActionType = 'initial-delete';
  } else { 
    // Hide action button if it's a deleted item shown outside the deleted filter (e.g. during yellow border phase in 'all')
    // or if no other condition matches.
    primaryActionIcon = <div />;
    primaryActionLabel = 'No action';
    primaryActionTitle = 'No action available in this state/filter';
    onPrimaryAction = () => {};
    primaryActionDisabled = true;
    currentActionType = 'disabled';
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
            <Image
              src={`https://picsum.photos/seed/${todo.id}/600`}
              alt={`Visual cue for task: ${todo.text}`}
              width={600}
              height={600}
              className="rounded-md mr-2 sm:mr-3 flex-shrink-0 object-cover h-16 w-16 sm:h-20 sm:w-20"
              priority={false}
              data-no-toggle
            />
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
              primaryActionType={currentActionType}
            />
          </div>
          
          <UndoBanner 
            todo={todo}
            undoableAction={undoableAction}
            onUndo={isStage1UndoActive && onUndo ? () => onUndo(todo.id) : undefined}
            onRestorePendingDeletion={isRedBorderPhase && onRestorePendingDeletion && currentFilter === 'deleted' ? () => onRestorePendingDeletion(todo.id) : undefined}
            currentTime={currentTime}
            undoTimeoutDuration={undoTimeoutDuration}
            filterSwitchDelay={FILTER_SWITCH_DELAY}
            stage2GracePeriodDuration={STAGE_2_GRACE_PERIOD_DURATION}
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
