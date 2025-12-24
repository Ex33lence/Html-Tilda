
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceType, TabType, LogEntry, CodeStats, PerformanceData } from './types.ts';
import { DEFAULT_CODE, DEVICES, GRIDS } from './constants.ts';
import Editor, { EditorHandle } from './components/Editor.tsx';
import Preview from './components/Preview.tsx';
import { getPerformanceAnalysis } from './services/geminiService.ts';

const App: React.FC = () => {
  const [code, setCode] = useState(() => localStorage.getItem('ex33_code_v3') || DEFAULT_CODE);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [activeTab, setActiveTab] = useState<TabType>(TabType.CODE);
  const [gridActive, setGridActive] = useState(false);
  const [gridSize, setGridSize] = useState(1200);
  const [zoom, setZoom] = useState(100);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<CodeStats>({ chars: 0, words: 0, lines: 0, sizeKb: '0' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [editorWidth, setEditorWidth] = useState(45);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ex33_dark_mode') === 'true');
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isResizing = useRef(false);
  const editorRef = useRef<EditorHandle>(null);

  useEffect(() => {
    localStorage.setItem('ex33_code_v3', code);
  }, [code]);

  useEffect(() => {
    localStorage.setItem('ex33_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLog = useCallback((log: any) => {
    setLogs(prev => [{
      level: log.level,
      message: log.message,
      time: Date.now()
    }, ...prev].slice(0, 50));
  }, []);

  const runCode = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
    if (activeTab === TabType.PERF && !perfData) {
      startAnalysis();
    }
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = await getPerformanceAnalysis(code);
      if (analysis) setPerfData(analysis);
      handleLog({ level: 'info', message: 'Анализ производительности завершен' });
    } catch (e) {
      handleLog({ level: 'error', message: 'Ошибка анализа производительности' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const beautifyCode = () => {
    const beautified = code
      .replace(/>\s*</g, '>\n<')
      .replace(/({|})/g, '$1\n')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l)
      .join('\n');
    setCode(beautified);
  };

  const getMediaUrls = () => {
    const regex = /(?:["'\(])(https?:\/\/[^"' \)]+\.(?:jpg|jpeg|png|gif|webp|svg|avif|mp4|webm)[^"' \)]*|(?:(?:\.\.\/)+|\/)[^"' \)]+\.(?:jpg|jpeg|png|gif|webp|svg|avif|mp4|webm)[^"' \)]*)(?:["'\)])/gi;
    const urls: string[] = [];
    let match;
    const srcsetRegex = /srcset\s*=\s*["']([^"']+)["']/gi;
    let srcsetMatch;
    while ((srcsetMatch = srcsetRegex.exec(code)) !== null) {
      const parts = srcsetMatch[1].split(',');
      parts.forEach(p => {
        const url = p.trim().split(' ')[0];
        if (url && url.length > 5) urls.push(url);
      });
    }
    while ((match = regex.exec(code)) !== null) {
      const url = match[1];
      if (url && url.length > 5 && !url.startsWith('data:')) urls.push(url);
    }
    return Array.from(new Set(urls)).filter(url => url && typeof url === 'string');
  };

  const getEmojis = () => {
    // Улучшенный regex для поиска именно эмодзи, исключая обычную пунктуацию
    const regex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
    const found = code.match(regex);
    // Фильтруем, чтобы оставить только реальные эмодзи
    return Array.from(new Set(found || [])).filter(e => e.trim().length > 0);
  };

  const getColors = () => {
    const hex = [...new Set(code.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g))].slice(0, 8);
    return hex;
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    setCode(prev => prev.split(searchQuery).join(replaceQuery));
  };

  const handleFocusText = (text: string) => {
    if (!text) return;
    setActiveTab(TabType.CODE);
    setTimeout(() => {
        editorRef.current?.focusAndSelect(text);
    }, 60);
  };

  const replaceInstance = (oldVal: string, newVal: string) => {
    if (!newVal || oldVal === newVal) return;
    setCode(prev => prev.split(oldVal).join(newVal));
  };

  const removeEmojiSafe = (emoji: string) => {
    setCode(prev => prev.split(emoji).join(''));
  };

  const copyCodeToClipboard = async () => {
    try {
      window.focus();
      await navigator.clipboard.writeText(code);
      handleLog({ level: 'info', message: 'Код скопирован в буфер обмена' });
    } catch (err) {
      handleLog({ level: 'error', message: 'Ошибка при копировании кода' });
    }
  };

  const pasteCodeFromClipboard = async () => {
    try {
      window.focus();
      const text = await navigator.clipboard.readText();
      if (text) {
        setCode(text);
        handleLog({ level: 'info', message: 'Код вставлен из буфера обмена' });
      }
    } catch (err) {
      handleLog({ level: 'error', message: 'Ошибка при вставке кода (проверьте разрешения)' });
    }
  };

  const clearAllCode = () => {
    if (window.confirm('Очистить весь код?')) {
      setCode('');
      handleLog({ level: 'info', message: 'Редактор очищен' });
    }
  };

  const prepareCanvasForCapture = async (): Promise<HTMLCanvasElement | null> => {
    const el = document.getElementById('device-host');
    if (!el) return null;

    const shotWrapper = document.createElement('div');
    shotWrapper.style.padding = '80px';
    shotWrapper.style.backgroundColor = darkMode ? '#1c1c1c' : '#f1f3f4';
    shotWrapper.style.display = 'inline-block';
    shotWrapper.style.position = 'absolute';
    shotWrapper.style.top = '-9999px';
    shotWrapper.style.left = '-9999px';
    document.body.appendChild(shotWrapper);

    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none'; 
    clone.style.margin = '0';
    clone.style.boxShadow = darkMode ? '0 30px 60px rgba(0,0,0,0.6)' : '0 30px 60px rgba(0,0,0,0.3)';
    shotWrapper.appendChild(clone);

    const originalIframe = el.querySelector('iframe');
    const cloneIframeContainer = clone.querySelector('.overflow-hidden');
    
    if (originalIframe && cloneIframeContainer) {
      const iframeDoc = originalIframe.contentDocument || originalIframe.contentWindow?.document;
      if (iframeDoc) {
        const emptyIframe = cloneIframeContainer.querySelector('iframe');
        if (emptyIframe) emptyIframe.remove();
        
        const contentMock = document.createElement('div');
        contentMock.style.width = '100%';
        contentMock.style.height = '100%';
        contentMock.style.backgroundColor = 'white';
        contentMock.style.overflow = 'hidden';
        contentMock.innerHTML = iframeDoc.documentElement.innerHTML;
        
        const style = document.createElement('style');
        style.innerHTML = `body { margin: 0; padding: 0; } * { box-sizing: border-box; }`;
        contentMock.prepend(style);
        
        cloneIframeContainer.appendChild(contentMock);
      }
    }

    try {
      // @ts-ignore
      const canvas = await html2canvas(shotWrapper, { 
        useCORS: true, 
        scale: 2, 
        backgroundColor: null,
        logging: false
      });
      return canvas;
    } catch (err) {
      console.error('Canvas error:', err);
      return null;
    } finally {
      document.body.removeChild(shotWrapper);
    }
  };

  const capturePreview = async () => {
    const canvas = await prepareCanvasForCapture();
    if (canvas) {
      const link = document.createElement('a');
      link.download = `Ex33_Shot_${device}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      handleLog({ level: 'info', message: 'Снимок сохранен' });
    }
  };

  const copyScreenshotToClipboard = async () => {
    try {
      const canvas = await prepareCanvasForCapture();
      if (!canvas) return;
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          window.focus(); // Важно сфокусировать окно перед записью
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          handleLog({ level: 'info', message: 'Макет скопирован в буфер' });
        } catch (e) {
          handleLog({ level: 'error', message: 'Ошибка буфера: сфокусируйте вкладку и попробуйте снова' });
        }
      }, 'image/png');
    } catch (err) {
      handleLog({ level: 'error', message: 'Ошибка копирования макета' });
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) setEditorWidth(newWidth);
    };
    const onMouseUp = () => { isResizing.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const emojisFound = getEmojis();

  // Названия метрик на русском
  const metricLabels: Record<string, string> = {
    fcp: 'Отрисовка (FCP)',
    lcp: 'Крупный контент (LCP)',
    cls: 'Смещение (CLS)',
    tbt: 'Блокировка (TBT)'
  };

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 ${darkMode ? 'bg-[#0f0f0f] text-gray-200' : 'bg-[#f8f9fa] text-slate-900'} overflow-hidden`}>
      {/* HEADER */}
      <header className="h-16 flex items-center justify-between px-6 bg-transparent shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg">E</div>
            <div>
              <h1 className="text-sm font-bold leading-none tracking-tight">Ex33 Pro</h1>
              <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {stats.sizeKb} KB — {DEVICES[device].width} × {DEVICES[device].height}
              </div>
            </div>
          </div>
          
          <div 
            onClick={() => setActiveTab(TabType.PERF)}
            className={`flex items-center gap-3 px-3 py-1.5 rounded-2xl border cursor-pointer transition-all hover:scale-105 active:scale-95 ${
              darkMode ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200 shadow-sm'
            }`}
          >
            <div className="relative w-7 h-7 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className={darkMode ? 'stroke-[#2c2c2c]' : 'stroke-gray-100'} strokeWidth="3" />
                <circle
                  className={`transition-all duration-1000 ${perfData ? getScoreColor(perfData.score) : 'stroke-gray-300'}`}
                  strokeWidth="3" strokeDasharray={`${perfData ? perfData.score : 0}, 100`} strokeLinecap="round" fill="none" cx="18" cy="18" r="16" style={{ stroke: 'currentColor' }}
                />
              </svg>
              <span className={`text-[9px] font-bold ${perfData ? getScoreColor(perfData.score) : 'text-gray-400'}`}>
                {isAnalyzing ? '...' : (perfData ? perfData.score : '--')}
              </span>
            </div>
            <span className={`text-[10px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>PSI</span>
          </div>

          <button onClick={() => setDarkMode(!darkMode)} className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all ${darkMode ? 'bg-[#1e1e1e] border-[#333] text-amber-400' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
            {darkMode ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1-8.313-12.454z"/></svg><span className="text-[10px] font-bold uppercase">Ночь</span></>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/></svg><span className="text-[10px] font-bold uppercase">День</span></>
            )}
          </button>
        </div>

        <div className={`flex rounded-[24px] p-1 border shadow-sm transition-colors ${darkMode ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200'}`}>
          {(Object.keys(DEVICES) as DeviceType[]).map(d => (
            <button key={d} onClick={() => { setDevice(d); runCode(); }} className={`flex flex-col items-center px-4 py-1.5 rounded-2xl gap-0.5 transition-all min-w-[60px] ${device === d ? 'bg-blue-600 text-white shadow-md' : `text-gray-400 ${darkMode ? 'hover:bg-[#2a2a2a]' : 'hover:bg-gray-50'}`}`}>
              <span className={`text-[8px] font-bold uppercase ${device === d ? 'text-blue-100' : 'text-gray-400'}`}>{DEVICES[d].label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center border rounded-2xl overflow-hidden shadow-sm transition-colors ${darkMode ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200'}`}>
            <button onClick={copyScreenshotToClipboard} className={`px-4 py-3 text-[10px] font-bold uppercase transition-colors border-r active:scale-95 ${darkMode ? 'hover:bg-[#2a2a2a] border-[#333] text-gray-300' : 'hover:bg-gray-50 border-gray-100 text-gray-600'}`}>Копировать макет</button>
            <button onClick={capturePreview} className={`px-4 py-3 text-[10px] font-bold uppercase transition-colors active:scale-95 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-300' : 'hover:bg-gray-50 text-gray-600'}`}>Сохранить снимок</button>
          </div>
          <button onClick={() => {
              const w = window.open();
              if (w) { 
                w.document.open();
                w.document.write(code); 
                w.document.close(); 
              }
          }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[12px] font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95">Открыть страницу</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 pt-0 gap-4">
        <div style={{ width: `${editorWidth}%` }} className="flex flex-col gap-3 shrink-0 min-w-[300px]">
          {/* SEARCH & REPLACE */}
          <div className={`rounded-[24px] p-2 border shadow-sm flex flex-col gap-2 transition-colors ${darkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 px-1">
              <div className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-1.5 border transition-all ${darkMode ? 'bg-[#1e1e1e] border-transparent focus-within:border-blue-800' : 'bg-gray-50 border-transparent focus-within:border-blue-200 focus-within:bg-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input type="text" placeholder="Найти в коде..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFocusText(searchQuery)} className="bg-transparent text-xs outline-none w-full font-medium" />
                <button onClick={() => handleFocusText(searchQuery)} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${searchQuery ? 'text-blue-500 hover:bg-blue-900/30' : 'text-gray-600 pointer-events-none'}`}>НАЙТИ</button>
              </div>
              <button onClick={beautifyCode} className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-blue-900/20 text-blue-400' : 'hover:bg-blue-50 text-blue-600'}`} title="Причесать код">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
              </button>
            </div>
            <div className="flex items-center gap-2 px-1 pb-1">
              <div className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-1.5 border transition-all ${darkMode ? 'bg-[#1e1e1e] border-transparent focus-within:border-blue-800' : 'bg-gray-50 border-transparent focus-within:border-blue-200 focus-within:bg-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-400"><path d="M17 3L21 7L17 11"/><path d="M3 13L7 17L3 21"/><path d="M21 7H3"/><path d="M3 17H21"/></svg>
                <input type="text" placeholder="Заменить на..." value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)} className="bg-transparent text-xs outline-none w-full font-medium" />
                <button onClick={handleReplaceAll} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${searchQuery ? 'text-amber-500 hover:bg-amber-900/30' : 'text-gray-600 pointer-events-none'}`}>ЗАМЕНИТЬ ВСЁ</button>
              </div>
            </div>
          </div>

          <div className={`flex-1 rounded-[24px] border shadow-sm overflow-hidden flex flex-col transition-colors ${darkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-white border-gray-200'}`}>
            <div className={`px-6 py-4 border-b flex justify-between items-center relative z-10 transition-colors ${darkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-white border-gray-200'}`}>
              <div className="flex gap-6">
                {(Object.values(TabType)).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all pb-1 ${
                      activeTab === t ? 'text-blue-500 border-blue-500' : `border-transparent hover:text-gray-400 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`
                    }`}
                  >
                    {t === TabType.EMOJI && emojisFound.length > 0 ? (
                      <span className="flex items-center gap-1.5">Эмодзи <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span></span>
                    ) : (t === TabType.PERF ? 'PSI' : t === TabType.MEDIA ? 'Медиа' : t === TabType.CODE ? 'Код' : t)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {getColors().map((c, i) => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-full border cursor-pointer shadow-sm hover:scale-125 transition-transform ${darkMode ? 'border-white/10' : 'border-gray-200'}`} style={{ backgroundColor: c }} onClick={() => handleFocusText(c)} title={c} />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {activeTab === TabType.CODE && <Editor ref={editorRef} value={code} onChange={setCode} onStatsChange={setStats} darkMode={darkMode} />}
              
              {activeTab === TabType.MEDIA && (
                <div className={`p-6 overflow-y-auto h-full transition-colors ${darkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                   <div className="grid grid-cols-1 gap-4">
                    {getMediaUrls().map((url, i) => {
                        const extension = url.split('.').pop()?.split(/[#?]/)[0].toUpperCase() || 'IMG';
                        return (
                          <div key={i} className={`p-5 rounded-2xl border flex flex-col gap-4 group transition-colors shadow-md ${darkMode ? 'bg-[#181818] border-[#333] hover:border-blue-900' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                              <div className="flex items-start gap-4">
                                  <div className={`w-20 h-20 rounded-xl overflow-hidden shadow-inner border shrink-0 ${darkMode ? 'bg-[#222] border-[#444]' : 'bg-gray-100 border-gray-100'}`}>
                                      <img src={url} className="w-full h-full object-cover" alt="preview" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/80?text=Error')} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">{extension}</span>
                                          <p className={`text-[10px] truncate font-mono ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{url}</p>
                                      </div>
                                      <div className="flex gap-3">
                                        <button onClick={() => handleFocusText(url)} className="text-blue-500 text-[10px] font-bold hover:underline uppercase flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>Найти</button>
                                        <button onClick={() => replaceInstance(url, '')} className="text-red-500 text-[10px] font-bold hover:underline uppercase flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Вырезать</button>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <input className={`flex-1 text-[11px] px-3 py-2 rounded-xl outline-none border transition-colors ${darkMode ? 'bg-[#222] border-[#444] text-gray-300 focus:border-blue-800' : 'bg-gray-50 border-gray-100 focus:border-blue-200'}`} placeholder="Заменить на новый URL..." onKeyDown={(e) => e.key === 'Enter' && replaceInstance(url, (e.target as HTMLInputElement).value)} />
                                  <button onClick={(e) => { const input = e.currentTarget.previousSibling as HTMLInputElement; replaceInstance(url, input.value); }} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-bold rounded-xl uppercase shadow-md active:scale-95">Ок</button>
                              </div>
                          </div>
                        );
                    })}
                    {getMediaUrls().length === 0 && <div className="text-center py-20 text-gray-500 italic">Медиа не найдено</div>}
                   </div>
                </div>
              )}

              {activeTab === TabType.EMOJI && (
                <div className={`p-6 overflow-y-auto h-full transition-colors ${darkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                    {emojisFound.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        <div className={`border p-4 rounded-2xl mb-2 flex gap-3 shadow-sm transition-colors ${darkMode ? 'bg-amber-950/20 border-amber-900/50' : 'bg-amber-50 border-amber-100'}`}>
                            <div className="text-xl">⚠️</div>
                            <div>
                                <p className={`text-[11px] font-bold uppercase mb-0.5 ${darkMode ? 'text-amber-500' : 'text-amber-800'}`}>Эмодзи обнаружены</p>
                                <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-amber-700' : 'text-amber-600'}`}>Рекомендуется заменить их на текст или иконки для лучшей совместимости.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {emojisFound.map((em, i) => (
                            <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between transition-colors shadow-sm ${darkMode ? 'bg-[#181818] border-[#333] hover:border-blue-900' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl shadow-inner border ${darkMode ? 'bg-[#222] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>{em}</div>
                                <div className="text-[10px] font-mono text-gray-500">U+{em.codePointAt(0)?.toString(16).toUpperCase()}</div>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => handleFocusText(em)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="Найти в коде"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
                                <button onClick={() => removeEmojiSafe(em)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Удалить из кода"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4 opacity-20"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>
                        <p className="text-sm">Эмодзи в коде не найдены</p>
                      </div>
                    )}
                </div>
              )}

              {activeTab === TabType.PERF && (
                <div className={`p-8 overflow-y-auto h-full transition-colors ${darkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                   {!perfData && !isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 mb-6"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
                        <h3 className="text-lg font-bold mb-2">Анализ производительности</h3>
                        <p className="text-sm text-gray-500 mb-8 max-w-xs">Оцените скорость и качество вашего кода в стиле Google PageSpeed Insights.</p>
                        <button onClick={startAnalysis} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">Запустить тест</button>
                      </div>
                   ) : (
                      <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className={`p-8 rounded-[32px] border shadow-xl flex items-center gap-12 transition-colors ${darkMode ? 'bg-[#181818] border-[#333]' : 'bg-white border-gray-100'}`}>
                           <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" className={darkMode ? 'stroke-[#2c2c2c]' : 'stroke-gray-100'} strokeWidth="2.5" />
                                <circle cx="18" cy="18" r="16" fill="none" className={`transition-all duration-1000 ${perfData ? getScoreColor(perfData.score) : 'stroke-gray-300'}`} strokeWidth="2.5" strokeDasharray={`${perfData ? perfData.score : 0}, 100`} strokeLinecap="round" style={{ stroke: 'currentColor' }} />
                              </svg>
                              <span className={`text-4xl font-bold ${perfData ? getScoreColor(perfData.score) : 'text-gray-400'}`}>{isAnalyzing ? '...' : (perfData?.score || 0)}</span>
                           </div>
                           <div className="flex-1">
                              <div className="flex justify-between items-start mb-4">
                                <h2 className="text-2xl font-bold">Анализ PSI</h2>
                                <div className="text-xs uppercase font-bold text-gray-400 tracking-wider">Имитация Google PageSpeed</div>
                              </div>
                              <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                                 {Object.entries(perfData?.metrics || {}).map(([key, val]) => (
                                    <div key={key}>
                                       <p className="text-[10px] font-bold uppercase text-gray-500 mb-0.5">{metricLabels[key] || key}</p>
                                       <p className="text-lg font-bold">{val || '--'}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                        
                        <div className="space-y-4">
                           <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 ml-4">Советы по оптимизации</h3>
                           <div className="space-y-3">
                            {perfData?.suggestions.map((s, i) => (
                                <div key={i} className={`p-5 rounded-2xl border flex gap-4 transition-colors ${darkMode ? 'bg-[#181818] border-[#333]' : 'bg-white border-gray-100'}`}>
                                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center text-amber-600 shrink-0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg></div>
                                  <p className="text-sm font-medium leading-snug">{s}</p>
                                </div>
                            ))}
                           </div>
                        </div>

                        <div className="flex justify-center pt-4">
                           <button 
                             onClick={startAnalysis} 
                             disabled={isAnalyzing}
                             className={`flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl hover:bg-blue-700 transition-all active:scale-95 ${isAnalyzing ? 'opacity-50 cursor-wait' : ''}`}
                           >
                              {isAnalyzing ? (
                                <><svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="1"/></svg> Анализируем...</>
                              ) : (
                                <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8m0-5v5h-5"/></svg> Перезапустить анализ</>
                              )}
                           </button>
                        </div>
                      </div>
                   )}
                </div>
              )}
              
              {activeTab === TabType.LOG && (
                <div className="p-4 bg-[#0a0a0a] h-full overflow-y-auto roboto-mono text-[11px]">
                  {logs.map((log, i) => (
                    <div key={i} className={`mb-1.5 flex gap-3 ${log.level === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
                      <span className="opacity-30 shrink-0">[{new Date(log.time).toLocaleTimeString()}]</span>
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className={`px-6 py-3 border-t flex justify-between items-center transition-colors ${darkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-white border-gray-200'}`}>
                <div className="text-[10px] font-bold text-green-600 uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>TILDA-RENDER READY</div>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center rounded-xl border p-1 transition-colors ${darkMode ? 'bg-[#1e1e1e] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>
                    <button onClick={copyCodeToClipboard} className={`p-1.5 rounded-lg transition-all active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500 hover:text-blue-400' : 'hover:bg-white hover:text-blue-600 hover:shadow-sm text-gray-400'}`} title="Копировать код"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                    <button onClick={pasteCodeFromClipboard} className={`p-1.5 rounded-lg transition-all active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500 hover:text-blue-400' : 'hover:bg-white hover:text-blue-600 hover:shadow-sm text-gray-400'}`} title="Вставить код"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></button>
                    <button onClick={() => editorRef.current?.selectAll()} className={`p-1.5 rounded-lg transition-all active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500 hover:text-blue-400' : 'hover:bg-white hover:text-blue-600 hover:shadow-sm text-gray-400'}`} title="Выделить всё"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12h10M12 7v10"/></svg></button>
                    <button onClick={clearAllCode} className={`p-1.5 rounded-lg transition-all active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500 hover:text-red-400' : 'hover:bg-white hover:text-red-600 hover:shadow-sm text-gray-400'}`} title="Очистить всё"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                  </div>
                  <div className={`text-[10px] font-bold uppercase transition-colors ${darkMode ? 'text-gray-700' : 'text-gray-300'}`}>EX33 V7 ULTIMATE</div>
                </div>
            </div>
          </div>
        </div>

        {/* RESIZER */}
        <div className={`w-2 cursor-col-resize transition-colors rounded-full shrink-0 flex items-center justify-center group ${darkMode ? 'hover:bg-blue-900/30' : 'hover:bg-blue-200'}`} onMouseDown={() => isResizing.current = true}>
            <div className={`w-1 h-16 rounded-full transition-colors ${darkMode ? 'bg-[#2c2c2c] group-hover:bg-blue-800' : 'bg-gray-200 group-hover:bg-blue-400'}`} />
        </div>

        {/* RIGHT: PREVIEW PANE */}
        <div className="flex-1 flex flex-col gap-4 relative min-w-[300px]">
          <Preview code={code} device={device} gridActive={gridActive} gridSize={gridSize} zoom={zoom} onLog={handleLog} isRefreshing={isRefreshing} darkMode={darkMode} />
        </div>
      </main>
    </div>
  );
};

export default App;
