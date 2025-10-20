import { useState, useEffect } from 'react';
import { startOfYear, format } from 'date-fns';
import JournalGrid from '@/components/JournalGrid';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import { Button } from '@/components/ui/button';
import { Moon, Sun, BookOpen, ChevronRight, ChevronLeft, Target, CheckCircle } from 'lucide-react';
import { useJournalData, type JournalMode } from '@/hooks/useJournalData';
import { useTimeMachine } from '/src/hooks/useTimeMachine.ts';
import TimeMachineBar from '/src/components/TimeMachineBar.tsx';

export default function Journal() {
  const [visibleBlocks, setVisibleBlocks] = useState(30);
  const [startDate, setStartDate] = useState(startOfYear(new Date()));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const currentYear = new Date().getFullYear();

  // Use the new journal data hook for plan/reality separation
  const {
    planEntries,
    realityEntries,
    currentMode,
    isOnline,
    lastSyncTimestamp,
    setCurrentMode,
    updateEntry,
    getCurrentEntries,
    getEntryForMode,
    syncToDatabase,
    loadFromDatabase
  } = useJournalData(currentYear);

  // Time Machine state
  const [isTimeMachine, setIsTimeMachine] = useState(false);
  const tm = useTimeMachine(currentYear);
  const [compareMode, setCompareMode] = useState(false);
  const [weeklyLayout, setWeeklyLayout] = useState(false);

  // Dark mode based on current mode: plan = dark, reality = light
  const isDarkMode = currentMode === 'plan';

  // Apply dark mode to document class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleMode = () => {
    const newMode: JournalMode = currentMode === 'plan' ? 'reality' : 'plan';
    setCurrentMode(newMode);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Test localStorage functionality on mount
  useEffect(() => {
    const testLocalStorage = () => {
      try {
        const testKey = 'journal-test';
        const testValue = 'test-data';
        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);

        if (retrieved === testValue) {
          console.log('✅ LocalStorage is working correctly');
        } else {
          console.error('❌ LocalStorage test failed');
        }
      } catch (error) {
        console.error('❌ LocalStorage is not available:', error);
      }
    };

    testLocalStorage();
  }, []);

  // Entries source: live mode or time machine snapshot
  const effectiveEntries = () => {
    if (!isTimeMachine || !tm.snapshot) return getCurrentEntries();
    return currentMode === 'plan' ? tm.snapshot.plan_contents : tm.snapshot.reality_contents;
  };

  return (
    <div 
      className={`
        min-h-screen transition-all duration-500 ease-out
        bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100
        dark:from-slate-900 dark:via-slate-800 dark:to-slate-900
      `}
      data-testid="journal-page"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/20 dark:bg-black/20 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleSidebar}
                className="hover-elevate"
                data-testid="button-toggle-sidebar"
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </Button>
              <div className="w-10 h-10 bg-primary/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="app-title">
                  365 Journal
                  <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                    currentMode === 'plan'
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {currentMode === 'plan' ? 'PLAN' : 'REALITY'}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-green-500' : 'bg-red-500'
                  }`} title={isOnline ? 'Connected to database' : 'Offline - using localStorage only'} />
                </h1>
                <p className="text-sm text-muted-foreground">
                  {currentMode === 'plan'
                    ? 'Planning your year ahead'
                    : 'Recording your reality'
                  }
                  {lastSyncTimestamp && (
                    <span className="ml-2 text-xs opacity-70">
                      Last sync: {lastSyncTimestamp.toLocaleTimeString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMode}
              className="hover-elevate"
              data-testid="button-mode-toggle"
              title={currentMode === 'plan' ? 'Switch to Reality Mode' : 'Switch to Plan Mode'}
            >
              {currentMode === 'plan' ? (
                <Target className="w-5 h-5 text-indigo-300" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              )}
            </Button>
            {!isTimeMachine && (
              <Button
                variant={compareMode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCompareMode(!compareMode)}
                className="ml-2 hover-elevate"
                title="Toggle Reality vs Plan overlay"
              >
                {compareMode ? 'Compare: ON' : 'Compare'}
              </Button>
            )}
            <Button
              variant={weeklyLayout ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setWeeklyLayout(!weeklyLayout)}
              className="ml-2 hover-elevate"
              title="Toggle Weekly Layout"
            >
              {weeklyLayout ? 'Weekly: ON' : 'Weekly'}
            </Button>
            <Button
              variant={isTimeMachine ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setIsTimeMachine(!isTimeMachine)}
              className="ml-2 hover-elevate"
              title="Toggle Time Machine"
            >
              {isTimeMachine ? 'Time Machine: ON' : 'Time Machine'}
            </Button>
          </div>
        </div>
      </header>

      {/* Time Machine Controls */}
      {isTimeMachine && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <TimeMachineBar
            timeline={tm.timeline}
            selectedIndex={tm.selectedIndex}
            onIndexChange={(idx: number) => tm.setIndex(idx)}
          />
        </div>
      )}

      {/* Collapsible Sidebar */}
      <CollapsibleSidebar
        visibleBlocks={visibleBlocks}
        onVisibleBlocksChange={setVisibleBlocks}
        startDate={startDate}
        onStartDateChange={setStartDate}
        totalBlocks={365}
        currentYear={currentYear}
        journalEntries={effectiveEntries()}
        isCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        currentMode={currentMode}
        planEntries={planEntries}
        realityEntries={realityEntries}
      />

      {/* Main Content - Full Width */}
      <main className="w-full px-6 py-8">
        <div className="w-full">
          <JournalGrid
            visibleBlocks={visibleBlocks}
            startDate={startDate}
            year={currentYear}
            isDarkMode={isDarkMode}
            entries={effectiveEntries()}
            onContentChange={isTimeMachine ? () => {} : updateEntry}
            currentMode={currentMode}
            readOnly={isTimeMachine}
            compareMode={!isTimeMachine && compareMode}
            planEntries={planEntries}
            realityEntries={realityEntries}
            showDateOutside={visibleBlocks < 100}
            weeklyLayout={weeklyLayout}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-white/20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            {currentMode === 'plan'
              ? 'Plan your days, one thought at a time. Your plans are saved locally and separately from reality.'
              : 'Record what actually happened. Reality entries are saved locally and separately from plans.'
            }
          </p>
        </div>
      </footer>
    </div>
  );
}
