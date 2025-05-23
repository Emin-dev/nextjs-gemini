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
        className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center"
        disabled={!initialLoadComplete}
        aria-labelledby="tasks-heading" // Assumes tasks-heading id is present on the page title
      >
        {filterOptions.map(option => (
          <div key={option.value} className="flex items-center space-x-1 sm:space-x-2">
            <RadioGroupItem value={option.value} id={`filter-${option.value}`} className="text-sky-400 border-sky-400" />
            <Label htmlFor={`filter-${option.value}`} className="text-slate-300 text-sm sm:text-base">{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
      <div className="mb-2 mt-4"> {/* Added margin for spacing */}
        <Input
          type="search"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500 text-sm sm:text-base"
          aria-label="Search tasks by keyword"
          disabled={!initialLoadComplete || isActionInProgress}
        />
      </div>
    </>
  );
}
