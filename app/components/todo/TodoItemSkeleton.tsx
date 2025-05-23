'use client';

import { Card, CardContent } from "@/components/ui/card";

export function TodoItemSkeleton() {
  return (
    <Card className="bg-slate-700 border-slate-600 animate-pulse rounded-lg">
      {/* Adjusted padding to match TodoItem */}
      <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center flex-grow min-w-0">
          {/* Skeleton for Image - Matches TodoItem responsive image style */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-600 rounded-md mr-2 sm:mr-3 flex-shrink-0"></div>
          
          <div className="flex flex-col flex-grow min-w-0">
            <div className="flex items-center mb-1">
              {/* Skeleton for Checkbox */}
              <div className="w-5 h-5 bg-slate-600 rounded mr-2 sm:mr-3 flex-shrink-0"></div>
              {/* Skeleton for Text */}
              <div className="h-5 bg-slate-600 rounded w-3/4"></div>
            </div>
          </div>
        </div>
        {/* Adjusted gap to match TodoItem actions */}
        <div className="flex flex-col items-center justify-start gap-1.5 self-start">
          {/* Skeleton for Edit Button - Updated size */}
          <div className="w-9 h-9 bg-slate-600 rounded mb-1"></div>
          {/* Skeleton for Remove Button - Updated size */}
          <div className="w-9 h-9 bg-slate-600 rounded"></div>
        </div>
      </CardContent>
    </Card>
  );
}
