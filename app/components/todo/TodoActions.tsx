'use client';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Edit3 } from 'lucide-react';

interface TodoActionsProps {
  todoText: string;
  isInteractive: boolean;
  showEditButton: boolean;
  showMainActionButtons: boolean;
  onEdit: () => void;
  onPrimaryAction: () => void;
  primaryActionIcon: React.ReactElement; // Changed from JSX.Element
  primaryActionLabel: string;
  primaryActionTitle: string;
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
}: TodoActionsProps) {

  if (!showEditButton && !showMainActionButtons) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-start gap-1 self-start ml-1 sm:ml-2">
      {showEditButton && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onEdit}
          className="text-sky-400 hover:text-sky-300 p-1.5 h-auto w-auto focus:ring-sky-500 focus:ring-offset-slate-800"
          aria-label={`Edit task: ${todoText}`}
          title={`Edit task: ${todoText}`}
          disabled={!isInteractive}
        >
          <Edit3 size={16} />
        </Button>
      )}
      {showMainActionButtons && (
          <Button
            onClick={onPrimaryAction} 
            variant="ghost"
            size="icon"
            className={`p-1.5 h-auto w-auto focus:ring-offset-slate-800 
              ${primaryActionLabel.toLowerCase().includes('restore') || primaryActionLabel.toLowerCase().includes('undo') 
                ? 'text-yellow-400 hover:text-yellow-300 focus:ring-yellow-500' 
                : 'text-red-400 hover:text-red-300 focus:ring-red-500'}`}
            aria-label={primaryActionLabel}
            title={primaryActionTitle}
            disabled={!isInteractive}
          >
            {primaryActionIcon}
          </Button>
      )}
    </div>
  );
}
