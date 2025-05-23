import React from 'react';
import type { Todo, UndoableActionDetails, FilterValue } from '../../types';
import type { PrimaryActionType } from './TodoActions';
import { RotateCcw, Undo2, Trash2 } from 'lucide-react';

export interface PrimaryActionDetails {
  icon: React.ReactElement | null; // Allow null for icon
  label: string;
  title: string;
  onAction: () => void;
  disabled: boolean;
  type: PrimaryActionType;
}

export function getPrimaryActionDetails({
  todo,
  isRedBorderPhase,
  redBorderCountdown,
  isStage1UndoActive,
  stage1UndoCountdown,
  onRestorePendingDeletion,
  onUndo,
  onRemove,
  currentFilter,
  undoableAction,
}: {
  todo: Todo;
  isRedBorderPhase: boolean;
  redBorderCountdown: number;
  isStage1UndoActive: boolean;
  stage1UndoCountdown: number;
  onRestorePendingDeletion?: (id: string) => void;
  onUndo?: (id: string) => void;
  onRemove: (id: string) => void;
  currentFilter: FilterValue;
  undoableAction: UndoableActionDetails | null;
}): PrimaryActionDetails {
  if (isRedBorderPhase && onRestorePendingDeletion && currentFilter === 'deleted') {
    return {
      icon: <RotateCcw size={16} />,
      label: `Undo permanent delete for: ${todo.text}`,
      title: `Undo permanent delete (${redBorderCountdown}s left)`,
      onAction: () => onRestorePendingDeletion(todo.id), // todo.id is string
      disabled: false,
      type: 'undo-pending-deletion',
    };
  } else if (isStage1UndoActive && onUndo) {
    return {
      icon: null, // Icon removed here
      label: `Undo delete for: ${todo.text}`,
      title: `Undo delete (${stage1UndoCountdown}s left)`,
      onAction: () => onUndo(todo.id), // todo.id is string
      disabled: false,
      type: 'undo-initial-delete',
    };
  } else if (todo.isDeleted && !isRedBorderPhase && currentFilter === 'deleted') {
    if (undoableAction && undoableAction.actionType === 'restore' && String(undoableAction.id) === String(todo.id) && onUndo) {
      return {
        icon: <Trash2 size={16} />,
        label: `Undo restoration of: ${todo.text}`,
        title: `Undo restoration (re-deletes task to trash)`,
        onAction: () => onUndo(todo.id), // todo.id is string
        disabled: false,
        type: 'initial-delete',
      };
    } else if (onUndo) {
      return {
        icon: <Undo2 size={16} />,
        label: `Restore task: ${todo.text}`,
        title: `Restore task from trash`,
        onAction: () => onUndo(todo.id), // todo.id is string
        disabled: false,
        type: 'restore-from-trash',
      };
    } 
    return { 
      icon: React.createElement('div'), // Using React.createElement for an empty div
      label: 'Task is deleted',
      title: 'Task is deleted',
      onAction: () => {},
      disabled: true,
      type: 'disabled'
    };
  } else if (!todo.isDeleted && !isRedBorderPhase && !isStage1UndoActive) {
    return {
      icon: <Trash2 size={16} />,
      label: `Delete task: ${todo.text}`,
      title: `Delete task`,
      onAction: () => onRemove(todo.id), // todo.id is string
      disabled: false,
      type: 'initial-delete',
    };
  }
  return {
    icon: React.createElement('div'), // Using React.createElement for an empty div
    label: 'No action',
    title: 'No action available in this state/filter',
    onAction: () => {},
    disabled: true,
    type: 'disabled',
  };
}
