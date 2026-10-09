'use client';

import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { useRef, type MouseEvent } from 'react'; 
import type { Todo, UndoableActionDetails, EmptyingTrashBatchDetails, FilterValue } from '../../types';
import { useSaveFeedback } from '../../hooks/useSaveFeedback';
import { useTodoEditing } from '../../hooks/useTodoEditing';
import { useTodoDeletionPhases } from '../../hooks/useTodoDeletionPhases';
import { TodoDisplay } from './TodoDisplay';
import { TodoActions } from './TodoActions';
import { UndoBanner } from './UndoBanner';
import { getPrimaryActionDetails, type PrimaryActionDetails as PAShape } from './todoItemUtils'; // Import type for clarity

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void; 
  onUpdateText: (id: number, newText: string) => void;
  onRestoreItem: (id: number) => void; // Added for individual restore
  undoableAction: UndoableActionDetails | null; 
  onUndo: (id: number) => void; 
  undoTimeoutDuration: number; 
  onRestorePendingDeletion?: (id: number) => void; 
  currentTime: number; 
  emptyingTrashBatch: EmptyingTrashBatchDetails | null;
  currentFilter: FilterValue;
}

export function TodoItem({ 
  todo, 
  onToggle, 
  onRemove, 
  onUpdateText, 
  onRestoreItem, // Destructure new prop
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
    isRedBorderPhase,    
    redBorderCountdown,  // number (seconds)
    isStage1UndoActive,  
    stage1UndoCountdown, // number (seconds)
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
    'focus-within:shadow-lg focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-800',
    'transition-all duration-300',
    'w-full',
    (todo.isDeleted && !isYellowBorderPhase && !isRedBorderPhase && !isStage1UndoActive && currentFilter !== 'deleted') ? 'opacity-50 line-through' : '',
    (todo.isDeleted && currentFilter === 'deleted' && !isRedBorderPhase && !isStage1UndoActive) ? 'opacity-70' : '',
    isStage1UndoActive ? 'ring-2 ring-yellow-500 ring-offset-1 ring-offset-slate-800 animate-pulseSlow' : '',
    isRedBorderPhase ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-slate-800 animate-pulse' : '',
    justSaved && isInteractive ? 'border-cyan-500 shadow-cyan-md' : 'border-slate-600',
    isInteractive && !todo.isDeleted && !todo.markedForDeletionAt && !todo.pendingFinalDeletionTimestamp ? 'cursor-pointer' : '',
  ].filter(Boolean).join(' ');

  const showEditButton = !isEditing && !isUndoOrDeletionPhaseActive && (currentFilter !== 'deleted' || isStage1UndoActive);
  
  const formattedRedCountdown = `${redBorderCountdown}s`;
  const formattedStage1Countdown = `${stage1UndoCountdown}s`;

  const primaryAction: PAShape = getPrimaryActionDetails({ 
    todo, 
    isRedBorderPhase, 
    redBorderCountdown: formattedRedCountdown, 
    isStage1UndoActive, 
    stage1UndoCountdown: formattedStage1Countdown, 
    onRestorePendingDeletion, 
    onUndo: () => onUndo(todo.id),
    onRemove: () => onRemove(todo.id), 
    onRestoreItem: () => onRestoreItem(todo.id), 
    currentFilter, 
    undoableAction 
  });

  const showMainActionButtons = !primaryAction.disabled && !isStage1UndoActive;

  const imageRequestSize = 300; // Changed from 80 to 300 for higher quality

  return (
    <li 
      ref={itemRef}
      aria-labelledby={labelId}
      tabIndex={-1}
      className="list-none w-full flex"
    >
      <Card className={cardClasses} onClick={handleCardClick}>
        <CardContent className={`p-2 sm:p-3 flex flex-col gap-1 sm:gap-2 ${isRedBorderPhase && onRestorePendingDeletion ? '' : 'pb-2 sm:pb-3'}`}> 
          <div className="flex items-center justify-between gap-1 sm:gap-2"> 
            <Image
              src={`https://picsum.photos/seed/${todo.id}/${imageRequestSize}`}
              alt={`Visual cue for task: ${todo.text}`}
              width={imageRequestSize} // Use new variable for intrinsic width
              height={imageRequestSize} // Use new variable for intrinsic height
              className="rounded-md mr-2 sm:mr-3 flex-shrink-0 object-cover h-16 w-16 sm:h-20 sm:w-20"
              priority={false}
              data-no-toggle
              unoptimized={false}
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
              showEditButton={showEditButton && !isStage1UndoActive} 
              showMainActionButtons={showMainActionButtons}
              onEdit={startEditing}
              onPrimaryAction={primaryAction.onAction}
              primaryActionIcon={primaryAction.icon}
              primaryActionLabel={primaryAction.label}
              primaryActionTitle={primaryAction.title}
              primaryActionDisabled={primaryAction.disabled}
              primaryActionType={primaryAction.type}
              isStage1UndoActive={isStage1UndoActive}
              stage1UndoCountdown={formattedStage1Countdown}
              onStage1Undo={isStage1UndoActive && onUndo ? () => onUndo(todo.id) : undefined}
            />
          </div>
          
          {isRedBorderPhase && onRestorePendingDeletion && (
            <UndoBanner 
              todo={todo}
              onRestorePendingDeletion={() => onRestorePendingDeletion(todo.id)}
              isRedBorderPhase={isRedBorderPhase}
              redBorderCountdown={formattedRedCountdown}
            />
          )}
        </CardContent>
      </Card>
    </li>
  );
}
