'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit3 } from 'lucide-react';

// Define the type for primaryActionType
export type PrimaryActionType = 'initial-delete' | 'restore-from-trash' | 'undo-pending-deletion' | 'disabled';

interface TodoActionsProps {
  todoText: string;
  isInteractive: boolean;
  showEditButton: boolean;
  showMainActionButtons: boolean;
  onEdit: () => void;
  onPrimaryAction: () => void;
  primaryActionIcon: React.ReactElement;
  primaryActionLabel: string;
  primaryActionTitle: string;
  primaryActionDisabled?: boolean;
  primaryActionType: PrimaryActionType; // Added this prop
}

export function TodoActions({
  todoText,
  isInteractive,
  showEditButton,
  showMainActionButtons,
  onEdit,
  onPrimaryAction,
  primaryActionIcon,
  primaryActionLabel,
  primaryActionTitle,
  primaryActionDisabled = false,
  primaryActionType
}: TodoActionsProps) {

  let buttonColorClasses = 'text-red-400 hover:text-red-300 focus:ring-red-500'; // Default to delete color
  if (primaryActionType === 'restore-from-trash') {
    buttonColorClasses = 'text-yellow-400 hover:text-yellow-300 focus:ring-yellow-500';
  } else if (primaryActionType === 'undo-pending-deletion') {
    buttonColorClasses = 'text-green-400 hover:text-green-300 focus:ring-green-500';
  } else if (primaryActionType === 'disabled') {
    buttonColorClasses = 'text-slate-500'; // Or some other disabled styling
  }

  return (
    <div className="flex flex-col items-center justify-start gap-1 self-start ml-1 sm:ml-2" data-no-toggle>
      {showEditButton && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onEdit}
          className="text-sky-400 hover:text-sky-300 p-1.5 h-auto w-auto focus:ring-sky-500 focus:ring-offset-slate-800"
          aria-label={`Edit task: ${todoText}`}
          title={`Edit task: ${todoText}`}
          disabled={!isInteractive || primaryActionDisabled} 
        >
          <Edit3 size={16} />
        </Button>
      )}
      {showMainActionButtons && (
          <Button
            onClick={onPrimaryAction} 
            variant="ghost"
            size="icon"
            className={`p-1.5 h-auto w-auto focus:ring-offset-slate-800 ${buttonColorClasses} 
              ${primaryActionDisabled || !isInteractive ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={primaryActionLabel}
            title={primaryActionTitle}
            disabled={!isInteractive || primaryActionDisabled}
          >
            {primaryActionIcon}
          </Button>
      )}
    </div>
  );
}
