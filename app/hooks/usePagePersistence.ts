import { useEffect } from 'react';
import type { FilterValue } from '../types';
import { FILTER_STORAGE_KEY, SEARCH_QUERY_STORAGE_KEY } from '../lib/constants';

interface UsePagePersistenceProps {
  isClient: boolean;
  initialLoadComplete: boolean;
  filter: FilterValue;
  setFilter: (value: FilterValue) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  showStatusMessage: (message: string) => void;
}

export function usePagePersistence({
  isClient,
  initialLoadComplete,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  showStatusMessage,
}: UsePagePersistenceProps) {
  useEffect(() => {
    if (isClient) {
      try {
        const storedFilter = localStorage.getItem(FILTER_STORAGE_KEY) as FilterValue | null;
        if (storedFilter) setFilter(storedFilter);
        const storedSearchQuery = localStorage.getItem(SEARCH_QUERY_STORAGE_KEY);
        if (storedSearchQuery) setSearchQuery(storedSearchQuery);
      } catch (error) {
        console.error("Error loading from localStorage:", error);
        showStatusMessage("Error loading saved preferences.");
      }
    }
  }, [isClient, setFilter, setSearchQuery, showStatusMessage]); 

  useEffect(() => {
    if (isClient && initialLoadComplete) {
      try {
        localStorage.setItem(FILTER_STORAGE_KEY, filter);
      } catch (error) {
        console.error("Error saving filter to localStorage:", error);
        showStatusMessage("Error saving filter preference.");
      }
    }
  }, [filter, isClient, initialLoadComplete, showStatusMessage]);

  useEffect(() => {
    if (isClient && initialLoadComplete) {
      try {
        localStorage.setItem(SEARCH_QUERY_STORAGE_KEY, searchQuery);
      } catch (error) {
        console.error("Error saving search query to localStorage:", error);
        showStatusMessage("Error saving search preference.");
      }
    }
  }, [searchQuery, isClient, initialLoadComplete, showStatusMessage]);
}
