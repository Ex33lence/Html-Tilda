
import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onStatsChange?: (stats: { chars: number; words: number; lines: number; sizeKb: string }) => void;
  darkMode?: boolean;
}

export interface EditorHandle {
  focusAndSelect: (text: string) => void;
  selectAll: () => void;
}

const Editor = forwardRef<EditorHandle, EditorProps>(({ value, onChange, onStatsChange, darkMode }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
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
        
        // Расчет прокрутки к найденному тексту
        const linesBefore = value.substring(0, index).split('\n').length;
        const lineHeight = 21; // Соответствует leading-relaxed (1.625 * 13px)
        textareaRef.current.scrollTop = (linesBefore - 5) * lineHeight;
        syncScroll();
      }
    },
    selectAll: () => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }));

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
    <div className={`flex-1 flex overflow-hidden relative transition-colors duration-300 roboto-mono text-[13px] leading-relaxed h-full ${darkMode ? 'bg-[#121212]' : 'bg-white'}`}>
      {/* Нумерация строк */}
      <div 
        ref={lineNumbersRef}
        className={`w-12 text-right pr-3 pt-4 select-none border-r overflow-hidden shrink-0 transition-colors duration-300 ${
          darkMode ? 'bg-[#181818] text-[#444] border-[#2c2c2c]' : 'bg-gray-50 text-slate-300 border-slate-100'
        }`}
      >
        {Array.from({ length: Math.max(linesCount, 1) }).map((_, i) => (
          <div key={i} className="h-[21px]">{i + 1}</div>
        ))}
      </div>

      {/* Основное поле ввода */}
      <div className="relative flex-1 overflow-hidden">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className={`w-full h-full p-4 bg-transparent caret-blue-600 resize-none outline-none whitespace-pre-wrap border-none z-10 overflow-y-auto overflow-x-hidden roboto-mono transition-colors duration-300 ${
            darkMode ? 'text-gray-300 selection:bg-blue-900/50' : 'text-slate-800 selection:bg-blue-100'
          }`}
          style={{ 
            tabSize: 2,
            fontFamily: "'Roboto Mono', monospace",
            wordBreak: 'break-word'
          }}
        />
      </div>
    </div>
  );
});

export default Editor;
