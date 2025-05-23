'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox"; // Keep for consistent layout

export function TodoItemSkeleton() {
  return (
    <Card className="bg-slate-700 border-slate-600 animate-pulse">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center flex-grow min-w-0">
          {/* Skeleton for Image */}
          <div className="w-[100px] h-[100px] bg-slate-600 rounded-lg mr-4 flex-shrink-0"></div>
          
          <div className="flex flex-col flex-grow min-w-0">
            <div className="flex items-center mb-1">
              {/* Skeleton for Checkbox (can be a simple div or an actual disabled checkbox) */}
              <div className="w-5 h-5 bg-slate-600 rounded mr-3 flex-shrink-0"></div>
              {/* Skeleton for Text */}
              <div className="h-6 bg-slate-600 rounded w-3/4"></div>
            </div>
            {/* Optionally, a smaller line for subtext or shorter main text */}
            {/* <div className="h-4 bg-slate-600 rounded w-1/2 mt-1"></div> */}
          </div>
        </div>
        <div className="flex flex-col items-center justify-start gap-1 self-start">
          {/* Skeleton for Edit Button */}
          <div className="w-8 h-8 bg-slate-600 rounded mb-1"></div>
          {/* Skeleton for Remove Button */}
          <div className="w-8 h-8 bg-slate-600 rounded"></div>
        </div>
      </CardContent>
    </Card>
  );
}
