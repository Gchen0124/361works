import { useState, useEffect, useMemo } from 'react';
import { addDays, startOfYear, format } from 'date-fns';
import JournalBlock from './JournalBlock';
import type { JournalMode } from '@/hooks/useJournalData';

interface JournalGridProps {
  visibleBlocks: number;
  startDate: Date;
  year?: number;
  isDarkMode?: boolean;
  entries: Record<string, string>;
  onContentChange: (date: Date, content: string) => void;
  currentMode?: JournalMode;
}

interface JournalEntry {
  date: string;
  content: string;
}

export default function JournalGrid({
  visibleBlocks,
  startDate,
  year = new Date().getFullYear(),
  isDarkMode = false,
  entries,
  onContentChange,
  currentMode = 'plan'
}: JournalGridProps) {

  // Generate the visible dates
  const visibleDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < visibleBlocks; i++) {
      dates.push(addDays(startDate, i));
    }
    return dates;
  }, [startDate, visibleBlocks]);

  // Determine grid columns based on number of visible blocks - fixed grids for optimization
  const getGridColumns = (blockCount: number) => {
    if (blockCount === 1) return 'grid-cols-1'; // Single block takes full width
    if (blockCount <= 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    if (blockCount <= 7) return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7';
    if (blockCount <= 14) return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7';
    if (blockCount <= 30) return 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10';
    if (blockCount <= 100) return 'grid-cols-10'; // 10x10 grid
    if (blockCount <= 361) return 'grid-cols-19'; // 19x19 grid for 361 days
    // For 365 days - use 19x19 (361) + remaining
    return 'grid-cols-19';
  };

  // Determine block size based on number of visible blocks - optimize for screen space
  const getBlockSize = (blockCount: number): 'micro' | 'small' | 'medium' | 'large' | 'xl' => {
    if (blockCount === 1) return 'xl'; // Single block gets maximum space
    if (blockCount <= 3) return 'large';
    if (blockCount <= 7) return 'medium';
    if (blockCount <= 30) return 'small';
    if (blockCount <= 100) return 'micro'; // 10x10 grid
    // For 19x19 grid (361+ days), use ultra-micro
    return 'micro';
  };

  const gridColumns = getGridColumns(visibleBlocks);
  const blockSize = getBlockSize(visibleBlocks);

  return (
    <div className="space-y-4" data-testid="journal-grid">
      {/* Grid Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {visibleBlocks} days starting from {format(startDate, 'MMMM d, yyyy')}
        </span>
        <div className="flex items-center gap-4">
          <span>
            {Object.keys(entries).length} {currentMode === 'plan' ? 'plans' : 'reality entries'} saved
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            currentMode === 'plan'
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          }`}>
            🔄 {currentMode === 'plan' ? 'Planning Mode' : 'Reality Mode'}
          </span>
        </div>
      </div>

      {/* Journal Grid */}
      <div 
        className={`
          grid ${gridColumns} auto-rows-max
          transition-all duration-500 ease-out w-full
          ${visibleBlocks === 1 ? 'max-w-4xl mx-auto' : ''}
          ${visibleBlocks <= 7 ? 'gap-4' : ''}
          ${visibleBlocks > 7 && visibleBlocks <= 30 ? 'gap-2' : ''}
          ${visibleBlocks > 30 && visibleBlocks <= 100 ? 'gap-1' : ''}
          ${visibleBlocks > 100 ? 'gap-0.5' : ''}
          ${visibleBlocks > 100 ? 'aspect-square' : ''}
        `}
        style={{
          animationDelay: '0.1s',
          animationFillMode: 'backwards'
        }}
      >
        {visibleDates.map((date, index) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          return (
            <div
              key={dateKey}
              className="animate-fade-in group/item"
              style={{
                animationDelay: `${index * (visibleBlocks > 100 ? 0.005 : 0.02)}s`,
                animationFillMode: 'backwards'
              }}
            >
              <JournalBlock
                date={date}
                initialContent={entries[dateKey] || ''}
                onContentChange={(content) => onContentChange(date, content)}
                size={blockSize}
                isVisible={true}
                showDateOnHover={blockSize === 'micro' || (isDarkMode && visibleBlocks >= 100)}
                totalBlocks={visibleBlocks}
                currentMode={currentMode}
              />
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {visibleBlocks === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <div className="text-lg font-medium mb-2">No days selected</div>
            <div className="text-sm">Use the controls above to select days to view</div>
          </div>
        </div>
      )}
    </div>
  );
}