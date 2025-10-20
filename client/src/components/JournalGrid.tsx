import { useState, useEffect, useMemo } from 'react';
import { addDays, startOfYear, format, getWeek, getDay } from 'date-fns';
import JournalBlock from './JournalBlock';
import type { JournalMode } from '@/hooks/useJournalData';
import { dateToDay } from '@/hooks/useJournalData';

interface JournalGridProps {
  visibleBlocks: number;
  startDate: Date;
  year?: number;
  isDarkMode?: boolean;
  entries: Record<string, string>;
  onContentChange: (date: Date, content: string) => void;
  currentMode?: JournalMode;
  readOnly?: boolean;
  compareMode?: boolean;
  planEntries?: Record<string, string>;
  realityEntries?: Record<string, string>;
  showDateOutside?: boolean;
  weeklyLayout?: boolean;  // New prop to enable weekly grid layout
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
  currentMode = 'plan',
  readOnly = false,
  compareMode = false,
  planEntries = {},
  realityEntries = {},
  showDateOutside = false,
  weeklyLayout = false
}: JournalGridProps) {

  // Generate the visible dates
  const visibleDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < visibleBlocks; i++) {
      dates.push(addDays(startDate, i));
    }
    return dates;
  }, [startDate, visibleBlocks]);

  // Group dates into weeks for weekly layout
  const weekGroups = useMemo(() => {
    const groups: Array<{ weekNumber: number; dates: Date[] }> = [];
    let currentWeek: Date[] = [];
    let currentWeekNumber: number | null = null;

    visibleDates.forEach((date) => {
      const weekNum = getWeek(date, { weekStartsOn: 0 });
      const dayOfWeek = getDay(date);

      // Start a new week if it's Sunday or if week number changed
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        groups.push({
          weekNumber: currentWeekNumber!,
          dates: currentWeek
        });
        currentWeek = [];
        currentWeekNumber = weekNum;
      }

      if (currentWeekNumber === null) {
        currentWeekNumber = weekNum;
      }

      currentWeek.push(date);
    });

    // Push the last week
    if (currentWeek.length > 0) {
      groups.push({
        weekNumber: currentWeekNumber!,
        dates: currentWeek
      });
    }

    return groups;
  }, [visibleDates]);

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

  // Render helper for a single date block
  const renderDateBlock = (date: Date, index: number) => {
    const dayKey = dateToDay(date, year);
    const planContent = planEntries[dayKey] ?? '';
    const realityContent = realityEntries[dayKey] ?? '';
    const singleContent = entries[dayKey] ?? '';

    return (
      <div
        key={dayKey}
        className="animate-fade-in group/item"
        style={{
          animationDelay: `${index * (visibleBlocks > 100 ? 0.005 : 0.02)}s`,
          animationFillMode: 'backwards'
        }}
      >
        {compareMode ? (
          <div>
            {showDateOutside && (
              <time
                className="text-xs text-foreground/70 mb-1 block"
                dateTime={format(date, 'yyyy-MM-dd')}
              >
                {format(date, 'MMM d, yyyy')}
              </time>
            )}
            <div className="space-y-2">
              {/* Current mode (editable) - appears first */}
              <div className={`relative group bg-white/10 backdrop-blur-md border-2 ${
                currentMode === 'plan' ? 'border-indigo-500/50' : 'border-emerald-500/50'
              } ${visibleBlocks > 100 ? 'rounded-sm p-1' : 'rounded-xl p-3'}`}>
                <div className="text-[0.65rem] font-semibold mb-1 opacity-70">
                  {currentMode === 'plan' ? '📋 PLAN (editable)' : '✅ REALITY (editable)'}
                </div>
                <textarea
                  value={currentMode === 'plan' ? planContent : realityContent}
                  onChange={(e) => onContentChange(date, e.target.value)}
                  placeholder={currentMode === 'plan' ? 'Your plan...' : 'What happened?'}
                  className={`
                    w-full bg-transparent border-none outline-none resize-none
                    text-foreground placeholder:text-muted-foreground
                    ${blockSize === 'micro' ? 'text-[0.6rem] min-h-[3rem]' : 'text-sm min-h-[5rem]'}
                  `}
                  rows={blockSize === 'micro' ? 3 : 4}
                />
              </div>

              {/* Other mode (read-only reference) - appears below */}
              <div className={`relative bg-white/5 backdrop-blur-md border ${
                currentMode === 'plan' ? 'border-emerald-500/30' : 'border-indigo-500/30'
              } ${visibleBlocks > 100 ? 'rounded-sm p-1' : 'rounded-xl p-3'} opacity-70`}>
                <div className="text-[0.65rem] font-semibold mb-1 opacity-70">
                  {currentMode === 'plan' ? '✅ Reality (reference)' : '📋 Plan (reference)'}
                </div>
                <div
                  className={`text-foreground/70 ${blockSize === 'micro' ? 'text-[0.55rem]' : 'text-sm'} whitespace-pre-wrap`}
                  title={currentMode === 'plan' ? realityContent : planContent}
                >
                  {(currentMode === 'plan' ? realityContent : planContent) || <span className="italic text-muted-foreground">No {currentMode === 'plan' ? 'reality' : 'plan'} entry yet</span>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <JournalBlock
            date={date}
            initialContent={singleContent}
            onContentChange={(content) => onContentChange(date, content)}
            size={blockSize}
            isVisible={true}
            showDateOnHover={blockSize === 'micro' || (isDarkMode && visibleBlocks >= 100)}
            totalBlocks={visibleBlocks}
            currentMode={currentMode}
            readOnly={readOnly}
          />
        )}
      </div>
    );
  };

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
      {weeklyLayout ? (
        // Weekly Layout: Each week is a row with week number on the left
        <div className="space-y-4">
          {weekGroups.map((week, weekIndex) => (
            <div key={`week-${week.weekNumber}`} className="flex items-start gap-4">
              {/* Week Number */}
              <div className="flex-shrink-0 mt-2">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-sm font-semibold text-foreground/80">
                  Week {week.weekNumber}
                </div>
              </div>

              {/* Week Days */}
              <div className={`
                flex-1 grid grid-cols-7 gap-4
                transition-all duration-500 ease-out
              `}>
                {week.dates.map((date, dateIndex) => renderDateBlock(date, weekIndex * 7 + dateIndex))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Standard Grid Layout
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
          {visibleDates.map((date, index) => renderDateBlock(date, index))}
        </div>
      )}

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
