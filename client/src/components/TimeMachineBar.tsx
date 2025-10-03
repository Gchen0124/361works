import { format } from 'date-fns';
import { Label } from '@/components/ui/label';

interface TimeMachineBarProps {
  timeline: { timestamp: string; entry_type: string }[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}

export default function TimeMachineBar({ timeline, selectedIndex, onIndexChange }: TimeMachineBarProps) {
  const max = Math.max(0, timeline.length - 1);
  const ts = timeline[selectedIndex]?.timestamp;
  const pretty = ts ? format(new Date(ts), 'yyyy-MM-dd HH:mm:ss') : 'No snapshots yet';

  return (
    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 space-y-2" data-testid="time-machine">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Time Machine</Label>
        <div className="text-xs text-muted-foreground">{timeline.length} snapshots</div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={selectedIndex < 0 ? 0 : selectedIndex}
        onChange={(e) => onIndexChange(parseInt(e.target.value))}
        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
      />
      <div className="text-xs text-muted-foreground text-center">{pretty}</div>
    </div>
  );
}
