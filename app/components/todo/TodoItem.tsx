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
import { UndoBanner } from './UndoBanner'; // Will be used for Red Border phase only now
import { getPrimaryActionDetails } from './todoItemUtils';
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
    isYellowBorderPhase, // This will determine the card ring, but not the banner
    isRedBorderPhase,    // For the UndoBanner (red)
    redBorderCountdown,  // For the UndoBanner (red)
    isStage1UndoActive,  // To pass to TodoActions
    stage1UndoCountdown, // To pass to TodoActions
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
    // Updated focus ring to cyan from sky
    'focus-within:shadow-lg focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-800',
    'transition-all duration-300',
    'w-full',
    (todo.isDeleted && !isYellowBorderPhase && !isRedBorderPhase && !isStage1UndoActive && currentFilter !== 'deleted') ? 'opacity-50 line-through' : '',
    (todo.isDeleted && currentFilter === 'deleted' && !isRedBorderPhase && !isStage1UndoActive) ? 'opacity-70' : '',
    isStage1UndoActive ? 'ring-2 ring-yellow-500 ring-offset-1 ring-offset-slate-800 animate-pulseSlow' : '', // Yellow ring for stage 1 undo
    isRedBorderPhase ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-slate-800 animate-pulse' : '', // Red ring for stage 2
    justSaved && isInteractive ? 'border-cyan-500 shadow-cyan-md' : 'border-slate-600', // Cyan border for save feedback
    isInteractive && !todo.isDeleted && !todo.markedForDeletionAt && !todo.pendingFinalDeletionTimestamp ? 'cursor-pointer' : '',
  ].filter(Boolean).join(' ');

  // Edit button shown if not editing, not in any undo/deletion phase, and not in 'deleted' filter (unless stage 1 undo is active for it)
  const showEditButton = !isEditing && !isUndoOrDeletionPhaseActive && (currentFilter !== 'deleted' || isStage1UndoActive);
  
  const primaryAction = getPrimaryActionDetails({ 
    todo, 
    isRedBorderPhase, 
    redBorderCountdown, 
    isStage1UndoActive, 
    stage1UndoCountdown, 
    onRestorePendingDeletion, 
    onUndo: () => onUndo(todo.id), // Ensure onUndo is passed correctly for primary action context if needed elsewhere
    onRemove: () => onRemove(todo.id), 
    currentFilter, 
    undoableAction 
  });

  const showMainActionButtons = !primaryAction.disabled && !isStage1UndoActive; // Hide main actions if Stage 1 Undo is active

  const imageSize = 80;

  return (
    <li 
      ref={itemRef}
      aria-labelledby={labelId}
      tabIndex={-1}
      className="list-none w-full flex"
    >
      <Card className={cardClasses} onClick={handleCardClick}>
        {/* CardContent now has less bottom padding if UndoBanner (Red) is not shown to avoid double padding */}
        <CardContent className={`p-2 sm:p-3 flex flex-col gap-1 sm:gap-2 ${isRedBorderPhase ? '' : 'pb-2 sm:pb-3'}`}> 
          <div className="flex items-center justify-between gap-1 sm:gap-2"> 
            <Image
              src={`https://picsum.photos/seed/${todo.id}/${imageSize}`}
              alt={`Visual cue for task: ${todo.text}`}
              width={imageSize}
              height={imageSize}
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
              showEditButton={showEditButton && !isStage1UndoActive} // Edit button hidden if stage 1 undo is active
              showMainActionButtons={showMainActionButtons}
              onEdit={startEditing}
              onPrimaryAction={primaryAction.onAction}
              primaryActionIcon={primaryAction.icon}
              primaryActionLabel={primaryAction.label}
              primaryActionTitle={primaryAction.title}
              primaryActionDisabled={primaryAction.disabled}
              primaryActionType={primaryAction.type}
              // Pass Stage 1 Undo props
              isStage1UndoActive={isStage1UndoActive}
              stage1UndoCountdown={stage1UndoCountdown}
              onStage1Undo={isStage1UndoActive && onUndo ? () => onUndo(todo.id) : undefined}
            />
          </div>
          
          {/* UndoBanner now only handles the Red Border phase (Stage 2 grace period/global restore) */}
          {isRedBorderPhase && (
            <UndoBanner 
              todo={todo}
              onRestorePendingDeletion={onRestorePendingDeletion && currentFilter === 'deleted' ? () => onRestorePendingDeletion(todo.id) : undefined}
              isRedBorderPhase={isRedBorderPhase}
              redBorderCountdown={redBorderCountdown}
              // Removed Stage 1 props as they are handled by TodoActions now
              // isStage1UndoActive={false} 
              // stage1UndoCountdown=""
            />
          )}
        </CardContent>
      </Card>
    </li>
  );
}
