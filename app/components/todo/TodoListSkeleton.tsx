'use client';

import { TodoItemSkeleton } from './TodoItemSkeleton';

interface TodoListSkeletonProps {
  count?: number;
}

export function TodoListSkeleton({ count = 3 }: TodoListSkeletonProps) {
  // These placeholders represent fixed slots, so their identities stay stable as count changes.
  const skeletons = Array.from({ length: count }, (_, position) => ({ id: `skeleton-${position + 1}` }));

  return (
    <div className="space-y-3 mt-4">
      {skeletons.map(skeleton => (
        <TodoItemSkeleton key={skeleton.id} />
      ))}
    </div>
  );
}
