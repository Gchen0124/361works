import { useState } from 'react';
import JournalGrid from '../JournalGrid';
import { startOfYear, addDays } from 'date-fns';

export default function JournalGridExample() {
  const [visibleBlocks, setVisibleBlocks] = useState(14);
  const [startDate, setStartDate] = useState(startOfYear(new Date()));
  
  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold">Journal Grid Example</h2>
        
        {/* Simple Controls for Demo */}
        <div className="flex gap-4 items-center p-4 bg-white/10 backdrop-blur-md rounded-lg">
          <label className="text-sm font-medium">
            Visible Days:
            <input
              type="range"
              min={1}
              max={60}
              value={visibleBlocks}
              onChange={(e) => setVisibleBlocks(parseInt(e.target.value))}
              className="ml-2"
            />
            <span className="ml-2">{visibleBlocks}</span>
          </label>
          
          <button
            onClick={() => setStartDate(addDays(startDate, -7))}
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded"
          >
            ← Week
          </button>
          
          <button
            onClick={() => setStartDate(addDays(startDate, 7))}
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded"
          >
            Week →
          </button>
        </div>
        
        <JournalGrid
          visibleBlocks={visibleBlocks}
          startDate={startDate}
          year={2024}
        />
      </div>
    </div>
  );
}