'use client';

import { TodoItemSkeleton } from './TodoItemSkeleton';

interface TodoListSkeletonProps {
  count?: number;
}

export function TodoListSkeleton({ count = 3 }: TodoListSkeletonProps) {
  return (
    <div className="space-y-3 mt-4">
      {[...Array(count)].map((_, index) => (
        <TodoItemSkeleton key={index} />
      ))}
    </div>
  );
}
