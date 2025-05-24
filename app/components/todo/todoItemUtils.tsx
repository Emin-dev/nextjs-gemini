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
  onRestorePendingDeletion?: (id: number) => void;
  onUndo?: (id: number) => void;
  onRemove: (id: number) => void;
  currentFilter: FilterValue;
  undoableAction: UndoableActionDetails | null;
}): PrimaryActionDetails {
  // Case 1: Task is in 'Deleted' filter AND is in the red border phase (pending final deletion)
  if (isRedBorderPhase && onRestorePendingDeletion && currentFilter === 'deleted') {
    return {
      icon: <RotateCcw size={16} />, // Icon for undoing final deletion (from banner)
      label: `Undo permanent delete for: ${todo.text}`,
      title: `Undo permanent delete (${redBorderCountdown}s left)`,
      onAction: () => onRestorePendingDeletion(todo.id),
      disabled: false,
      type: 'undo-pending-deletion',
    };
  } 
  // Case 2: Task has an active Stage 1 Undo (yellow banner, recently soft-deleted)
  // This icon is for the button that appears *next* to the item, not in the banner itself.
  // The banner itself for Stage 1 doesn't have an icon *in* its button by default from previous changes.
  // We will set icon to null here to ensure no separate icon appears next to the item if a banner is active.
  else if (isStage1UndoActive && onUndo) {
    return {
      icon: null, 
      label: `Undo delete for: ${todo.text}`,
      title: `Undo delete (${stage1UndoCountdown}s left)`,
      onAction: () => onUndo(todo.id),
      disabled: true, // Disabled because the action is primarily via the banner
      type: 'undo-initial-delete',
    };
  } 
  // Case 3: Task is in 'Deleted' filter, NOT in red border phase, and NO stage 1 undo banner is active
  else if (todo.isDeleted && !isRedBorderPhase && !isStage1UndoActive && currentFilter === 'deleted') {
    // Sub-case 3.1: If an undoable action of type 'restore' is active for this item (meaning user just restored then undid restore)
    if (undoableAction && undoableAction.actionType === 'restore' && undoableAction.id === todo.id && onUndo) {
      return {
        icon: <Trash2 size={16} />, // Re-delete icon if restoring was undone
        label: `Undo restoration of: ${todo.text}`,
        title: `Undo restoration (re-deletes task to trash)`,
        onAction: () => onUndo(todo.id), // This would re-trigger the delete
        disabled: false,
        type: 'initial-delete',
      };
    } 
    // Sub-case 3.2: Standard item in 'Deleted' filter, no active undo banners for it.
    // REMOVING THE INDIVIDUAL RESTORE ICON HERE as per user request.
    // An Edit button might still be shown by TodoActions.tsx if applicable.
    return { 
      icon: null, // No icon for primary action on a standard deleted item
      label: 'Task is in trash', // Generic label
      title: 'Task is in trash', // Generic title
      onAction: () => {}, // No direct primary action icon/button
      disabled: true, // Primary action disabled
      type: 'disabled', // Type is 'disabled'
    };
  } 
  // Case 4: Task is NOT deleted, NOT in red border phase, and NO stage 1 undo banner is active (standard active/completed task)
  else if (!todo.isDeleted && !isRedBorderPhase && !isStage1UndoActive) {
    return {
      icon: <Trash2 size={16} />,
      label: `Delete task: ${todo.text}`,
      title: `Delete task`,
      onAction: () => onRemove(todo.id),
      disabled: false,
      type: 'initial-delete',
    };
  }

  // Fallback: No specific action defined for the current state/filter combination
  return {
    icon: null, // Default to no icon
    label: 'No action',
    title: 'No action available in this state/filter',
    onAction: () => {},
    disabled: true,
    type: 'disabled',
  };
}
