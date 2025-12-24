
import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onStatsChange?: (stats: { chars: number; words: number; lines: number; sizeKb: string }) => void;
}

export interface EditorHandle {
  focusAndSelect: (text: string) => void;
}

const Editor = forwardRef<EditorHandle, EditorProps>(({ value, onChange, onStatsChange }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current && lineNumbersRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    focusAndSelect: (text: string) => {
      if (!textareaRef.current) return;
      const index = value.indexOf(text);
      if (index !== -1) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(index, index + text.length);
        
        // Simple scroll to line
        const linesBefore = value.substring(0, index).split('\n').length;
        const lineHeight = 20.8; // Estimated
        textareaRef.current.scrollTop = (linesBefore - 5) * lineHeight;
        syncScroll();
      }
    }
  }));

  const highlightCode = (code: string) => {
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    highlighted = highlighted.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-slate-400 italic">$1</span>');
    highlighted = highlighted.replace(/(&lt;\/?)([a-z0-9-]+)/gi, '$1<span class="text-blue-600 font-semibold">$2</span>');
    highlighted = highlighted.replace(/\s([a-z-]+)=/gi, ' <span class="text-amber-600">$1</span>=');
    highlighted = highlighted.replace(/"([^"]*)"/g, '"<span class="text-emerald-600 font-medium">$1</span>"');
    highlighted = highlighted.replace(/'([^']*)'/g, `'<span class="text-emerald-600 font-medium">$1</span>'`);
    highlighted = highlighted.replace(/([a-z-]+)\s*:/gi, '<span class="text-purple-600">$1</span>:');

    return highlighted;
  };

  useEffect(() => {
    if (onStatsChange) {
      const bytes = new Blob([value]).size;
      onStatsChange({
        chars: value.length,
        words: value.trim() ? value.trim().split(/\s+/).length : 0,
        lines: value.split('\n').length,
        sizeKb: (bytes / 1024).toFixed(1)
      });
    }
  }, [value, onStatsChange]);

  const linesCount = value.split('\n').length;

  return (
    <div className="flex-1 flex overflow-hidden relative bg-[#fafafa] roboto-mono text-[13px] leading-relaxed h-full">
      <div 
        ref={lineNumbersRef}
        className="w-12 bg-white text-slate-300 text-right pr-3 pt-4 select-none border-r border-slate-100 overflow-hidden shrink-0"
      >
        {Array.from({ length: Math.max(linesCount, 1) }).map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div 
          ref={highlightRef}
          className="absolute inset-0 p-4 pointer-events-none whitespace-pre-wrap break-words overflow-auto z-0"
          dangerouslySetInnerHTML={{ __html: highlightCode(value) + "\n" }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-blue-600 resize-none outline-none whitespace-pre-wrap break-words z-10 overflow-auto"
        />
      </div>
    </div>
  );
});

export default Editor;
