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
  isActionInProgress: boolean;
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
  if (!isClient) return null;

  return (
    <div className="flex flex-col w-full">
      <RadioGroup
        value={filter}
        defaultValue="all"
        onValueChange={onFilterChange}
        className="flex items-center p-1 bg-slate-700 rounded-lg shadow-sm w-full sm:w-auto justify-center mb-3 sm:mb-0"
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
              className="sr-only peer"
            />
            {option.label}
          </Label>
        ))}
      </RadioGroup>
      <div className="w-full mt-4">
        <Input
          type="search"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500 text-xl sm:text-2xl w-full h-14 sm:h-16 px-5 py-4"
          aria-label="Search tasks by keyword"
          disabled={!initialLoadComplete || isActionInProgress}
        />
      </div>
    </div>
  );
}
