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
  isActionInProgress: boolean; // To disable search if needed
}

export function TodoControls({
  filter,
  onFilterChange,
  searchQuery,
  onSearchQueryChange,
  filterOptions,
  isClient,
  initialLoadComplete,
  isActionInProgress
}: TodoControlsProps) {
  if (!isClient) return null; // Or a placeholder/skeleton

  return (
    <>
      <RadioGroup
        value={filter}
        defaultValue="all"
        onValueChange={onFilterChange}
        className="flex items-center p-1 bg-slate-700 rounded-lg shadow-sm w-full sm:w-auto justify-center mb-4 sm:mb-5" // Added bottom margin
        disabled={!initialLoadComplete}
        aria-labelledby="tasks-heading"
      >
        {filterOptions.map(option => (
          <Label 
            key={option.value} 
            htmlFor={`filter-${option.value}`} 
            className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-sm sm:text-base rounded-md cursor-pointer transition-colors duration-150 ease-in-out whitespace-nowrap
                        ${filter === option.value 
                          ? 'bg-sky-500 text-white shadow-sm' 
                          : 'text-slate-300 hover:bg-slate-600'}
                       `}
          >
            <RadioGroupItem 
              value={option.value} 
              id={`filter-${option.value}`} 
              className="sr-only peer" // Hide the actual radio button, make it accessible via peer
            />
            {option.label}
          </Label>
        ))}
      </RadioGroup>
      <div className="mb-2 mt-2"> {/* Adjusted margin here as well, RadioGroup now has mb-4 */}
        <Input
          type="search"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500 text-base sm:text-lg w-full h-11 sm:h-12 px-4 py-2.5"
          aria-label="Search tasks by keyword"
          disabled={!initialLoadComplete || isActionInProgress}
        />
      </div>
    </>
  );
}
