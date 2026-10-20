'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit3, RotateCcw, type LucideProps } from 'lucide-react'; // Added RotateCcw for Undo icon

export type PrimaryActionType = 'initial-delete' | 'restore-from-trash' | 'undo-pending-deletion' | 'disabled' | 'undo-initial-delete';

interface TodoActionsProps {
  todoText: string;
  isInteractive: boolean;
  showEditButton: boolean;
  showMainActionButtons: boolean;
  onEdit: () => void;
  onPrimaryAction: () => void;
  primaryActionIcon: React.ReactElement<LucideProps> | null;
  primaryActionLabel: string;
  primaryActionTitle: string;
  primaryActionDisabled?: boolean;
  primaryActionType: PrimaryActionType;

  // Props for Stage 1 Undo (Yellow Button)
  isStage1UndoActive?: boolean;
  stage1UndoCountdown?: string;
  onStage1Undo?: () => void; // Handler for the yellow undo button
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
  primaryActionType,
  isStage1UndoActive,
  stage1UndoCountdown,
  onStage1Undo,
}: TodoActionsProps) {

  if (isStage1UndoActive && onStage1Undo) {
    return (
      <div className="flex items-center justify-center self-start ml-1 sm:ml-2 h-full" data-no-toggle>
        <Button
          variant="default" // Solid button
          size="sm"      // Small size
          onClick={onStage1Undo}
          className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold focus:ring-yellow-400 focus:ring-offset-slate-800 h-9 px-3 whitespace-nowrap"
          aria-label={`Undo delete for task: ${todoText} (${stage1UndoCountdown} remaining)`}
          title={`Undo delete (${stage1UndoCountdown} remaining)`}
        >
          <RotateCcw size={16} className="mr-1.5" />
          Undo ({stage1UndoCountdown})
        </Button>
      </div>
    );
  }

  let buttonColorClasses = 'text-red-400 hover:text-red-300 focus:ring-red-500'; 
  if (primaryActionType === 'restore-from-trash' || primaryActionType === 'undo-initial-delete') { 
    buttonColorClasses = 'text-yellow-400 hover:text-yellow-300 focus:ring-yellow-500';
  } else if (primaryActionType === 'undo-pending-deletion') {
    buttonColorClasses = 'text-green-400 hover:text-green-300 focus:ring-green-500';
  } else if (primaryActionType === 'disabled') {
    buttonColorClasses = 'text-slate-500'; 
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 self-start ml-1 sm:ml-2 h-full" data-no-toggle>
      {showEditButton && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onEdit}
          className="text-cyan-400 hover:text-cyan-300 p-1.5 h-auto w-auto focus:ring-cyan-500 focus:ring-offset-slate-800"
          aria-label={`Edit task: ${todoText}`}
          title={`Edit task: ${todoText}`}
          disabled={!isInteractive || primaryActionDisabled} 
        >
          <Edit3 size={18} />
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
            {primaryActionIcon && React.isValidElement(primaryActionIcon) ? 
              React.cloneElement(primaryActionIcon, { size: 18 }) : 
              primaryActionIcon}
          </Button>
      )}
    </div>
  );
}
