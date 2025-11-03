import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import type { JournalMode } from '@/hooks/useJournalData';

interface JournalBlockProps {
  date: Date;
  initialContent?: string;
  onContentChange: (content: string) => void;
  size: 'micro' | 'small' | 'medium' | 'large' | 'xl';
  isVisible: boolean;
  isHovered?: boolean;
  showDateOnHover?: boolean;
  totalBlocks?: number;
  currentMode?: JournalMode;
  readOnly?: boolean;
}

export default function JournalBlock({
  date,
  initialContent = '',
  onContentChange,
  size,
  isVisible,
  isHovered = false,
  showDateOnHover = false,
  totalBlocks = 1,
  currentMode = 'plan',
  readOnly = false
}: JournalBlockProps) {
  const [content, setContent] = useState(initialContent);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    onContentChange(newContent);
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [content, size]);

  const getSizeClasses = () => {
    switch (size) {
      case 'micro':
        return {
          container: `aspect-square ${totalBlocks > 100 ? 'h-[3.5vw] max-h-12 min-h-8' : 'h-16'} text-xs`,
          padding: totalBlocks > 100 ? 'p-0.5' : 'p-1',
          dateText: totalBlocks > 100 ? 'text-[0.6rem]' : 'text-xs',
          contentText: totalBlocks > 100 ? 'text-[0.55rem] leading-none' : 'text-xs leading-tight'
        };
      case 'small':
        return {
          container: 'aspect-square h-24 text-xs',
          padding: 'p-2',
          dateText: 'text-xs',
          contentText: 'text-xs leading-relaxed'
        };
      case 'medium':
        return {
          container: 'aspect-square h-32 text-sm',
          padding: 'p-3',
          dateText: 'text-sm',
          contentText: 'text-sm leading-relaxed'
        };
      case 'large':
        return {
          container: 'aspect-square h-48 text-base',
          padding: 'p-4',
          dateText: 'text-base',
          contentText: 'text-base leading-relaxed'
        };
      case 'xl':
        return {
          container: 'min-h-[60vh] max-h-[80vh] text-lg',
          padding: 'p-6',
          dateText: 'text-lg',
          contentText: 'text-lg leading-relaxed'
        };
      default:
        return {
          container: 'aspect-square h-32 text-sm',
          padding: 'p-3',
          dateText: 'text-sm',
          contentText: 'text-sm leading-relaxed'
        };
    }
  };

  const dateFormats = {
    micro: showDateOnHover ? 'MMM d' : '',
    small: 'MMM d',
    medium: 'MMM d, yyyy',
    large: 'MMMM d, yyyy',
    xl: 'EEEE, MMMM d, yyyy'
  };

  const sizeConfig = getSizeClasses();

  if (!isVisible) return null;

  return (
    <div 
      className={`
        ${sizeConfig.container} 
        bg-white/10 backdrop-blur-md border border-white/20 
        ${totalBlocks > 100 ? 'rounded-sm' : 'rounded-xl'}
        shadow-sm hover:shadow-md transition-all duration-200 ease-out
        ${size !== 'micro' || totalBlocks <= 100 ? 'hover:scale-[1.02]' : 'hover:scale-[1.05]'} hover:bg-white/15
        ${isFocused ? 'ring-2 ring-primary/50 scale-[1.02]' : ''}
        animate-fade-in group overflow-hidden relative
        ${size === 'xl' ? 'col-span-full' : ''}
      `}
      data-testid={`journal-block-${format(date, 'yyyy-MM-dd')}`}
    >
      <div className={`${sizeConfig.padding} h-full flex flex-col`}>
        {/* Date Header - conditional visibility */}
        {(size !== 'micro' || (showDateOnHover && totalBlocks >= 100)) && (
          <div className={`flex items-center ${size === 'micro' ? 'mb-0.5' : 'mb-2'}`}>
            <time 
              className={`${sizeConfig.dateText} font-medium text-foreground/70 ${size === 'micro' && showDateOnHover && totalBlocks >= 100 ? 'absolute top-0.5 left-0.5 bg-black/80 text-white px-1 py-0.5 rounded-sm z-30 opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}
              dateTime={format(date, 'yyyy-MM-dd')}
              data-testid={`date-${format(date, 'yyyy-MM-dd')}`}
            >
              {dateFormats[size] && format(date, dateFormats[size])}
            </time>
          </div>
        )}
        
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          readOnly={!!readOnly}
          disabled={!!readOnly}
          placeholder={
            size === 'xl'
              ? currentMode === 'plan'
                ? 'What do you want to accomplish today? Plan your day...'
                : 'What actually happened today? Record your reality...'
              : size === 'micro' && totalBlocks > 100
                ? ''
                : size === 'micro'
                  ? '...'
                  : currentMode === 'plan'
                    ? 'Your plan...'
                    : 'What happened?'
          }
          className={`
            flex-1 w-full bg-transparent border-none outline-none resize-none
            text-foreground placeholder:text-muted-foreground
            font-light ${sizeConfig.contentText} overflow-hidden
            ${size === 'micro' && totalBlocks > 100 ? 'placeholder:text-transparent' : ''}
          `}
          data-testid={`textarea-${format(date, 'yyyy-MM-dd')}`}
          rows={size === 'xl' ? 20 : size === 'micro' && totalBlocks > 100 ? 2 : size === 'micro' ? 1 : undefined}
        />
        
        {content && size !== 'micro' && (
          <div className={`text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${
            size === 'xl' ? 'opacity-100' : ''
          }`}>
            {content.length} characters
            {size === 'xl' && content.split('\n').length > 1 && (
              <span className="ml-2">• {content.split('\n').length} lines</span>
            )}
          </div>
        )}
        
        {/* Content preview for micro size */}
        {size === 'micro' && totalBlocks > 100 && content && (
          <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 ${totalBlocks > 100 ? 'rounded-sm' : 'rounded-xl'} z-20`}>
            <div className="text-white text-[0.6rem] p-1 max-h-full overflow-hidden leading-tight">
              {content.length > 60 ? content.substring(0, 57) + '...' : content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
