
'use client';

import { useState, useEffect, useRef } from 'react';

const SAVE_FEEDBACK_DURATION = 1500;

export function useSaveFeedback(todoText: string, todoCompleted: boolean) {
  const [justSaved, setJustSaved] = useState(false);
  const prevTodoText = useRef(todoText);
  const prevTodoCompleted = useRef(todoCompleted);

  useEffect(() => {
    if (prevTodoText.current !== todoText || prevTodoCompleted.current !== todoCompleted) {
      // Only trigger feedback if it's not the initial render/setup
      if (prevTodoText.current !== undefined || prevTodoCompleted.current !== undefined) {
        setJustSaved(true);
        const timer = setTimeout(() => setJustSaved(false), SAVE_FEEDBACK_DURATION);
        
        // Update refs for the next comparison AFTER the timer logic
        prevTodoText.current = todoText;
        prevTodoCompleted.current = todoCompleted;
        
        return () => clearTimeout(timer);
      }
    }
    // Ensure refs are updated even if no feedback is triggered (e.g., initial values)
    prevTodoText.current = todoText;
    prevTodoCompleted.current = todoCompleted;
  }, [todoText, todoCompleted]);

  return justSaved;
}
