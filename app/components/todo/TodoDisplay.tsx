'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { KeyboardEvent, RefObject } from 'react';
import type { Todo } from '../../types'; // Import the Todo type

interface TodoDisplayProps {
  todo: Todo; // Use the Todo type
  isEditing: boolean;
  editText: string;
  onEditTextChange: (newText: string) => void;
  onToggleCompletion: () => void;
  onSaveEdit: () => void;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onLabelDoubleClick: () => void;
  onLabelKeyDown: (e: KeyboardEvent<HTMLLabelElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  checkboxId: string;
  labelId: string;
  isInteractive: boolean; // This prop might need re-evaluation or can be removed if not used for Input disabling
  isUndoOrDeletionPhaseActive: boolean;
}

export function TodoDisplay({
  todo,
  isEditing,
  editText,
  onEditTextChange,
  onToggleCompletion,
  onSaveEdit,
  onInputKeyDown,
  onLabelDoubleClick,
  onLabelKeyDown,
  inputRef,
  checkboxId,
  labelId,
  // isInteractive, // No longer directly used to disable the input when isEditing is true
  isUndoOrDeletionPhaseActive
}: TodoDisplayProps) {

  const isDisabled = !isEditing && (isUndoOrDeletionPhaseActive || todo.isDeleted || !!todo.markedForDeletionAt || !!todo.pendingFinalDeletionTimestamp);

  return (
    <div className="flex items-center mb-1">
      <Checkbox
        id={checkboxId}
        checked={todo.completed}
        onCheckedChange={onToggleCompletion}
        className="mr-2 sm:mr-3 border-slate-500 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600 flex-shrink-0 h-5 w-5 focus:ring-sky-500 focus:ring-offset-slate-800"
        aria-label={todo.completed ? `Mark task "${todo.text}" as incomplete` : `Mark task "${todo.text}" as complete`}
        disabled={isDisabled} // Checkbox is disabled if not interactive OR during deletion phases
      />
      {isEditing ? (
        <Input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={onInputKeyDown}
          className="flex-grow bg-slate-600 border-slate-500 text-white h-9 text-sm sm:text-base p-2 rounded focus:ring-sky-500 focus:border-sky-500"
          disabled={false} // Input is enabled when isEditing is true. Other logic prevents starting edit.
          aria-label={`Edit text for task: ${todo.text}`}
          id={labelId} 
        />
      ) : (
        <label
          id={labelId}
          htmlFor={!isDisabled ? checkboxId : undefined}
          className={`text-slate-200 text-base sm:text-lg truncate 
            ${todo.completed && !todo.isDeleted && !isUndoOrDeletionPhaseActive ? 'line-through text-slate-400' : ''} 
            ${isDisabled ? 'text-slate-500 cursor-not-allowed' : 'cursor-pointer hover:text-slate-100'}`}
          onDoubleClick={isDisabled ? undefined : onLabelDoubleClick}
          onKeyDown={isDisabled ? undefined : onLabelKeyDown}
          tabIndex={isDisabled ? -1 : 0}
          title={todo.text}
        >
          {todo.text}
        </label>
      )}
    </div>
  );
}
