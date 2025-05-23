'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';

interface UseTodoEditingParams {
  initialText: string;
  onUpdateText: (newText: string) => void;
  onRemove?: () => void; // Optional if empty text means removal
  isUndoOrGraceActive: boolean; // To disable editing features during undo/grace
}

export function useTodoEditing({
  initialText,
  onUpdateText,
  onRemove,
  isUndoOrGraceActive
}: UseTodoEditingParams) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(initialText);
  const inputRef = useRef<HTMLInputElement>(null);

  // Effect to update editText if the initialText (from todo.text) changes externally
  // and the user is not currently editing.
  useEffect(() => {
    if (!isEditing) {
      setEditText(initialText);
    }
  }, [initialText, isEditing]);

  // Effect to focus and select text when editing starts
  useEffect(() => {
    if (isEditing && !isUndoOrGraceActive) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, isUndoOrGraceActive]);

  const handleSave = () => {
    if (isUndoOrGraceActive) return;
    const trimmedText = editText.trim();
    setIsEditing(false);
    if (trimmedText === '' && onRemove) {
      onRemove();
    } else if (trimmedText !== initialText && trimmedText !== '') {
      onUpdateText(trimmedText);
    } else if (trimmedText === '' && !onRemove) {
      // If onRemove is not provided, and text is empty, revert to initial text
      setEditText(initialText); 
    }
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isUndoOrGraceActive) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(initialText);
      setIsEditing(false);
    }
  };

  const startEditing = () => {
    if (isUndoOrGraceActive) return;
    setEditText(initialText); // Reset to current todo text when starting edit
    setIsEditing(true);
  };

  return {
    isEditing,
    editText,
    setEditText,
    inputRef,
    handleSave,
    handleInputKeyDown,
    startEditing,
    setIsEditing // Exposing setIsEditing for more direct control if needed (e.g. blur from input)
  };
}
