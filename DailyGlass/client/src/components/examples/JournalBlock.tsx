import JournalBlock from '../JournalBlock';

export default function JournalBlockExample() {
  const today = new Date();
  
  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-md mx-auto space-y-4">
        <h2 className="text-xl font-semibold mb-4">Journal Block Examples</h2>
        
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Small Size</h3>
          <JournalBlock
            date={today}
            initialContent="A quick note about today..."
            onContentChange={(content) => console.log('Content changed:', content)}
            size="small"
            isVisible={true}
          />
        </div>
        
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Medium Size</h3>
          <JournalBlock
            date={new Date(Date.now() - 86400000)} // Yesterday
            initialContent="Today was quite eventful. I had a great meeting with the team and we discussed some exciting new ideas for the project."
            onContentChange={(content) => console.log('Content changed:', content)}
            size="medium"
            isVisible={true}
          />
        </div>
        
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Large Size</h3>
          <JournalBlock
            date={new Date(Date.now() - 172800000)} // 2 days ago
            initialContent="What a wonderful day! Started with a peaceful morning walk, followed by a productive work session. The weather was perfect - sunny but not too hot. I spent the evening reading a fascinating book about mindfulness and had some great insights about my personal growth journey."
            onContentChange={(content) => console.log('Content changed:', content)}
            size="large"
            isVisible={true}
          />
        </div>
      </div>
    </div>
  );
}