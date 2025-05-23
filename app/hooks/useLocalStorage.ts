'use client';

import { useState, useEffect, useCallback } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    if (typeof window === 'undefined') {
      console.warn(`Tried to set localStorage key “${key}” even though environment is not a client`);
      return;
    }
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (valueToStore === undefined || valueToStore === null) { 
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') {
      console.warn(`Tried to remove localStorage key “${key}” even though environment is not a client`);
      return;
    }
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue); 
    } catch (error) {
      console.error(`Error removing localStorage key “${key}”:`, error);
    }
  }, [key, initialValue]);


  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      const currentStoredValue = item ? JSON.parse(item) : initialValue;
      if (JSON.stringify(currentStoredValue) !== JSON.stringify(storedValue)) {
         setStoredValue(currentStoredValue);
      }
    } catch (error) {
      console.error(`Error syncing localStorage key “${key}”:`, error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, initialValue]); 

  return [storedValue, setValue, removeValue];
}

export default useLocalStorage;
