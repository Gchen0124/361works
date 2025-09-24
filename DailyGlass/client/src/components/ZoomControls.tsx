import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ZoomIn, ZoomOut, Calendar, Grid } from 'lucide-react';
import { format, addDays, startOfYear } from 'date-fns';

interface ZoomControlsProps {
  visibleBlocks: number;
  onVisibleBlocksChange: (blocks: number) => void;
  startDate: Date;
  onStartDateChange: (date: Date) => void;
  totalBlocks?: number;
  currentYear?: number;
  journalEntries?: Record<string, string>;
}

export default function ZoomControls({ 
  visibleBlocks, 
  onVisibleBlocksChange, 
  startDate, 
  onStartDateChange,
  totalBlocks = 365,
  currentYear = new Date().getFullYear(),
  journalEntries = {}
}: ZoomControlsProps) {
  const [inputValue, setInputValue] = useState(visibleBlocks.toString());
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewDate, setPreviewDate] = useState(startDate);
  
  // Calculate the day of year for the slider
  const yearStart = startOfYear(new Date(currentYear, 0, 1));
  const dayOfYear = Math.floor((startDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const maxStartDay = Math.max(1, totalBlocks - visibleBlocks + 1);

  const handleVisibleBlocksSlider = (value: number) => {
    onVisibleBlocksChange(value);
    setInputValue(value.toString());
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= totalBlocks) {
      onVisibleBlocksChange(numValue);
    }
  };

  const handleStartDateSlider = (value: number) => {
    const newStartDate = addDays(yearStart, value - 1);
    setPreviewDate(newStartDate);
    onStartDateChange(newStartDate);
  };

  const handleStartDateSliderPreview = (value: number) => {
    const newStartDate = addDays(yearStart, value - 1);
    setPreviewDate(newStartDate);
    setIsPreviewMode(true);
  };

  const getPreviewContent = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const content = journalEntries[dateKey];
    if (!content) return null;
    return content.length > 50 ? content.substring(0, 47) + '...' : content;
  };

  const getPreviewDates = () => {
    const dates = [];
    for (let i = 0; i < Math.min(visibleBlocks, 5); i++) {
      dates.push(addDays(previewDate, i));
    }
    return dates;
  };

  const handleZoomIn = () => {
    const newValue = Math.max(1, visibleBlocks - 10);
    handleVisibleBlocksSlider(newValue);
  };

  const handleZoomOut = () => {
    const newValue = Math.min(totalBlocks, visibleBlocks + 10);
    handleVisibleBlocksSlider(newValue);
  };

  const endDate = addDays(startDate, visibleBlocks - 1);

  return (
    <div 
      className="
        bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6
        shadow-xl sticky top-4 z-10 space-y-6
      "
      data-testid="zoom-controls"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Grid className="w-5 h-5" />
          View Controls
        </h2>
        <div className="flex items-center gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleZoomIn}
            data-testid="button-zoom-in"
            className="hover-elevate"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleZoomOut}
            data-testid="button-zoom-out"
            className="hover-elevate"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Visible Blocks Control */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground/80">
            Visible Days
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              min={1}
              max={totalBlocks}
              className="w-16 h-8 text-center bg-white/10 border-white/20"
              data-testid="input-visible-blocks"
            />
            <span className="text-xs text-muted-foreground">/ {totalBlocks}</span>
          </div>
        </div>
        
        <div className="relative">
          <input
            type="range"
            min={1}
            max={totalBlocks}
            value={visibleBlocks}
            onChange={(e) => handleVisibleBlocksSlider(parseInt(e.target.value))}
            className="
              w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer
              slider-thumb:appearance-none slider-thumb:w-4 slider-thumb:h-4 
              slider-thumb:rounded-full slider-thumb:bg-primary slider-thumb:cursor-pointer
              slider-thumb:shadow-lg slider-thumb:border-2 slider-thumb:border-white
            "
            data-testid="slider-visible-blocks"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1 day</span>
            <span>{totalBlocks} days</span>
          </div>
        </div>
      </div>

      {/* Date Range Control */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date Range
          </Label>
          <div className="text-xs text-muted-foreground">
            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
          </div>
        </div>
        
        <div className="relative">
          <input
            type="range"
            min={1}
            max={maxStartDay}
            value={dayOfYear}
            onChange={(e) => handleStartDateSlider(parseInt(e.target.value))}
            onInput={(e) => handleStartDateSliderPreview(parseInt((e.target as HTMLInputElement).value))}
            onMouseEnter={() => setIsPreviewMode(true)}
            onMouseLeave={() => setIsPreviewMode(false)}
            className="
              w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer
              slider-thumb:appearance-none slider-thumb:w-4 slider-thumb:h-4 
              slider-thumb:rounded-full slider-thumb:bg-accent slider-thumb:cursor-pointer
              slider-thumb:shadow-lg slider-thumb:border-2 slider-thumb:border-white
            "
            data-testid="slider-date-range"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Jan 1</span>
            <span>Dec 31</span>
          </div>
        </div>
      </div>

      {/* Preview Info with Content Preview */}
      <div className="bg-white/5 rounded-lg p-3 space-y-2">
        <div className="text-xs text-muted-foreground">
          {isPreviewMode ? 'Preview' : 'Current View'}
        </div>
        <div className="text-sm font-medium">
          {visibleBlocks} days starting from {format(isPreviewMode ? previewDate : startDate, 'MMMM d, yyyy')}
        </div>
        
        {/* Content Preview when dragging */}
        {isPreviewMode && visibleBlocks <= 30 && (
          <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
            {getPreviewDates().map((date) => {
              const content = getPreviewContent(date);
              return (
                <div key={date.toISOString()} className="text-xs border-l-2 border-accent/30 pl-2">
                  <div className="font-medium text-accent">{format(date, 'MMM d')}</div>
                  {content && (
                    <div className="text-muted-foreground leading-tight">{content}</div>
                  )}
                  {!content && (
                    <div className="text-muted-foreground/50 italic">No entry</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Density info for large views */}
        {visibleBlocks > 100 && (
          <div className="text-xs text-muted-foreground/70">
            High density mode • Hover blocks to see content
          </div>
        )}
      </div>
    </div>
  );
}