import { useState } from 'react';
import CollapsibleSidebar from '../CollapsibleSidebar';
import { startOfYear } from 'date-fns';

export default function CollapsibleSidebarExample() {
  const [visibleBlocks, setVisibleBlocks] = useState(30);
  const [startDate, setStartDate] = useState(startOfYear(new Date()));
  
  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="pl-8">
        <h2 className="text-xl font-semibold mb-4">Collapsible Sidebar Example</h2>
        
        <p className="text-muted-foreground mb-4">
          Click the toggle button in the top-left to show/hide the controls sidebar.
        </p>
        
        <div className="p-4 bg-white/10 backdrop-blur-md rounded-lg">
          <h3 className="font-medium mb-2">Current State:</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>Visible Blocks: {visibleBlocks}</li>
            <li>Start Date: {startDate.toDateString()}</li>
          </ul>
        </div>
      </div>
      
      <CollapsibleSidebar
        visibleBlocks={visibleBlocks}
        onVisibleBlocksChange={(blocks) => {
          setVisibleBlocks(blocks);
          console.log('Visible blocks changed:', blocks);
        }}
        startDate={startDate}
        onStartDateChange={(date) => {
          setStartDate(date);
          console.log('Start date changed:', date);
        }}
        totalBlocks={365}
        currentYear={2024}
        journalEntries={{}}
      />
    </div>
  );
}