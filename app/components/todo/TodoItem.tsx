'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { UndoableActionDetails } from '../../page'; // Adjusted path

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  isDeleted?: boolean;
  pendingFinalDeletionTimestamp?: number | null; // For Stage 2 grace period
  batchId?: string | null; // For Stage 2 & 4 batch tracking
}

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void; 
  onUpdateText: (id: number, newText: string) => void;
  undoableAction: UndoableActionDetails | null; // For Stage 1
  onUndo: (id: number) => void; // For Stage 1
  undoTimeoutDuration: number; // For Stage 1
  // New props for Stage 2 grace period
  onRestoreDuringGracePeriod?: (id: number) => void;
  currentTime?: number;
}

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-labelledby="editIconTitle">
    <title id="editIconTitle">Edit</title>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>
);

const RemoveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-labelledby="removeIconTitle">
    <title id="removeIconTitle">Remove</title>
    <path d="M3 6h18"></path>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const RestoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-labelledby="restoreIconTitle">
    <title id="restoreIconTitle">Restore</title>
    <polyline points="23 4 23 10 17 10"></polyline>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </svg>
);

const SAVE_FEEDBACK_DURATION = 1500;

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
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const [justSaved, setJustSaved] = useState(false);
  const prevTodoText = useRef(todo.text);
  const prevTodoCompleted = useRef(todo.completed);
  const itemRef = useRef<HTMLLIElement>(null);
  
  const [stage1UndoCountdown, setStage1UndoCountdown] = useState(0);
  const [stage2GraceCountdown, setStage2GraceCountdown] = useState(0);

  const isStage1UndoActive = undoableAction?.id === todo.id && undoableAction?.actionType === 'delete';
  const isStage2GraceActive = !!(todo.isDeleted && todo.pendingFinalDeletionTimestamp && currentTime && currentTime < todo.pendingFinalDeletionTimestamp && onRestoreDuringGracePeriod);

  // Effect for Stage 1 Undo Countdown
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

  // Effect for Stage 2 Grace Period Countdown
  useEffect(() => {
    if (isStage2GraceActive && todo.pendingFinalDeletionTimestamp && currentTime) {
      const timeLeft = Math.max(0, Math.ceil((todo.pendingFinalDeletionTimestamp - currentTime) / 1000));
      setStage2GraceCountdown(timeLeft);
      // No interval needed here as currentTime prop updates will trigger re-renders and re-calculation
    } else {
      setStage2GraceCountdown(0);
    }
  }, [isStage2GraceActive, todo.pendingFinalDeletionTimestamp, currentTime]);

  useEffect(() => {
    if (isEditing && !isStage1UndoActive && !isStage2GraceActive) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, isStage1UndoActive, isStage2GraceActive]);

  useEffect(() => {
    if (!isEditing && todo.text !== editText) {
      setEditText(todo.text);
    }
  }, [todo.text, isEditing, editText]);

  useEffect(() => {
    if (prevTodoText.current !== todo.text || prevTodoCompleted.current !== todo.completed) {
      if (prevTodoText.current !== undefined || prevTodoCompleted.current !== undefined) { // Avoid on initial mount
        setJustSaved(true);
        const timer = setTimeout(() => setJustSaved(false), SAVE_FEEDBACK_DURATION);
        prevTodoText.current = todo.text;
        prevTodoCompleted.current = todo.completed;
        return () => clearTimeout(timer);
      }
    }
    prevTodoText.current = todo.text; // Ensure refs are set on first render too
    prevTodoCompleted.current = todo.completed;
  }, [todo.text, todo.completed]);

  const isInteractive = !isStage1UndoActive && !isStage2GraceActive;

  const handleToggle = () => {
    if (!isInteractive) return;
    onToggle(todo.id);
  }

  const handleSave = () => {
    if (!isInteractive) return;
    const trimmedText = editText.trim();
    setIsEditing(false);
    if (trimmedText === '') {
      onRemove(todo.id); // Will trigger Stage 1 soft delete
    } else if (trimmedText !== todo.text) {
      onUpdateText(todo.id, trimmedText);
    } 
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') { setEditText(todo.text); setIsEditing(false); }
  };
  
  const handleLabelDoubleClick = () => {
    if (isInteractive && !todo.isDeleted) { setEditText(todo.text); setIsEditing(true); }
  };

  const handleLabelKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && isInteractive && !todo.isDeleted) {
      e.preventDefault(); setEditText(todo.text); setIsEditing(true);
    }
  };

  const checkboxId = `todo-item-checkbox-${todo.id}`;
  const labelId = `todo-item-label-${todo.id}`;
  
  const cardClasses = [
    'bg-slate-700',
    'border-slate-600',
    'hover:shadow-lg',
    'focus-within:shadow-lg focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-800',
    'transition-all duration-300',
    (todo.isDeleted && !isStage1UndoActive && !isStage2GraceActive) ? 'opacity-60' : '',
    isStage1UndoActive ? 'opacity-80 ring-2 ring-yellow-500 ring-offset-2 ring-offset-slate-800 animate-pulseSlow' : '',
    isStage2GraceActive ? 'opacity-80 ring-2 ring-red-600 ring-offset-2 ring-offset-slate-800 animate-pulse' : '',
    justSaved && isInteractive ? 'border-sky-500 shadow-sky-md' : 'border-slate-600',
  ].join(' ');

  const showEditButton = !isEditing && !todo.isDeleted && isInteractive;
  // Main action button visibility (delete/restore)
  const showMainActionButtons = !isStage1UndoActive && !isStage2GraceActive;

  return (
    <Card<"li"> 
      as="li"
      ref={itemRef}
      className={cardClasses}
      aria-labelledby={labelId}
      tabIndex={-1}
    >
      <CardContent className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center flex-grow min-w-0">
            <Image
              src={`https://picsum.photos/seed/${todo.id}/60`}
              alt={todo.isDeleted ? `Task image: ${todo.text}` : `Task image: ${todo.text}`}
              width={60}
              height={60}
              className="rounded-md mr-3 sm:mr-4 flex-shrink-0 object-cover"
              priority={false}
            />
            <div className="flex flex-col flex-grow min-w-0">
              <div className="flex items-center mb-1">
                <Checkbox
                  id={checkboxId}
                  checked={todo.completed}
                  onCheckedChange={handleToggle}
                  className="mr-2 sm:mr-3 border-slate-500 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600 flex-shrink-0 h-5 w-5 focus:ring-sky-500 focus:ring-offset-slate-800"
                  aria-label={todo.completed ? `Mark task "${todo.text}" as incomplete` : `Mark task "${todo.text}" as complete`}
                  disabled={!isInteractive || todo.isDeleted}
                />
                {isEditing ? (
                  <Input
                    ref={inputRef}
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleInputKeyDown}
                    className="flex-grow bg-slate-600 border-slate-500 text-white h-9 text-sm sm:text-base p-2 rounded focus:ring-sky-500 focus:border-sky-500"
                    disabled={!isInteractive}
                    aria-label={`Edit text for task: ${todo.text}`}
                    id={labelId}
                  />
                ) : (
                  <label
                    id={labelId}
                    htmlFor={isInteractive && !todo.isDeleted ? checkboxId : undefined}
                    className={`text-slate-200 text-base sm:text-lg truncate 
                      ${todo.completed && !isStage1UndoActive && !isStage2GraceActive ? 'line-through text-slate-400' : ''} 
                      ${(!isInteractive || todo.isDeleted) ? 'text-slate-500 cursor-not-allowed' : 'cursor-pointer hover:text-slate-100'}`}
                    onDoubleClick={handleLabelDoubleClick}
                    onKeyDown={handleLabelKeyDown}
                    tabIndex={isInteractive && !todo.isDeleted ? 0 : -1}
                    title={todo.text}
                  >
                    {todo.text}
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-start gap-1 self-start ml-1 sm:ml-2">
            {showEditButton && (
               <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => { setEditText(todo.text); setIsEditing(true); }}
                  className="text-sky-400 hover:text-sky-300 p-1.5 h-auto w-auto focus:ring-sky-500 focus:ring-offset-slate-800"
                  aria-label={`Edit task: ${todo.text}`}
                  title={`Edit task: ${todo.text}`}
               >
                 <EditIcon />
               </Button>
            )}
            {showMainActionButtons && (
                <Button
                  onClick={() => onRemove(todo.id)} // Handles soft-delete or restore from soft-delete
                  variant="ghost"
                  size="icon"
                  className={`p-1.5 h-auto w-auto focus:ring-offset-slate-800 
                    ${todo.isDeleted ? 'text-yellow-400 hover:text-yellow-300 focus:ring-yellow-500' 
                                     : 'text-red-400 hover:text-red-300 focus:ring-red-500'}`}
                  aria-label={todo.isDeleted ? `Restore task: ${todo.text}` : `Delete task: ${todo.text}`}
                  title={todo.isDeleted ? `Restore task: ${todo.text}` : `Delete task: ${todo.text}`}
                >
                  {todo.isDeleted ? <RestoreIcon /> : <RemoveIcon />}
                </Button>
            )}
          </div>
        </div>

        {isStage1UndoActive && (
          <div className="mt-2 p-2 sm:p-3 bg-yellow-900/70 border border-yellow-700 rounded-md flex justify-between items-center animate-pulseSlow">
            <p className="text-xs sm:text-sm text-yellow-200">
              Marked for deletion. Undoing in {stage1UndoCountdown}s...
            </p>
            <Button 
              onClick={() => onUndo(todo.id)} 
              variant="outline"
              size="sm"
              className="text-yellow-100 border-yellow-400 hover:bg-yellow-700 hover:text-yellow-50 focus:ring-yellow-500 text-xs sm:text-sm px-2 py-1 h-auto"
            >
              Undo Delete
            </Button>
          </div>
        )}
        {isStage2GraceActive && onRestoreDuringGracePeriod && (
          <div className="mt-2 p-2 sm:p-3 bg-red-900/80 border border-red-700 rounded-md flex justify-between items-center animate-pulse">
            <p className="text-xs sm:text-sm text-red-200">
              Final deletion in {stage2GraceCountdown}s (Batch: {todo.batchId?.substring(6)})...
            </p>
            <Button 
              onClick={() => onRestoreDuringGracePeriod(todo.id)} 
              variant="outline"
              size="sm"
              className="text-red-100 border-red-400 hover:bg-red-700 hover:text-red-50 focus:ring-red-500 text-xs sm:text-sm px-2 py-1 h-auto"
            >
              Restore Task
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
