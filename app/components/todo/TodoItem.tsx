'use client';

import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { useRef } from 'react'; 
import type { Todo, UndoableActionDetails } from '../../types';

import { useSaveFeedback } from '../../hooks/useSaveFeedback';
import { useTodoEditing } from '../../hooks/useTodoEditing';
import { useUndoTimers } from '../../hooks/useUndoTimers';

import { TodoDisplay } from './TodoDisplay';
import { TodoActions } from './TodoActions';
import { UndoBanner } from './UndoBanner';

import { Trash2, Undo2 } from 'lucide-react';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void; 
  onUpdateText: (id: number, newText: string) => void;
  undoableAction: UndoableActionDetails | null;
  onUndo: (id: number) => void;
  undoTimeoutDuration: number;
  onRestoreDuringGracePeriod?: (id: number) => void; 
  currentTime?: number;
}

export function TodoItem({ 
  todo, 
  onToggle, 
  onRemove, 
  onUpdateText, 
  undoableAction, 
  onUndo, 
  undoTimeoutDuration,
  onRestoreDuringGracePeriod,
  currentTime
}: TodoItemProps) {
  const itemRef = useRef<HTMLLIElement>(null);
  const justSaved = useSaveFeedback(todo.text, todo.completed);

  const {
    stage1UndoCountdown,
    stage2GraceCountdown,
    isStage1UndoActive,
    isStage2GraceActive
  } = useUndoTimers({
    todo,
    undoableAction,
    currentTime,
    undoTimeoutDuration,
    onRestoreDuringGracePeriod
  });

  const isUndoOrGraceActive = isStage1UndoActive || isStage2GraceActive;

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
    isUndoOrGraceActive: isUndoOrGraceActive
  });

  const isInteractive = !isUndoOrGraceActive;

  const handleToggleCompletion = () => {
    if (!isInteractive || todo.isDeleted) return;
    onToggle(todo.id);
  }

  const checkboxId = `todo-item-checkbox-${todo.id}`;
  const labelId = `todo-item-label-${todo.id}`;
  
  const cardClasses = [
    'bg-slate-700',
    'border-slate-600',
    'hover:shadow-lg',
    'focus-within:shadow-lg focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-800',
    'transition-all duration-300',
    'w-full',
    (todo.isDeleted && !isUndoOrGraceActive) ? 'opacity-70' : '',
    isStage1UndoActive ? 'opacity-90 ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-800 animate-pulseSlow' : '',
    isStage2GraceActive ? 'opacity-90 ring-2 ring-red-500 ring-offset-2 ring-offset-slate-800 animate-pulse' : '',
    justSaved && isInteractive ? 'border-sky-500 shadow-sky-md' : 'border-slate-600',
  ].join(' ');

  const showEditButton = !isEditing && !todo.isDeleted && isInteractive;
  const showMainActionButtons = !isUndoOrGraceActive;

  let primaryActionIcon, primaryActionLabel, primaryActionTitle, onPrimaryAction;
  if (todo.isDeleted) {
    primaryActionIcon = <Undo2 size={16} />;
    primaryActionLabel = `Restore task: ${todo.text}`;
    primaryActionTitle = `Restore task: ${todo.text}`;
    onPrimaryAction = () => onUndo(todo.id); 
  } else {
    primaryActionIcon = <Trash2 size={16} />;
    primaryActionLabel = `Delete task: ${todo.text}`;
    primaryActionTitle = `Delete task: ${todo.text}`;
    onPrimaryAction = () => onRemove(todo.id);
  }

  if (!todo) return null;

  return (
    <li 
      ref={itemRef}
      aria-labelledby={labelId}
      tabIndex={-1}
      className="list-none w-full flex"
    >
      <Card className={cardClasses}> {/* Corrected this line */}
        <CardContent className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <Image
              src={`https://picsum.photos/seed/${todo.id}/60`}
              alt={`Task image for: ${todo.text}`}
              width={60}
              height={60}
              className="rounded-md mr-3 sm:mr-4 flex-shrink-0 object-cover"
              priority={false}
            />
            <div className="flex flex-col flex-grow min-w-0">
              <TodoDisplay
                todoId={todo.id}
                todoText={todo.text}
                todoCompleted={todo.completed}
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
                isDeleted={todo.isDeleted}
                isUndoOrGraceActive={isUndoOrGraceActive}
              />
            </div>
            <TodoActions
              todoText={todo.text}
              isInteractive={isInteractive}
              showEditButton={showEditButton}
              showMainActionButtons={showMainActionButtons}
              onEdit={startEditing}
              onPrimaryAction={onPrimaryAction}
              primaryActionIcon={primaryActionIcon}
              primaryActionLabel={primaryActionLabel}
              primaryActionTitle={primaryActionTitle}
            />
          </div>
          
          <UndoBanner 
            isStage1UndoActive={isStage1UndoActive}
            stage1UndoCountdown={stage1UndoCountdown}
            onUndo={() => onUndo(todo.id)}
            isStage2GraceActive={isStage2GraceActive}
            stage2GraceCountdown={stage2GraceCountdown}
            onRestoreDuringGracePeriod={onRestoreDuringGracePeriod ? () => onRestoreDuringGracePeriod(todo.id) : undefined}
            todoText={todo.text}
          />
        </CardContent>
      </Card>
    </li>
  );
}
