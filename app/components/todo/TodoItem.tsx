'use client';

import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { useRef, MouseEvent } from 'react'; 
import type { Todo, UndoableActionDetails, EmptyingTrashBatchDetails, FilterValue } from '../../types';
import { useSaveFeedback } from '../../hooks/useSaveFeedback';
import { useTodoEditing } from '../../hooks/useTodoEditing';
import { useTodoDeletionPhases } from '../../hooks/useTodoDeletionPhases';
import { TodoDisplay } from './TodoDisplay';
import { TodoActions } from './TodoActions';
import { UndoBanner } from './UndoBanner';
import { getPrimaryActionDetails } from './todoItemUtils';
import { FILTER_SWITCH_DELAY, UNDO_TIMEOUT, STAGE_2_GRACE_PERIOD_DURATION } from '../../lib/constants';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void; 
  onUpdateText: (id: string, newText: string) => void;
  undoableAction: UndoableActionDetails | null; 
  onUndo: (id: string) => void; 
  undoTimeoutDuration: number; 
  onRestorePendingDeletion?: (id: string) => void; 
  currentTime: number; 
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  currentFilter: FilterValue;
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
  currentFilter
}: TodoItemProps) {
  const itemRef = useRef<HTMLLIElement>(null);
  const justSaved = useSaveFeedback(todo.text, todo.completed);

  const {
    isYellowBorderPhase,
    yellowBorderCountdown,
    isRedBorderPhase,
    redBorderCountdown,
    isStage1UndoActive,
    stage1UndoCountdown,
    isUndoOrDeletionPhaseActive,
  } = useTodoDeletionPhases({
    todo,
    currentTime,
    undoableAction,
    emptyingTrashBatch,
    undoTimeoutDuration,
  });

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
    'rounded-lg', // Added for more iOS-like feel
    (todo.isDeleted && !isYellowBorderPhase && !isRedBorderPhase && !isStage1UndoActive && currentFilter !== 'deleted') ? 'opacity-50 line-through' : '',
    (todo.isDeleted && currentFilter === 'deleted' && !isRedBorderPhase && !isStage1UndoActive) ? 'opacity-70' : '',
    isStage1UndoActive ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-800 animate-pulseSlow' : '',
    isRedBorderPhase ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-slate-800 animate-pulse' : '',
    justSaved && isInteractive ? 'border-sky-500 shadow-sky-md' : 'border-slate-600',
    isInteractive && !todo.isDeleted && !todo.markedForDeletionAt && !todo.pendingFinalDeletionTimestamp ? 'cursor-pointer' : '',
  ].filter(Boolean).join(' ');

  const showEditButton = !isEditing && !isUndoOrDeletionPhaseActive && currentFilter !== 'deleted';
  
  const primaryAction = getPrimaryActionDetails({ 
    todo, 
    isRedBorderPhase, 
    redBorderCountdown, 
    isStage1UndoActive, 
    stage1UndoCountdown, 
    onRestorePendingDeletion, 
    onUndo, 
    onRemove, 
    currentFilter, 
    undoableAction 
  });

  const showMainActionButtons = !primaryAction.disabled;

  return (
    <li 
      ref={itemRef}
      aria-labelledby={labelId}
      tabIndex={-1}
      className="list-none w-full flex"
    >
      <Card className={cardClasses} onClick={handleCardClick}>
        <CardContent className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3"> 
          <div className="flex items-center justify-between gap-2 sm:gap-3"> 
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
              showMainActionButtons={showMainActionButtons}
              onEdit={startEditing}
              onPrimaryAction={primaryAction.onAction}
              primaryActionIcon={primaryAction.icon}
              primaryActionLabel={primaryAction.label}
              primaryActionTitle={primaryAction.title}
              primaryActionDisabled={primaryAction.disabled}
              primaryActionType={primaryAction.type}
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
