'use client';

import { useState, useEffect, useRef } from 'react';

interface StatusMessageProps {
  message: string;
  duration?: number; 
  onDismiss?: () => void;
  type?: 'polite' | 'assertive';
  showTimer?: boolean; // New prop to control timer visibility
}

// Screen-reader only message component (remains unchanged)
export function StatusMessage({
  message,
  duration = 0,
  onDismiss,
  type = 'polite',
}: StatusMessageProps) {
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  useEffect(() => {
    if (message) {
      setVisibleMessage(message);
      if (duration && duration > 0) {
        const timer = setTimeout(() => {
          setVisibleMessage(null);
          if (onDismiss) onDismiss();
        }, duration);
        return () => clearTimeout(timer);
      }
    }
    if (!message && visibleMessage) {
        setVisibleMessage(null);
        if (onDismiss) onDismiss();
    }
  }, [message, duration, onDismiss, visibleMessage]);

  if (!visibleMessage) return null;
  return (
    <div className="sr-only" role="status" aria-live={type} aria-atomic="true">
      {visibleMessage}
    </div>
  );
}

export function VisibleStatusMessage({
  message,
  duration,
  onDismiss,
  type = 'polite',
  showTimer = false, // Default to false
  children,
}: StatusMessageProps & { children?: React.ReactNode }) {
  const [internalMessage, setInternalMessage] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const timerBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dismissTimer: NodeJS.Timeout | null = null;
    let clearMessageTimer: NodeJS.Timeout | null = null;

    if (message) {
      setInternalMessage(message);
      setShow(true);

      if (timerBarRef.current) {
        // Reset animation by removing and re-adding class or directly manipulating animation
        timerBarRef.current.style.animation = 'none';
        // Trigger reflow
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        timerBarRef.current.offsetHeight; 
        timerBarRef.current.style.animation = '';
        if (showTimer && duration) {
          timerBarRef.current.style.animationDuration = `${duration}ms`;
          timerBarRef.current.style.animationName = 'shrinkWidth';
        }
      }

      if (duration && duration > 0) {
        dismissTimer = setTimeout(() => {
          setShow(false);
          if (onDismiss) onDismiss();
          clearMessageTimer = setTimeout(() => setInternalMessage(null), 300); // For fade-out
        }, duration);
      }
    } else {
      setShow(false);
      if (internalMessage) {
        clearMessageTimer = setTimeout(() => setInternalMessage(null), 300);
      }
       if (timerBarRef.current) {
        timerBarRef.current.style.animationName = 'none'; // Stop animation
      }
    }

    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      if (clearMessageTimer) clearTimeout(clearMessageTimer);
    };
  }, [message, duration, onDismiss, internalMessage, showTimer]);

  if (!internalMessage) return null;

  return (
    <>
      {/* Add keyframes directly using style jsx or ensure they are in globals.css */}
      <style jsx global>{`
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
      <div
        role="status"
        aria-live={type}
        aria-atomic="true"
        className={`fixed bottom-4 right-4 w-auto max-w-md p-4 bg-slate-700 text-white rounded-md shadow-lg transition-opacity duration-300 ease-in-out overflow-hidden ${
          show ? 'opacity-100' : 'opacity-0 pointer-events-none' // Added pointer-events-none when hidden
        }`}
      >
        <div className="flex items-center justify-between">
          <span>{internalMessage}</span>
          {children}
        </div>
        {showTimer && duration && (
          <div className="absolute bottom-0 left-0 h-1 bg-sky-500 mt-2" ref={timerBarRef} />
        )}
      </div>
    </>
  );
}
