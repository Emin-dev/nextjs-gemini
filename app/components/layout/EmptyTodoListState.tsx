'use client';

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyTodoListState({ title, message }: EmptyStateProps) {
  return (
    <div className="text-center text-slate-500 mt-10 p-8 border-2 border-dashed border-slate-600 rounded-lg"> {/* Slightly more padding, lighter border */}
      <svg 
        className="mx-auto h-14 w-14 text-slate-500" /* Slightly larger icon, updated color */
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10h.01" /> {/* Slightly thinner stroke for a cleaner look */}
      </svg>
      <h3 className="mt-4 text-xl font-semibold text-slate-300">{title}</h3> {/* Lighter title text */}
      <p className="mt-1.5 text-sm text-slate-400">{message}</p> {/* Lighter message text */}
    </div>
  );
}
