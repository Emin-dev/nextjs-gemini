'use client';

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { FilterValue } from '../../types';

interface FilterOption {
  value: FilterValue;
  label: string;
}

interface TodoControlsProps {
  filter: FilterValue;
  onFilterChange: (value: FilterValue) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filterOptions: FilterOption[];
  isClient: boolean;
  initialLoadComplete: boolean;
  isActionInProgress: boolean; // Keep prop for potential future use or other conditional UI, but not for disabling filters/search
}

export function TodoControls({
  filter,
  onFilterChange,
  searchQuery,
  onSearchQueryChange,
  filterOptions,
  isClient,
  initialLoadComplete,
}: TodoControlsProps) {
  if (!isClient) return null;

  return (
    <div className="flex flex-col w-full">
      <RadioGroup
        value={filter}
        defaultValue="all"
        onValueChange={onFilterChange} // Filter changes are always allowed
        className="flex items-center p-1 bg-slate-700 rounded-lg shadow-sm w-full sm:w-auto justify-center mb-3 sm:mb-0"
        disabled={!initialLoadComplete} // Only disabled during initial load
        aria-labelledby="tasks-heading"
      >
        {filterOptions.map(option => (
          <Label
            key={option.value}
            htmlFor={`filter-${option.value}`}
            className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-sm sm:text-base rounded-md cursor-pointer transition-colors duration-150 ease-in-out whitespace-nowrap
                        ${filter === option.value
                          ? 'bg-cyan-600 text-white shadow-sm' 
                          : 'text-slate-300 hover:bg-slate-600'}
                        ${!initialLoadComplete ? 'opacity-50 cursor-not-allowed' : ''} // Visual cue for disabled state during load
                       `}
          >
            <RadioGroupItem
              value={option.value}
              id={`filter-${option.value}`}
              className="sr-only peer"
              disabled={!initialLoadComplete} // Radio items only disabled during initial load
            />
            {option.label}
          </Label>
        ))}
      </RadioGroup>
      <div className="w-full mt-3">
        <Input
          type="search"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)} // Search is always allowed
          className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-cyan-500 focus:border-cyan-500 text-base sm:text-lg w-full h-11 px-4 py-2"
          aria-label="Search tasks by keyword"
          disabled={!initialLoadComplete} // Search input only disabled during initial load
        />
      </div>
    </div>
  );
}
