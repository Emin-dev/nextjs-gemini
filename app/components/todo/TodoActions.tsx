'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit3 } from 'lucide-react';

// Define the type for primaryActionType
export type PrimaryActionType = 'initial-delete' | 'restore-from-trash' | 'undo-pending-deletion' | 'disabled' | 'undo-initial-delete';

interface TodoActionsProps {
  todoText: string;
  isInteractive: boolean;
  showEditButton: boolean;
  showMainActionButtons: boolean;
  onEdit: () => void;
  onPrimaryAction: () => void;
  primaryActionIcon: React.ReactElement | null; // Allow null for icon
  primaryActionLabel: string;
  primaryActionTitle: string;
  primaryActionDisabled?: boolean;
  primaryActionType: PrimaryActionType; 
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

  let buttonColorClasses = 'text-red-400 hover:text-red-300 focus:ring-red-500'; 
  if (primaryActionType === 'restore-from-trash' || primaryActionType === 'undo-initial-delete') { 
    buttonColorClasses = 'text-yellow-400 hover:text-yellow-300 focus:ring-yellow-500';
  } else if (primaryActionType === 'undo-pending-deletion') {
    buttonColorClasses = 'text-green-400 hover:text-green-300 focus:ring-green-500';
  } else if (primaryActionType === 'disabled') {
    buttonColorClasses = 'text-slate-500'; 
  }

  const commonButtonClasses = "p-2 h-auto w-auto focus:ring-offset-slate-800 active:scale-95 active:opacity-75 transition-transform duration-75";

  return (
    <div className="flex flex-col items-center justify-start gap-1.5 self-start ml-1 sm:ml-2" data-no-toggle>
      {showEditButton && (
        <Button 
          variant="ghost" 
          size="icon" // Size prop might be overridden by p-X and h-auto w-auto but kept for consistency with <Button>
          onClick={onEdit}
          className={`text-sky-400 hover:text-sky-300 focus:ring-sky-500 ${commonButtonClasses}`}
          aria-label={`Edit task: ${todoText}`}
          title={`Edit task: ${todoText}`}
          disabled={!isInteractive || primaryActionDisabled} 
        >
          <Edit3 size={20} /> {/* Increased icon size */}
        </Button>
      )}
      {showMainActionButtons && (
          <Button
            onClick={onPrimaryAction} 
            variant="ghost"
            size="icon"
            className={`${buttonColorClasses} ${commonButtonClasses} 
              ${primaryActionDisabled || !isInteractive ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={primaryActionLabel}
            title={primaryActionTitle}
            disabled={!isInteractive || primaryActionDisabled}
          >
            {primaryActionIcon && (typeof primaryActionIcon.type === 'function' ? React.cloneElement(primaryActionIcon, { ...primaryActionIcon.props, size: 20 }) : primaryActionIcon)} {/* Increased icon size */}
          </Button>
      )}
    </div>
  );
}
