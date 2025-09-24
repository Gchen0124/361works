import { useState, useEffect } from 'react';
import { startOfYear, format } from 'date-fns';
import JournalGrid from '@/components/JournalGrid';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import { Button } from '@/components/ui/button';
import { Moon, Sun, BookOpen, ChevronRight, ChevronLeft } from 'lucide-react';

export default function Journal() {
  const [visibleBlocks, setVisibleBlocks] = useState(30);
  const [startDate, setStartDate] = useState(startOfYear(new Date()));
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [journalEntries, setJournalEntries] = useState<Record<string, string>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const currentYear = new Date().getFullYear();

  // Load journal entries for both grid and preview
  useEffect(() => {
    const savedEntries = localStorage.getItem(`journal-entries-${currentYear}`);
    if (savedEntries) {
      try {
        const entries = JSON.parse(savedEntries);
        setJournalEntries(entries);
        console.log(`Loaded ${Object.keys(entries).length} journal entries for ${currentYear}`);
      } catch (error) {
        console.error('Failed to load journal entries:', error);
        setJournalEntries({});
      }
    }
  }, [currentYear]);

  // Save journal entries whenever they change
  useEffect(() => {
    if (Object.keys(journalEntries).length > 0) {
      localStorage.setItem(`journal-entries-${currentYear}`, JSON.stringify(journalEntries));
      console.log(`Saved ${Object.keys(journalEntries).length} journal entries for ${currentYear}`);
    }
  }, [journalEntries, currentYear]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleJournalContentChange = (date: Date, content: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setJournalEntries(prev => {
      const updated = {
        ...prev,
        [dateKey]: content
      };
      // Remove empty entries to keep localStorage clean
      if (!content.trim()) {
        delete updated[dateKey];
      }
      return updated;
    });
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
                <h1 className="text-xl font-bold text-foreground" data-testid="app-title">
                  365 Journal
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your year in words
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="hover-elevate"
              data-testid="button-theme-toggle"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Collapsible Sidebar */}
      <CollapsibleSidebar
        visibleBlocks={visibleBlocks}
        onVisibleBlocksChange={setVisibleBlocks}
        startDate={startDate}
        onStartDateChange={setStartDate}
        totalBlocks={365}
        currentYear={currentYear}
        journalEntries={journalEntries}
        isCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      {/* Main Content - Full Width */}
      <main className="w-full px-6 py-8">
        <div className="w-full">
          <JournalGrid
            visibleBlocks={visibleBlocks}
            startDate={startDate}
            year={currentYear}
            isDarkMode={isDarkMode}
            entries={journalEntries}
            onContentChange={handleJournalContentChange}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-white/20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            Capture your thoughts, one day at a time. All entries are saved locally in your browser.
          </p>
        </div>
      </footer>
    </div>
  );
}