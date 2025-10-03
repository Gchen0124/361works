import { useState } from 'react';
import ZoomControls from '../ZoomControls';
import { startOfYear } from 'date-fns';

export default function ZoomControlsExample() {
  const [visibleBlocks, setVisibleBlocks] = useState(30);
  const [startDate, setStartDate] = useState(startOfYear(new Date()));
  
  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-4">Zoom Controls Example</h2>
        
        <ZoomControls
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
        />
        
        <div className="mt-6 p-4 bg-white/10 backdrop-blur-md rounded-lg">
          <h3 className="font-medium mb-2">Current State:</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>Visible Blocks: {visibleBlocks}</li>
            <li>Start Date: {startDate.toDateString()}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}