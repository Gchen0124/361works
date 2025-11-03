import { useMemo } from 'react';
import { addDays, format, getWeek, getDay, startOfWeek, endOfWeek } from 'date-fns';
import JournalBlock from './JournalBlock';
import type { JournalMode } from '@/hooks/useJournalData';
import { dateToDay, dateToWeekKey } from '@/hooks/useJournalData';

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
  weeklyLayout?: boolean;
  onWeeklyContentChange?: (weekKey: string, content: string) => void;
}

interface JournalEntry {
  date: string;
  content: string;
}

type BlockSizeVariant = 'micro' | 'small' | 'medium' | 'large' | 'xl';

interface CompareSizeStyle {
  container: string;
  header: string;
  body: string;
  minHeight: string;
  rows: number;
}

interface ComparePalette {
  container: string;
  header: string;
  textArea: string;
  reference: string;
  empty: string;
  referenceTone: string;
}

const compareSizeStyles: Record<BlockSizeVariant, CompareSizeStyle> = {
  micro: {
    container: 'w-full rounded-md p-2 gap-2',
    header: 'text-[0.65rem]',
    body: 'text-[0.8rem] leading-snug',
    minHeight: 'min-h-[3.25rem]',
    rows: 3
  },
  small: {
    container: 'w-full rounded-lg p-3 gap-2',
    header: 'text-[0.75rem]',
    body: 'text-sm leading-relaxed',
    minHeight: 'min-h-[4.25rem]',
    rows: 4
  },
  medium: {
    container: 'w-full rounded-xl p-4 gap-3',
    header: 'text-sm',
    body: 'text-base leading-relaxed',
    minHeight: 'min-h-[5.5rem]',
    rows: 5
  },
  large: {
    container: 'w-full rounded-2xl p-5 gap-3',
    header: 'text-base',
    body: 'text-lg leading-relaxed',
    minHeight: 'min-h-[6rem]',
    rows: 6
  },
  xl: {
    container: 'w-full rounded-2xl p-6 gap-4',
    header: 'text-lg',
    body: 'text-xl leading-relaxed',
    minHeight: 'min-h-[7rem]',
    rows: 7
  }
};

const compareStackGap: Record<BlockSizeVariant, string> = {
  micro: 'gap-2',
  small: 'gap-2.5',
  medium: 'gap-3',
  large: 'gap-3.5',
  xl: 'gap-4'
};

const comparePalettes: Record<JournalMode, ComparePalette> = {
  plan: {
    container:
      'backdrop-blur-xl border border-indigo-400/40 bg-gradient-to-br from-indigo-950/90 via-indigo-900/80 to-slate-950/90 text-white shadow-[0_20px_45px_rgba(67,56,202,0.35)]',
    header: 'text-indigo-100/80',
    textArea:
      'text-white placeholder:text-indigo-200 caret-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-0',
    reference: 'text-indigo-100/90',
    empty: 'text-indigo-200/70',
    referenceTone: 'opacity-90'
  },
  reality: {
    container:
      'backdrop-blur-lg border border-emerald-400/35 bg-gradient-to-br from-white/95 via-emerald-50/85 to-emerald-100/70 dark:from-slate-100 dark:via-slate-50 dark:to-emerald-100/80 text-slate-900 shadow-[0_18px_40px_rgba(16,185,129,0.18)]',
    header: 'text-emerald-800/80 dark:text-emerald-600/80',
    textArea:
      'text-slate-900 placeholder:text-slate-500 caret-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-0',
    reference: 'text-slate-700 dark:text-slate-800',
    empty: 'text-slate-400 dark:text-slate-500',
    referenceTone: 'opacity-95'
  }
};

const getPanelDateFormat = (sizeKey: BlockSizeVariant, isWeeklyLayout: boolean) => {
  if (isWeeklyLayout) {
    return sizeKey === 'micro' ? 'EEE d' : 'EEE, MMM d';
  }

  switch (sizeKey) {
    case 'micro':
      return 'MM/dd';
    case 'small':
      return 'MMM d';
    case 'medium':
      return 'EEE, MMM d';
    case 'large':
      return 'EEE, MMM d';
    case 'xl':
      return 'EEEE, MMM d';
    default:
      return 'MMM d';
  }
};

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
  weeklyLayout = false,
  onWeeklyContentChange
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

    visibleDates.forEach((date, index) => {
      const weekNum = getWeek(date, { weekStartsOn: 0 });
      const dayOfWeek = getDay(date);

      // If week number changes, push the previous week and start a new one
      if (currentWeekNumber !== null && weekNum !== currentWeekNumber) {
        groups.push({
          weekNumber: currentWeekNumber,
          dates: currentWeek
        });
        currentWeek = [];
      }

      currentWeekNumber = weekNum;
      currentWeek.push(date);
    });

    // Push the last week
    if (currentWeek.length > 0 && currentWeekNumber !== null) {
      groups.push({
        weekNumber: currentWeekNumber,
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

  const renderModePanel = ({
    mode,
    content,
    isEditable,
    sizeKey,
    placeholder,
    ariaLabel,
    onChange
  }: {
    mode: JournalMode;
    content: string;
    isEditable: boolean;
    sizeKey: BlockSizeVariant;
    placeholder: string;
    ariaLabel: string;
    onChange?: (value: string) => void;
  }) => {
    const palette = comparePalettes[mode];
    const sizeStyles = compareSizeStyles[sizeKey];
    const focusWithinClass =
      mode === 'plan'
        ? 'focus-within:ring-2 focus-within:ring-indigo-400/70'
        : 'focus-within:ring-2 focus-within:ring-emerald-400/60';

    const canEdit = isEditable && typeof onChange === 'function';

    const containerClasses = [
      'relative flex flex-col transition-all duration-300 ease-out overflow-hidden',
      sizeStyles.container,
      palette.container,
      canEdit ? focusWithinClass : palette.referenceTone
    ].join(' ');

    const bodyBaseClasses = `${sizeStyles.body} ${sizeStyles.minHeight}`;

    if (canEdit) {
      return (
        <div className={containerClasses}>
          <textarea
            aria-label={ariaLabel}
            value={content}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className={`w-full bg-transparent border-none outline-none resize-none transition-colors duration-300 ${palette.textArea} ${bodyBaseClasses}`}
            rows={sizeStyles.rows}
            spellCheck={true}
          />
        </div>
      );
    }

    return (
      <div className={containerClasses}>
        <div
          aria-label={ariaLabel}
          className={`whitespace-pre-wrap break-words ${palette.reference} ${bodyBaseClasses}`}
        >
          {content ? content : <span className={palette.empty}>No entry yet</span>}
        </div>
      </div>
    );
  };

  interface ModeStackOptions {
    label: string;
    dateTime?: string;
    sizeKey: BlockSizeVariant;
    editableMode: JournalMode;
    editableContent: string;
    editablePlaceholder: string;
    onEditableChange?: (value: string) => void;
    referenceMode: JournalMode;
    referenceContent: string;
    referencePlaceholder: string;
    isEditable: boolean;
  }

  const renderModeStack = ({
    label,
    dateTime,
    sizeKey,
    editableMode,
    editableContent,
    editablePlaceholder,
    onEditableChange,
    referenceMode,
    referenceContent,
    referencePlaceholder,
    isEditable
  }: ModeStackOptions) => {
    const headerClasses = `${compareSizeStyles[sizeKey].header} font-semibold tracking-wide text-foreground/90`;

    return (
      <div className={`flex flex-col ${compareStackGap[sizeKey]}`}>
        <time className={headerClasses} dateTime={dateTime}>
          {label}
        </time>
        <div className={`flex flex-col ${compareStackGap[sizeKey]}`}>
          {renderModePanel({
            mode: editableMode,
            content: editableContent,
            isEditable,
            sizeKey,
            placeholder: editablePlaceholder,
            ariaLabel: editableMode === 'plan' ? 'Plan entry' : 'Reality entry',
            onChange: isEditable ? onEditableChange : undefined
          })}
          {renderModePanel({
            mode: referenceMode,
            content: referenceContent,
            isEditable: false,
            sizeKey,
            placeholder: referencePlaceholder,
            ariaLabel: referenceMode === 'plan' ? 'Plan reference' : 'Reality reference'
          })}
        </div>
      </div>
    );
  };

  const renderCompareContent = (
    date: Date,
    sizeKey: BlockSizeVariant,
    isWeeklyLayout: boolean
  ) => {
    const dayKey = dateToDay(date, year);
    const planContent = planEntries[dayKey] ?? '';
    const realityContent = realityEntries[dayKey] ?? '';

    const editableMode = currentMode;
    const referenceMode: JournalMode = currentMode === 'plan' ? 'reality' : 'plan';

    const editableContent = editableMode === 'plan' ? planContent : realityContent;
    const referenceContent = referenceMode === 'plan' ? planContent : realityContent;

    const label = format(date, getPanelDateFormat(sizeKey, isWeeklyLayout));
    const dateTime = format(date, 'yyyy-MM-dd');
    const isEditable = !readOnly;

    return renderModeStack({
      label,
      dateTime,
      sizeKey,
      editableMode,
      editableContent,
      editablePlaceholder: editableMode === 'plan' ? 'Your plan...' : 'What happened?',
      onEditableChange: isEditable ? (value: string) => onContentChange(date, value) : undefined,
      referenceMode,
      referenceContent,
      referencePlaceholder: referenceMode === 'plan' ? 'Your plan...' : 'What happened?',
      isEditable
    });
  };

  type WeekSummaryInfo = {
    weekKey: string;
    weekNumber: number;
    start: Date;
    end: Date;
    label: string;
    dateTime: string;
  };

  const buildWeekSummary = (date: Date): WeekSummaryInfo => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
    const weekNumber = getWeek(date, { weekStartsOn: 0, firstWeekContainsDate: 1 });
    const label = `Week ${weekNumber} • ${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;

    return {
      weekKey: dateToWeekKey(weekStart, year),
      weekNumber,
      start: weekStart,
      end: weekEnd,
      label,
      dateTime: format(weekStart, 'yyyy-MM-dd')
    };
  };

  const weeklySummaryCache = useMemo(() => {
    const map = new Map<string, WeekSummaryInfo>();
    visibleDates.forEach((date) => {
      const info = buildWeekSummary(date);
      if (!map.has(info.weekKey)) {
        map.set(info.weekKey, info);
      }
    });
    return map;
  }, [visibleDates, year]);

  const renderWeeklyStack = (weekInfo: WeekSummaryInfo, sizeKey: BlockSizeVariant) => {
    const summarySize: BlockSizeVariant = sizeKey === 'micro' ? 'small' : sizeKey;
    const planContent = planEntries[weekInfo.weekKey] ?? '';
    const realityContent = realityEntries[weekInfo.weekKey] ?? '';

    const editableMode = currentMode;
    const referenceMode: JournalMode = currentMode === 'plan' ? 'reality' : 'plan';
    const editableContent = editableMode === 'plan' ? planContent : realityContent;
    const referenceContent = referenceMode === 'plan' ? planContent : realityContent;

    const canEditWeekly = !readOnly && typeof onWeeklyContentChange === 'function';

    return renderModeStack({
      label: weekInfo.label,
      dateTime: weekInfo.dateTime,
      sizeKey: summarySize,
      editableMode,
      editableContent,
      editablePlaceholder: editableMode === 'plan' ? 'Weekly objectives...' : 'Weekly highlights...',
      onEditableChange: canEditWeekly && onWeeklyContentChange
        ? (value: string) => onWeeklyContentChange(weekInfo.weekKey, value)
        : undefined,
      referenceMode,
      referenceContent,
      referencePlaceholder: referenceMode === 'plan' ? 'Weekly objectives...' : 'Weekly highlights...',
      isEditable: canEditWeekly
    });
  };

  // Render helper for a single date block
  const renderDateBlock = (date: Date, index: number) => {
    const dayKey = dateToDay(date, year);
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
          renderCompareContent(date, blockSize, false)
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

  const shouldShowWeeklySummary = !weeklyLayout && visibleBlocks <= 7;
  const standardGridNodes: JSX.Element[] = [];
  const renderedWeekKeys = new Set<string>();

  visibleDates.forEach((date, index) => {
    if (shouldShowWeeklySummary) {
      const weekKey = dateToWeekKey(date, year);
      const summaryInfo = weeklySummaryCache.get(weekKey) ?? buildWeekSummary(date);
      if (!renderedWeekKeys.has(summaryInfo.weekKey)) {
        renderedWeekKeys.add(summaryInfo.weekKey);
        standardGridNodes.push(
          <div key={`${summaryInfo.weekKey}-summary`} className="col-span-full mb-4">
            {renderWeeklyStack(summaryInfo, blockSize)}
          </div>
        );
      }
    }

    standardGridNodes.push(renderDateBlock(date, index));
  });

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
        <div className="space-y-3">
          {weekGroups.map((week, weekIndex) => {
            const firstDate = week.dates[0];
            const weekInfo = weeklySummaryCache.get(dateToWeekKey(firstDate, year)) ?? buildWeekSummary(firstDate);

            return (
              <div
                key={`${weekInfo.weekKey}-${weekIndex}`}
                className="flex flex-col gap-4 lg:flex-row lg:items-start"
              >
                <div className="flex flex-row gap-3 lg:flex-col lg:w-64">
                  {/* Week Number */}
                  <div className="flex-shrink-0 flex items-center">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-4 min-w-[4.5rem] text-center">
                      <div className="text-[0.65rem] text-foreground/60 uppercase tracking-wide">Week</div>
                      <div className="text-lg font-bold text-foreground/90">{weekInfo.weekNumber}</div>
                    </div>
                  </div>

                  {/* Weekly Summary */}
                  <div className="flex-1 min-w-[14rem]">
                    {renderWeeklyStack(weekInfo, blockSize)}
                  </div>
                </div>

                {/* Week Days */}
                <div className={`
                  flex-1 grid grid-cols-7 gap-2
                  transition-all duration-500 ease-out
                `}>
                  {week.dates.map((date, dateIndex) => {
                    const dayOfWeek = getDay(date);
                    const isSunday = dayOfWeek === 0;

                    return (
                      <div
                        key={dateToDay(date, year)}
                        className={`
                          animate-fade-in group/item
                          ${isSunday ? 'sunday-block' : ''}
                        `}
                        style={{
                          animationDelay: `${(weekIndex * 7 + dateIndex) * 0.02}s`,
                          animationFillMode: 'backwards'
                        }}
                      >
                        {compareMode ? (
                          renderCompareContent(date, blockSize, true)
                        ) : (
                          <div className={`
                            h-full bg-white/10 backdrop-blur-md border border-white/20
                            rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ease-out
                            hover:scale-[1.02] hover:bg-white/15
                            focus-within:ring-2 focus-within:ring-primary/50 focus-within:scale-[1.02]
                            animate-fade-in group overflow-hidden relative
                            flex flex-col
                          `}>
                            <div className="p-3 flex-1 flex flex-col">
                              {/* Date Header */}
                              <div className="flex items-center mb-2">
                                <time
                                  className={`${isSunday ? 'text-base font-bold' : 'text-sm font-medium'} text-foreground/70`}
                                  dateTime={format(date, 'yyyy-MM-dd')}
                                >
                                  {format(date, isSunday ? 'EEE, MMM d' : 'EEE d')}
                                </time>
                              </div>

                              {/* Content Textarea */}
                              <textarea
                                value={entries[dateToDay(date, year)] ?? ''}
                                onChange={(e) => onContentChange(date, e.target.value)}
                                readOnly={readOnly}
                                disabled={readOnly}
                                placeholder={currentMode === 'plan' ? 'Your plan...' : 'What happened?'}
                                className={`
                                  flex-1 w-full bg-transparent border-none outline-none resize-none
                                  text-foreground placeholder:text-muted-foreground
                                  ${isSunday ? 'text-sm' : 'text-sm'} font-light leading-relaxed overflow-hidden
                                `}
                                rows={4}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
          {standardGridNodes}
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
