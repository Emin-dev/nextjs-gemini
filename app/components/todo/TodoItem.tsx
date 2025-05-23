'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { UndoableActionDetails } from '../../page';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  isDeleted?: boolean;
  pendingFinalDeletionTimestamp?: number | null;
  batchId?: string | null;
}

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
  const itemRef = useRef<HTMLDivElement>(null);
  
  const [stage1UndoCountdown, setStage1UndoCountdown] = useState(0);
  const [stage2GraceCountdown, setStage2GraceCountdown] = useState(0);

  const isStage1UndoActive = undoableAction?.id === todo.id && undoableAction?.actionType === 'delete';
  const isStage2GraceActive = !!(todo.isDeleted && todo.pendingFinalDeletionTimestamp && currentTime && currentTime < todo.pendingFinalDeletionTimestamp && onRestoreDuringGracePeriod);

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

  useEffect(() => {
    if (isStage2GraceActive && todo.pendingFinalDeletionTimestamp && currentTime) {
      const timeLeft = Math.max(0, Math.ceil((todo.pendingFinalDeletionTimestamp - currentTime) / 1000));
      setStage2GraceCountdown(timeLeft);
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
      if (prevTodoText.current !== undefined || prevTodoCompleted.current !== undefined) { 
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

  const isInteractive = !isStage1UndoActive && !isStage2GraceActive; // Corrected: This line was fine, the typo was below.

  const handleToggle = () => {
    if (!isInteractive || todo.isDeleted) return;
    onToggle(todo.id);
  }

  const handleSave = () => {
    if (!isInteractive) return;
    const trimmedText = editText.trim();
    setIsEditing(false);
    if (trimmedText === '') {
      onRemove(todo.id); 
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
    // Corrected typo: isinteractive -> isInteractive, todo.isdeleted -> todo.isDeleted, e.preventdefault -> e.preventDefault, setedittext -> setEditText, setisediting -> setIsEditing
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
    'w-full',
    (todo.isDeleted && !isStage1UndoActive && !isStage2GraceActive) ? 'opacity-70' : '',
    isStage1UndoActive ? 'opacity-90 ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-800 animate-pulseSlow' : '',
    isStage2GraceActive ? 'opacity-90 ring-2 ring-red-500 ring-offset-2 ring-offset-slate-800 animate-pulse' : '',
    justSaved && isInteractive ? 'border-sky-500 shadow-sky-md' : 'border-slate-600',
  ].join(' ');

  const showEditButton = !isEditing && !todo.isDeleted && isInteractive;
  const showMainActionButtons = !isStage1UndoActive && !isStage2GraceActive;

  // Drastically simplified return for debugging
  if (todo) { // Ensure todo is defined to prevent errors with todo.text
    return (
      <div ref={itemRef} className="w-full flex">
        Simple test for {todo.text}
      </div>
    );
  }
  return null; // Fallback if todo is somehow undefined

}
