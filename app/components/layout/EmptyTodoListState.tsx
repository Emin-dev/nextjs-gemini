'use client';

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyTodoListState({ title, message }: EmptyStateProps) {
  return (
    <div className="text-center text-slate-500 mt-10 p-6 border-2 border-dashed border-slate-700 rounded-lg">
      <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10h.01" /></svg>
      <h3 className="mt-2 text-xl font-semibold text-slate-400">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}
