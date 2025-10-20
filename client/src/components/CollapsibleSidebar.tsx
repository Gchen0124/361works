import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ZoomControls from './ZoomControls';
import type { JournalMode } from '@/hooks/useJournalData';
import { startOfYear, startOfWeek } from 'date-fns';

interface CollapsibleSidebarProps {
  visibleBlocks: number;
  onVisibleBlocksChange: (blocks: number) => void;
  startDate: Date;
  onStartDateChange: (date: Date) => void;
  totalBlocks?: number;
  currentYear?: number;
  journalEntries?: Record<string, string>;
  isCollapsed: boolean;
  onToggleSidebar: () => void;
  currentMode?: JournalMode;
  planEntries?: Record<string, string>;
  realityEntries?: Record<string, string>;
  weeklyLayout?: boolean;
  onWeeklyLayoutChange?: (enabled: boolean) => void;
}

export default function CollapsibleSidebar({
  visibleBlocks,
  onVisibleBlocksChange,
  startDate,
  onStartDateChange,
  totalBlocks = 365,
  currentYear = new Date().getFullYear(),
  journalEntries = {},
  isCollapsed,
  onToggleSidebar,
  weeklyLayout = false,
  onWeeklyLayoutChange
}: CollapsibleSidebarProps) {

  return (
    <>
      {/* Sidebar */}
      <div 
        className={`
          fixed left-0 top-0 h-screen z-30 transition-transform duration-300 ease-out
          ${isCollapsed ? '-translate-x-full' : 'translate-x-0'}
          bg-white/10 backdrop-blur-xl border-r border-white/20
          ${isCollapsed ? 'w-0' : 'w-80'}
        `}
        data-testid="collapsible-sidebar"
      >
        <div className="p-6 h-full overflow-y-auto space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Controls
            </h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleSidebar}
              data-testid="button-close-sidebar"
              className="hover-elevate"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          <ZoomControls
            visibleBlocks={visibleBlocks}
            onVisibleBlocksChange={onVisibleBlocksChange}
            startDate={startDate}
            onStartDateChange={onStartDateChange}
            totalBlocks={totalBlocks}
            currentYear={currentYear}
            journalEntries={journalEntries}
          />
          
          {/* Quick Actions */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-medium text-foreground/80 mb-3">Quick Views</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onVisibleBlocksChange(1);
                  onStartDateChange(new Date());
                  onWeeklyLayoutChange?.(false);
                }}
                className="w-full justify-start hover-elevate"
                data-testid="button-single-day"
              >
                Single Day
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onVisibleBlocksChange(7);
                  onStartDateChange(new Date());
                  onWeeklyLayoutChange?.(false);
                }}
                className="w-full justify-start hover-elevate"
                data-testid="button-this-week"
              >
                This Week (7 days)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const sunday = startOfWeek(new Date(), { weekStartsOn: 0 });
                  onVisibleBlocksChange(7);
                  onStartDateChange(sunday);
                  onWeeklyLayoutChange?.(true);
                }}
                className="w-full justify-start hover-elevate"
                data-testid="button-weekly-view"
              >
                <span className={weeklyLayout ? 'font-bold' : ''}>Weekly View (Sun-Sat)</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onVisibleBlocksChange(30);
                  onStartDateChange(new Date());
                }}
                className="w-full justify-start hover-elevate"
                data-testid="button-this-month"
              >
                This Month (30 days)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onVisibleBlocksChange(100);
                  onStartDateChange(startOfYear(new Date()));
                }}
                className="w-full justify-start hover-elevate"
                data-testid="button-100-days"
              >
                100 Days (10×10)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onVisibleBlocksChange(361);
                  onStartDateChange(startOfYear(new Date()));
                }}
                className="w-full justify-start hover-elevate"
                data-testid="button-361-days"
              >
                361 Days (19×19)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onVisibleBlocksChange(365);
                  onStartDateChange(startOfYear(new Date()));
                }}
                className="w-full justify-start hover-elevate"
                data-testid="button-full-year"
              >
                Full Year (365 days)
              </Button>
            </div>
          </div>
        </div>
      </div>


      {/* Content Overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 lg:hidden"
          onClick={onToggleSidebar}
          data-testid="sidebar-overlay"
        />
      )}
    </>
  );
}
