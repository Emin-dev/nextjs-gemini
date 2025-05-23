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
  // Fields for multi-stage deletion
  pendingFinalDeletionTimestamp?: number | null; // Timestamp for 1-min countdown (Stage 2)
  batchId?: string | null; // To group tasks for global restore (Stage 4)
}

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void; // This is for soft delete (Stage 1) or initiating restore from soft delete
  onUpdateText: (id: number, newText: string) => void;
  undoableAction: UndoableActionDetails | null; 
  onUndo: (id: number) => void; // For Stage 1 undo
  undoTimeoutDuration: number;
  // Props for Stage 2 (1-minute grace period)
  onRestoreDuringGracePeriod?: (id: number) => void; // New: For restoring during 1-min countdown
  currentTime?: number; // New: Passed down from page to help sync countdowns
}

// ... (rest of the icons and component logic will be updated later)

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
  const isStage2GraceActive = todo.isDeleted && todo.pendingFinalDeletionTimestamp && currentTime && currentTime < todo.pendingFinalDeletionTimestamp;

  // Effect for Stage 1 Undo Countdown (20 seconds)
  useEffect(() => {
    if (isStage1UndoActive) {
      setStage1UndoCountdown(undoTimeoutDuration / 1000);
      const interval = setInterval(() => {
        setStage1UndoCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isStage1UndoActive, todo.id, undoableAction, undoTimeoutDuration]);

  // Effect for Stage 2 Grace Period Countdown (1 minute)
  useEffect(() => {
    if (isStage2GraceActive && todo.pendingFinalDeletionTimestamp && currentTime) {
      const timeLeft = Math.max(0, Math.ceil((todo.pendingFinalDeletionTimestamp - currentTime) / 1000));
      setStage2GraceCountdown(timeLeft);
      
      if (timeLeft > 0) {
        const interval = setInterval(() => {
          setStage2GraceCountdown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              // Parent component (page.tsx) will handle actual removal based on timestamp
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [isStage2GraceActive, todo.pendingFinalDeletionTimestamp, currentTime]);


  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && todo.text !== editText) {
      setEditText(todo.text);
    }
  // Removed editText from the dependency array
  }, [todo.text, isEditing]);

  useEffect(() => {
    if (todo.text !== prevTodoText.current || todo.completed !== prevTodoCompleted.current) {
      if ( (todo.text !== prevTodoText.current && prevTodoText.current !== undefined) || 
           (todo.completed !== prevTodoCompleted.current && prevTodoCompleted.current !== undefined)){
        setJustSaved(true);
        const timer = setTimeout(() => setJustSaved(false), SAVE_FEEDBACK_DURATION);
        prevTodoText.current = todo.text;
        prevTodoCompleted.current = todo.completed;
        return () => clearTimeout(timer);
      }
    }
    prevTodoText.current = todo.text;
    prevTodoCompleted.current = todo.completed;
  }, [todo.text, todo.completed]);

  const handleToggle = () => {
    if (isStage1UndoActive || isStage2GraceActive) return; // Prevent toggle if in undo/grace
    onToggle(todo.id);
  }

  const handleSave = () => {
    const trimmedText = editText.trim();
    setIsEditing(false);
    if (trimmedText === '') {
      if (!isStage1UndoActive && !isStage2GraceActive) onRemove(todo.id); // Soft delete if empty
    } else if (trimmedText !== todo.text) {
      if (!isStage1UndoActive && !isStage2GraceActive) onUpdateText(todo.id, trimmedText);
    } 
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
    } else if (e.key === 'Escape') {
      setEditText(todo.text);
      setIsEditing(false);
    }
  };
  
  const handleLabelKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!todo.isDeleted && !isStage1UndoActive && !isStage2GraceActive) {
        setEditText(todo.text);
        setIsEditing(true);
      }
    }
  };

  const checkboxId = `todo-item-checkbox-${todo.id}`;
  const labelId = `todo-item-label-${todo.id}`;
  
  const cardClasses = [
    'bg-slate-700',
    'border-slate-600',
    'hover:shadow-lg',
    'focus-within:shadow-lg focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-800',
    'transition-all',
    'duration-300',
    (todo.isDeleted || isStage1UndoActive) ? 'opacity-70' : '',
    justSaved && !isStage1UndoActive && !isStage2GraceActive ? 'border-sky-500 shadow-sky-md' : 'border-slate-600',
    isStage1UndoActive ? 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-slate-800' : '',
    isStage2GraceActive ? 'ring-2 ring-red-600 ring-offset-2 ring-offset-slate-800 animate-pulse' : ''
  ].join(' ');

  const showEditButton = !isEditing && !todo.isDeleted && !isStage1UndoActive && !isStage2GraceActive;
  // The main remove/restore button logic:
  // 1. If Stage 1 Undo is active: Hide this button (Undo button shown below)
  // 2. If Stage 2 Grace is active: Hide this button (Restore button shown below)
  // 3. If task is soft-deleted (and not in Stage 1 or 2): Show RestoreIcon (calls onRemove which flips isDeleted)
  // 4. If task is active: Show RemoveIcon (calls onRemove to start Stage 1)
  const showMainActionButtons = !isStage1UndoActive && !isStage2GraceActive;

  return (
    <Card<"li"> 
      as="li"
      ref={itemRef}
      className={cardClasses}
      aria-labelledby={labelId}
      tabIndex={-1}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center flex-grow min-w-0">
            {/* Image can be optional or have a placeholder if needed */}
            <Image
              src={`https://picsum.photos/seed/${todo.id}/600`}
              alt={todo.isDeleted ? `Image for deleted task: ${todo.text}` : `Image for task: ${todo.text}`}
              width={100}
              height={100}
              className="rounded-lg mr-4 flex-shrink-0 object-cover"
              priority={false}
            />
            <div className="flex flex-col flex-grow min-w-0">
              <div className="flex items-center mb-1">
                <Checkbox
                  id={checkboxId}
                  checked={todo.completed}
                  onCheckedChange={handleToggle}
                  className="mr-3 border-slate-500 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600 flex-shrink-0 h-5 w-5 focus:ring-sky-500 focus:ring-offset-slate-800"
                  aria-label={todo.completed ? `Mark task "${todo.text}" as incomplete` : `Mark task "${todo.text}" as complete`}
                  disabled={!!todo.isDeleted || isStage1UndoActive || isStage2GraceActive || isEditing}
                />
                {isEditing ? (
                  <Input
                    ref={inputRef}
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSave} // handleSave checks if already in undo/grace
                    onKeyDown={handleInputKeyDown}
                    className="flex-grow bg-slate-600 border-slate-500 text-white h-9 text-base p-2 rounded focus:ring-sky-500 focus:border-sky-500"
                    disabled={!!todo.isDeleted || isStage1UndoActive || isStage2GraceActive} 
                    aria-label={`Edit text for task: ${todo.text}`}
                    id={labelId}
                  />
                ) : (
                  <label
                    id={labelId}
                    htmlFor={checkboxId} // Clicking label toggles checkbox, if not disabled
                    className={`text-slate-200 text-lg 
                      ${todo.completed && !isStage2GraceActive ? 'line-through text-slate-500' : ''} 
                      ${(!!todo.isDeleted || isStage1UndoActive || isStage2GraceActive) ? 'text-slate-500 cursor-not-allowed' : 'cursor-pointer hover:text-slate-100'}`}
                    onDoubleClick={() => {
                        if (!todo.isDeleted && !isStage1UndoActive && !isStage2GraceActive) {
                            setEditText(todo.text); setIsEditing(true);
                        }
                    }}
                    onKeyDown={handleLabelKeyDown}
                    tabIndex={(!!todo.isDeleted || isStage1UndoActive || isStage2GraceActive) ? -1 : 0}
                    title={todo.text}
                  >
                    {todo.text}
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-start gap-1 self-start ml-2">
            {showEditButton && (
               <Button 
                  variant="ghost" 
                  onClick={() => { setEditText(todo.text); setIsEditing(true); }}
                  className="text-sky-400 hover:text-sky-300 p-2 h-auto focus:ring-sky-500 focus:ring-offset-slate-800"
                  aria-label={`Edit task: ${todo.text}`}
                  title={`Edit task: ${todo.text}`}
               >
                 <EditIcon />
               </Button>
            )}
            {showMainActionButtons && (
                <Button
                  onClick={() => onRemove(todo.id)} // For soft-delete or for restoring from soft-delete
                  variant="ghost"
                  className={`p-2 h-auto focus:ring-offset-slate-800 
                    ${todo.isDeleted ? 'text-yellow-400 hover:text-yellow-300 focus:ring-yellow-500' /* Restore from soft delete */ 
                                     : 'text-red-400 hover:text-red-300 focus:ring-red-500' /* Soft delete */}`}
                  aria-label={todo.isDeleted ? `Restore task: ${todo.text}` : `Delete task: ${todo.text}`}
                  title={todo.isDeleted ? `Restore task: ${todo.text}` : `Delete task: ${todo.text}`}
                >
                  {todo.isDeleted ? <RestoreIcon /> : <RemoveIcon />}
                </Button>
            )}
          </div>
        </div>

        {/* Stage 1: Soft Delete Undo Prompt (20s) */}
        {isStage1UndoActive && (
          <div className="mt-2 p-3 bg-yellow-900/60 border border-yellow-700 rounded-md flex justify-between items-center animate-pulseSlow">
            <p className="text-sm text-yellow-200">
              Deleting in {stage1UndoCountdown}s...
            </p>
            <Button 
              onClick={() => onUndo(todo.id)} 
              variant="outline"
              size="sm"
              className="text-yellow-200 border-yellow-400 hover:bg-yellow-700 hover:text-yellow-100 focus:ring-yellow-500"
            >
              Undo Delete
            </Button>
          </div>
        )}

        {/* Stage 2: Grace Period Restore Prompt (1 min) */}
        {isStage2GraceActive && onRestoreDuringGracePeriod && (
          <div className="mt-2 p-3 bg-red-900/70 border border-red-700 rounded-md flex justify-between items-center animate-pulse">
            <p className="text-sm text-red-200">
              Final deletion in {stage2GraceCountdown}s...
            </p>
            <Button 
              onClick={() => onRestoreDuringGracePeriod(todo.id)} 
              variant="outline"
              size="sm"
              className="text-red-200 border-red-400 hover:bg-red-700 hover:text-red-100 focus:ring-red-500"
            >
              Restore Task
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
