import type React from 'react';
import type { Todo, UndoableActionDetails, FilterValue } from '../../types';
import type { PrimaryActionType } from './TodoActions';
import { RotateCcw, Undo2, Trash2, type LucideProps } from 'lucide-react';

export interface PrimaryActionDetails {
  icon: React.ReactElement<LucideProps> | null; 
  label: string;
  title: string;
  onAction: () => void;
  disabled: boolean;
  type: PrimaryActionType;
}

// New prop for restoring an individual item from the 'Deleted' filter
interface GetPrimaryActionDetailsProps {
  todo: Todo;
  isRedBorderPhase: boolean;
  redBorderCountdown: string; // Now expecting string
  isStage1UndoActive: boolean;
  stage1UndoCountdown: string; // Now expecting string
  onRestorePendingDeletion?: (id: number) => void;
  onUndo?: (id: number) => void;
  onRemove: (id: number) => void;
  onRestoreItem?: (id: number) => void; // Handler for individual item restore
  currentFilter: FilterValue;
  undoableAction: UndoableActionDetails | null;
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
  onRestoreItem, // Destructure new prop
  currentFilter,
  undoableAction,
}: GetPrimaryActionDetailsProps): PrimaryActionDetails {
  // Case 1: Task is in 'Deleted' filter AND is in the red border phase (pending final deletion)
  if (isRedBorderPhase && onRestorePendingDeletion && currentFilter === 'deleted') {
    return {
      icon: <RotateCcw size={18} />, 
      label: `Undo permanent delete for: ${todo.text}`,
      title: `Undo permanent delete (${redBorderCountdown} left)`,
      onAction: () => onRestorePendingDeletion(todo.id),
      disabled: false,
      type: 'undo-pending-deletion',
    };
  } 
  // Case 2: Task has an active Stage 1 Undo (yellow inline button now)
  // This case is now primarily handled by TodoActions itself if isStage1UndoActive is true.
  // getPrimaryActionDetails might not be called or its result ignored if Stage 1 Undo is active in TodoActions.
  // However, to be safe, if it *were* called, we define a state.
  else if (isStage1UndoActive && onUndo) {
    return {
      icon: null, // The action is the yellow button itself, not a separate icon here.
      label: `Undo delete for: ${todo.text}`,
      title: `Undo delete (${stage1UndoCountdown} left)`,
      onAction: () => onUndo(todo.id),
      disabled: true, // The main action is through the dedicated yellow button in TodoActions
      type: 'undo-initial-delete',
    };
  } 
  // Case 3: Task is in 'Deleted' filter, NOT in red border phase, and NO stage 1 undo is active
  else if (todo.isDeleted && !isRedBorderPhase && !isStage1UndoActive && currentFilter === 'deleted') {
    // Sub-case 3.1: If an undoable action of type 'restore' is active for this item (meaning user just restored then undid restore)
    if (undoableAction && undoableAction.actionType === 'restore' && undoableAction.id === todo.id && onUndo) {
      return {
        icon: <Trash2 size={18} />, 
        label: `Undo restoration of: ${todo.text}`,
        title: `Undo restoration (re-deletes task)`,
        onAction: () => onUndo(todo.id), 
        disabled: false,
        type: 'initial-delete',
      };
    } 
    // Sub-case 3.2: Standard item in 'Deleted' filter. PROVIDE RESTORE OPTION.
    if (onRestoreItem) { // Check if the handler is provided
      return { 
        icon: <Undo2 size={18} />, 
        label: `Restore task: ${todo.text}`,
        title: 'Restore task',
        onAction: () => onRestoreItem(todo.id),
        disabled: false, 
        type: 'restore-from-trash',
      };
    }
    // Fallback for 3.2 if onRestoreItem is somehow not passed (should not happen)
    return { 
      icon: null, 
      label: 'Task is deleted', 
      title: 'Task is deleted', 
      onAction: () => {}, 
      disabled: true, 
      type: 'disabled',
    };
  } 
  // Case 4: Task is NOT deleted, NOT in red border phase, and NO stage 1 undo banner is active (standard active/completed task)
  else if (!todo.isDeleted && !isRedBorderPhase && !isStage1UndoActive) {
    return {
      icon: <Trash2 size={18} />,
      label: `Delete task: ${todo.text}`,
      title: `Delete task`,
      onAction: () => onRemove(todo.id),
      disabled: false,
      type: 'initial-delete',
    };
  }

  // Fallback: No specific action defined
  return {
    icon: null, 
    label: 'No action',
    title: 'No action available',
    onAction: () => {},
    disabled: true,
    type: 'disabled',
  };
}
