
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceType, TabType, LogEntry, CodeStats } from './types.ts';
import { DEFAULT_CODE, DEVICES, GRIDS } from './constants.ts';
import Editor, { EditorHandle } from './components/Editor.tsx';
import Preview from './components/Preview.tsx';

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

  const runCode = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
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
    const regex = /src\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    const urls: string[] = [];
    let match;
    while ((match = regex.exec(code)) !== null) {
      const url = match[1] || match[2];
      if (url && url.length > 5 && !url.startsWith('data:')) urls.push(url);
    }
    return Array.from(new Set(urls));
  };

  const getEmojis = () => {
    const regex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
    const found = code.match(regex);
    return Array.from(new Set(found || []));
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

  const removeMediaSafe = (url: string) => {
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\ll]/g, '\\$&');
    const imgTagRegex = new RegExp(`<img[^>]*src=["']${escapedUrl}["'][^>]*>`, 'gi');
    let newCode = code.replace(imgTagRegex, '');
    const cssUrlRegex = new RegExp(`url\\(['"]?${escapedUrl}['"]?\\)`, 'gi');
    newCode = newCode.replace(cssUrlRegex, 'none');
    const genericAttrRegex = new RegExp(`\\s[a-z-]+=["']${escapedUrl}["']`, 'gi');
    newCode = newCode.replace(genericAttrRegex, '');
    setCode(newCode);
  };

  const removeEmojiSafe = (emoji: string) => {
    setCode(prev => prev.split(emoji).join(''));
  };

  const copyCodeToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      handleLog({ level: 'info', message: 'Код скопирован в буфер обмена' });
    } catch (err) {
      handleLog({ level: 'error', message: 'Ошибка при копировании кода' });
    }
  };

  const pasteCodeFromClipboard = async () => {
    try {
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

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) setEditorWidth(newWidth);
    };
    const onMouseUp = () => { 
        isResizing.current = false; 
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

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
      console.error('Canvas preparation error:', err);
      return null;
    } finally {
      document.body.removeChild(shotWrapper);
    }
  };

  const capturePreview = async () => {
    const canvas = await prepareCanvasForCapture();
    if (canvas) {
      const link = document.createElement('a');
      link.download = `Ex33_Pro_Shot_${device}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const copyScreenshotToClipboard = async () => {
    const canvas = await prepareCanvasForCapture();
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        handleLog({ level: 'info', message: 'Скриншот скопирован в буфер обмена' });
      }, 'image/png');
    } catch (err) {
      console.error('Clipboard error:', err);
      handleLog({ level: 'error', message: 'Не удалось скопировать скриншот' });
    }
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
          
          {/* DARK MODE TOGGLE */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all ${
              darkMode 
                ? 'bg-[#1e1e1e] border-[#333] text-amber-400' 
                : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
            }`}
          >
            {darkMode ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1-8.313-12.454z"/></svg>
                <span className="text-[10px] font-bold uppercase">Night Mode</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/></svg>
                <span className="text-[10px] font-bold uppercase">Light Mode</span>
              </>
            )}
          </button>
        </div>

        <div className={`flex rounded-[24px] p-1 border shadow-sm transition-colors ${darkMode ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200'}`}>
          {(Object.keys(DEVICES) as DeviceType[]).map(d => (
            <button
              key={d}
              onClick={() => { setDevice(d); runCode(); }}
              className={`flex flex-col items-center px-4 py-1.5 rounded-2xl gap-0.5 transition-all min-w-[60px] ${
                device === d 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : `text-gray-400 ${darkMode ? 'hover:bg-[#2a2a2a]' : 'hover:bg-gray-50'}`
              }`}
            >
              <span className={`text-[8px] font-bold uppercase ${device === d ? 'text-blue-100' : 'text-gray-400'}`}>
                {DEVICES[d].label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center border rounded-2xl overflow-hidden shadow-sm transition-colors ${darkMode ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200'}`}>
            <button onClick={copyScreenshotToClipboard} className={`p-3 transition-colors border-r active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] border-[#333]' : 'hover:bg-gray-50 border-gray-100'}`} title="Скопировать скрин в буфер">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </button>
            <button onClick={capturePreview} className={`p-3 transition-colors active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a]' : 'hover:bg-gray-50'}`} title="Скачать скриншот устройства">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
          </div>
          <button onClick={() => {
              const w = window.open();
              if (w) {
                w.document.write(code);
                w.document.close();
              }
          }} className={`p-3 border rounded-2xl transition-colors shadow-sm ${darkMode ? 'bg-[#1e1e1e] border-[#333] hover:bg-[#2a2a2a]' : 'bg-white border-gray-200 hover:bg-gray-50'}`} title="На весь экран">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          </button>
          <button onClick={runCode} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95">Запустить</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 pt-0 gap-4">
        {/* LEFT: EDITOR PANE */}
        <div style={{ width: `${editorWidth}%` }} className="flex flex-col gap-3 shrink-0 min-w-[300px]">
          <div className={`rounded-[24px] p-2 border shadow-sm flex flex-col gap-2 transition-colors ${darkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 px-1">
              <div className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-1.5 border transition-all ${darkMode ? 'bg-[#1e1e1e] border-transparent focus-within:border-blue-800' : 'bg-gray-50 border-transparent focus-within:border-blue-200 focus-within:bg-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                  type="text" 
                  placeholder="Найти в коде..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFocusText(searchQuery)}
                  className="bg-transparent text-xs outline-none w-full font-medium" 
                />
                <button 
                  onClick={() => handleFocusText(searchQuery)} 
                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${searchQuery ? 'text-blue-500 hover:bg-blue-900/30' : 'text-gray-600 pointer-events-none'}`}
                >
                  НАЙТИ
                </button>
              </div>
              <button onClick={beautifyCode} className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-blue-900/20 text-blue-400' : 'hover:bg-blue-50 text-blue-600'}`} title="Причесать код">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
              </button>
            </div>
            
            <div className="flex items-center gap-2 px-1 pb-1">
              <div className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-1.5 border transition-all ${darkMode ? 'bg-[#1e1e1e] border-transparent focus-within:border-blue-800' : 'bg-gray-50 border-transparent focus-within:border-blue-200 focus-within:bg-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-400"><path d="M17 3L21 7L17 11"/><path d="M3 13L7 17L3 21"/><path d="M21 7H3"/><path d="M3 17H21"/></svg>
                <input 
                  type="text" 
                  placeholder="Заменить на..." 
                  value={replaceQuery}
                  onChange={e => setReplaceQuery(e.target.value)}
                  className="bg-transparent text-xs outline-none w-full font-medium" 
                />
                <button 
                  onClick={handleReplaceAll} 
                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${searchQuery ? 'text-amber-500 hover:bg-amber-900/30' : 'text-gray-600 pointer-events-none'}`}
                >
                  ЗАМЕНИТЬ ВСЁ
                </button>
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
                      activeTab === t 
                        ? 'text-blue-500 border-blue-500' 
                        : `border-transparent hover:text-gray-400 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`
                    }`}
                  >
                    {t === 'emoji' && getEmojis().length > 0 ? (
                        <span className="flex items-center gap-1.5">
                            {t} <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                        </span>
                    ) : t}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {getColors().map((c, i) => (
                    <div 
                      key={i} 
                      className={`w-3.5 h-3.5 rounded-full border cursor-pointer shadow-sm hover:scale-125 transition-transform ${darkMode ? 'border-white/10' : 'border-gray-200'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => handleFocusText(c)}
                      title={c}
                    />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              <div className={activeTab === TabType.CODE ? 'h-full' : 'hidden'}>
                <Editor 
                    ref={editorRef}
                    value={code} 
                    onChange={setCode} 
                    onStatsChange={setStats} 
                    darkMode={darkMode}
                />
              </div>
              
              {activeTab === TabType.MEDIA && (
                <div className={`p-6 overflow-y-auto h-full transition-colors ${darkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                   <div className="space-y-4">
                    {getMediaUrls().map((url, i) => (
                        <div key={i} className={`p-5 rounded-2xl border flex flex-col gap-4 group transition-colors shadow-md ${darkMode ? 'bg-[#181818] border-[#333] hover:border-blue-900' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                            <div className="flex items-start gap-4">
                                <img src={url} className={`w-20 h-20 rounded-xl object-cover shadow-inner border ${darkMode ? 'bg-[#222] border-[#444]' : 'bg-gray-100 border-gray-100'}`} onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/80?text=Error')} />
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] truncate mb-2 font-mono break-all ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{url}</p>
                                    <div className="flex gap-3">
                                      <button 
                                          onClick={() => handleFocusText(url)}
                                          className="text-blue-500 text-[10px] font-bold hover:underline uppercase flex items-center gap-1"
                                      >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                          Найти в коде
                                      </button>
                                      <button 
                                          onClick={() => removeMediaSafe(url)}
                                          className="text-red-500 text-[10px] font-bold hover:underline uppercase flex items-center gap-1"
                                      >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                          Вырезать
                                      </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className={`text-[10px] font-bold uppercase ml-1 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Заменить на...</label>
                                <div className={`flex gap-2 p-1.5 rounded-xl border shadow-inner transition-colors ${darkMode ? 'bg-[#222] border-[#444]' : 'bg-gray-50 border-gray-100'}`}>
                                    <input 
                                        className="flex-1 text-xs bg-transparent border-none outline-none px-2 py-1.5 font-medium"
                                        placeholder="https://mysite.ru/image.png"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            replaceInstance(url, (e.target as HTMLInputElement).value);
                                            (e.target as HTMLInputElement).value = "";
                                          }
                                        }}
                                    />
                                    <button 
                                        onClick={(e) => {
                                          const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                          replaceInstance(url, input.value);
                                          input.value = "";
                                        }}
                                        className="px-5 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 uppercase transition-all shadow-md active:scale-95"
                                    >
                                        Заменить
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {getMediaUrls().length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4 opacity-20"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7m4 0h4v4m-9 5l9-9"/></svg>
                            <p className="text-sm">Медиа не найдено</p>
                        </div>
                    )}
                   </div>
                </div>
              )}

              {activeTab === TabType.EMOJI && (
                <div className={`p-6 overflow-y-auto h-full transition-colors ${darkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                    <div className={`border p-4 rounded-2xl mb-6 flex gap-3 shadow-sm transition-colors ${darkMode ? 'bg-amber-950/20 border-amber-900/50' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="text-xl">⚠️</div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase mb-0.5 ${darkMode ? 'text-amber-500' : 'text-amber-800'}`}>Эмодзи обнаружены</p>
                            <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-amber-700' : 'text-amber-600'}`}>Рекомендуется заменить их на текст или иконки для лучшей совместимости.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {getEmojis().map((em, i) => (
                            <div key={i} className={`p-5 rounded-2xl border flex flex-col gap-4 group shadow-md transition-colors ${darkMode ? 'bg-[#181818] border-[#333] hover:border-blue-900' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 flex items-center justify-center rounded-2xl text-4xl shadow-inner border ${darkMode ? 'bg-[#222] border-[#444]' : 'bg-gray-50 border-gray-50'}`}>{em}</div>
                                        <div>
                                            <p className={`text-[10px] font-mono mb-2 uppercase ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Unicode {em.codePointAt(0)?.toString(16).toUpperCase()}</p>
                                            <div className="flex gap-3">
                                              <button 
                                                  onClick={() => handleFocusText(em)}
                                                  className="text-blue-500 text-[10px] font-bold hover:underline uppercase flex items-center gap-1"
                                              >
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                                  Найти
                                              </button>
                                              <button 
                                                  onClick={() => removeEmojiSafe(em)}
                                                  className="text-red-500 text-[10px] font-bold hover:underline uppercase flex items-center gap-1"
                                              >
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                  Убрать
                                              </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className={`text-[10px] font-bold uppercase ml-1 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Заменить на...</label>
                                    <div className={`flex gap-2 p-1.5 rounded-xl border shadow-inner transition-colors ${darkMode ? 'bg-[#222] border-[#444]' : 'bg-gray-50 border-gray-100'}`}>
                                        <input 
                                            className="flex-1 text-xs bg-transparent border-none outline-none px-2 py-1.5 font-medium"
                                            placeholder="Текст или SVG..."
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                replaceInstance(em, (e.target as HTMLInputElement).value);
                                                (e.target as HTMLInputElement).value = "";
                                              }
                                            }}
                                        />
                                        <button 
                                            onClick={(e) => {
                                              const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                              replaceInstance(em, input.value);
                                              input.value = "";
                                            }}
                                            className="px-5 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 uppercase transition-all shadow-md active:scale-95"
                                        >
                                            Заменить
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
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
                  {logs.length === 0 && <p className="text-gray-700 italic opacity-30 text-center py-20">Консоль пуста</p>}
                </div>
              )}
            </div>
            
            <div className={`px-6 py-3 border-t flex justify-between items-center transition-colors ${darkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-white border-gray-200'}`}>
                <div className="text-[10px] font-bold text-green-600 uppercase flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    TILDA-RENDER READY
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`flex items-center rounded-xl border p-1 transition-colors ${darkMode ? 'bg-[#1e1e1e] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>
                    <button 
                      onClick={copyCodeToClipboard}
                      className={`p-1.5 rounded-lg transition-all active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500 hover:text-blue-400' : 'hover:bg-white hover:text-blue-600 hover:shadow-sm text-gray-400'}`}
                      title="Копировать код"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button 
                      onClick={pasteCodeFromClipboard}
                      className={`p-1.5 rounded-lg transition-all active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500 hover:text-blue-400' : 'hover:bg-white hover:text-blue-600 hover:shadow-sm text-gray-400'}`}
                      title="Вставить код"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    </button>
                    <button 
                      onClick={() => editorRef.current?.selectAll()}
                      className={`p-1.5 rounded-lg transition-all active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500 hover:text-blue-400' : 'hover:bg-white hover:text-blue-600 hover:shadow-sm text-gray-400'}`}
                      title="Выделить всё"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12h10M12 7v10"/></svg>
                    </button>
                    <button 
                      onClick={clearAllCode}
                      className={`p-1.5 rounded-lg transition-all active:scale-90 ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500 hover:text-red-400' : 'hover:bg-white hover:text-red-600 hover:shadow-sm text-gray-400'}`}
                      title="Очистить всё"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                  <div className={`text-[10px] font-bold uppercase transition-colors ${darkMode ? 'text-gray-700' : 'text-gray-300'}`}>EX33 V7 ULTIMATE</div>
                </div>
            </div>
          </div>
        </div>

        {/* RESIZER (SPLITTER) */}
        <div 
          className={`w-2 cursor-col-resize transition-colors rounded-full shrink-0 flex items-center justify-center group ${darkMode ? 'hover:bg-blue-900/30' : 'hover:bg-blue-200'}`} 
          onMouseDown={(e) => {
              isResizing.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
          }}
        >
            <div className={`w-1 h-16 rounded-full transition-colors ${darkMode ? 'bg-[#2c2c2c] group-hover:bg-blue-800' : 'bg-gray-200 group-hover:bg-blue-400'}`} />
        </div>

        {/* RIGHT: PREVIEW PANE */}
        <div className="flex-1 flex flex-col gap-4 relative min-w-[300px]">
          <div className="absolute top-4 left-4 flex gap-2 z-50">
             <button 
              onClick={() => setGridActive(!gridActive)}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold shadow-md border transition-all ${
                gridActive 
                  ? 'bg-blue-600 border-blue-600 text-white' 
                  : `${darkMode ? 'bg-[#1e1e1ebf] border-[#333] text-gray-400' : 'bg-white/90 border-gray-200 text-gray-600'} backdrop-blur hover:scale-105`
              }`}
             >
                СЕТКА {gridSize}
             </button>
             {gridActive && (
               <div className={`flex backdrop-blur rounded-xl border p-1 shadow-md gap-1 animate-in slide-in-from-left-2 transition-colors ${darkMode ? 'bg-[#1e1e1ebf] border-[#333]' : 'bg-white/90 border-gray-200'}`}>
                 {GRIDS.map(g => (
                    <button 
                      key={g} 
                      onClick={() => setGridSize(g)}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-colors ${gridSize === g ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {g}
                    </button>
                 ))}
               </div>
             )}
          </div>

          <div className={`absolute top-4 right-4 flex items-center backdrop-blur rounded-xl border shadow-md overflow-hidden z-50 transition-colors ${darkMode ? 'bg-[#1e1e1ebf] border-[#333]' : 'bg-white/90 border-gray-200'}`}>
               <button onClick={() => setZoom(Math.max(25, zoom - 10))} className={`p-2.5 transition-colors ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
               </button>
               <div className={`px-3 text-[10px] font-bold border-x min-w-[60px] text-center transition-colors ${darkMode ? 'text-gray-400 border-[#333]' : 'text-gray-700 border-gray-100'}`}>{zoom}%</div>
               <button onClick={() => setZoom(Math.min(150, zoom + 10))} className={`p-2.5 transition-colors ${darkMode ? 'hover:bg-[#2a2a2a] text-gray-500' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
               </button>
          </div>

          <Preview 
            code={code} 
            device={device} 
            gridActive={gridActive} 
            gridSize={gridSize}
            zoom={zoom}
            onLog={handleLog}
            isRefreshing={isRefreshing}
            darkMode={darkMode}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
