'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { KeyboardEvent, RefObject } from 'react';

interface TodoDisplayProps {
  todoId: number;
  todoText: string;
  todoCompleted: boolean;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (newText: string) => void;
  onToggleCompletion: () => void;
  onSaveEdit: () => void;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onLabelDoubleClick: () => void;
  onLabelKeyDown: (e: KeyboardEvent<HTMLLabelElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>; // Changed to allow null
  checkboxId: string;
  labelId: string;
  isInteractive: boolean;
  isDeleted?: boolean; 
  isUndoOrGraceActive: boolean; // To adjust styling/behavior if needed

}

export function TodoDisplay({
  todoId,
  todoText,
  todoCompleted,
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
  isInteractive,
  isDeleted,
  isUndoOrGraceActive
}: TodoDisplayProps) {

  return (
    <div className="flex items-center mb-1">
      <Checkbox
        id={checkboxId}
        checked={todoCompleted}
        onCheckedChange={onToggleCompletion}
        className="mr-2 sm:mr-3 border-slate-500 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600 flex-shrink-0 h-5 w-5 focus:ring-sky-500 focus:ring-offset-slate-800"
        aria-label={todoCompleted ? `Mark task "${todoText}" as incomplete` : `Mark task "${todoText}" as complete`}
        disabled={!isInteractive || isDeleted}
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
          disabled={!isInteractive} // Editing disabled if not interactive
          aria-label={`Edit text for task: ${todoText}`}
          id={labelId} // The input becomes the label during editing for ARIA
        />
      ) : (
        <label
          id={labelId}
          htmlFor={isInteractive && !isDeleted ? checkboxId : undefined}
          className={`text-slate-200 text-base sm:text-lg truncate 
            ${todoCompleted && !isDeleted && !isUndoOrGraceActive ? 'line-through text-slate-400' : ''} 
            ${(!isInteractive || isDeleted) ? 'text-slate-500 cursor-not-allowed' : 'cursor-pointer hover:text-slate-100'}`}
          onDoubleClick={onLabelDoubleClick}
          onKeyDown={onLabelKeyDown}
          tabIndex={isInteractive && !isDeleted ? 0 : -1}
          title={todoText}
        >
          {todoText}
        </label>
      )}
    </div>
  );
}
