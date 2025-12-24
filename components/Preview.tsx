
import React, { useEffect, useRef, useState } from 'react';
import { DeviceType } from '../types.ts';
import { DEVICES } from '../constants.ts';

interface PreviewProps {
  code: string;
  device: DeviceType;
  gridActive: boolean;
  gridSize: number;
  zoom: number;
  onLog: (log: any) => void;
  isRefreshing: boolean;
}

const Preview: React.FC<PreviewProps> = ({ code, device, gridActive, gridSize, zoom, onLog, isRefreshing }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const deviceConfig = DEVICES[device];

  useEffect(() => {
    const calculateScale = () => {
      if (!containerRef.current) return;
      
      // Отступы для комфортного просмотра (уменьшены для мобилок, чтобы устройство было крупнее)
      const padding = deviceConfig.frame === 'phone' ? 80 : 160; 
      const availW = containerRef.current.clientWidth - padding;
      const availH = containerRef.current.clientHeight - padding;
      
      let frameExtraW = 0;
      let frameExtraH = 0;
      
      switch (deviceConfig.frame) {
        case 'phone': frameExtraW = 24; frameExtraH = 24; break;
        case 'tablet': frameExtraW = 24; frameExtraH = 24; break;
        case 'laptop': frameExtraW = 40; frameExtraH = 120; break;
        case 'monitor':
        case 'desktop': frameExtraW = 40; frameExtraH = 140; break;
      }
      
      const frameW = deviceConfig.width + frameExtraW;
      const frameH = deviceConfig.height + frameExtraH;
      
      const scaleW = availW / frameW;
      const scaleH = availH / frameH;
      const baseScale = Math.min(scaleW, scaleH, 1);
      
      setScale(baseScale * (zoom / 100));
    };

    calculateScale();
    const resizeObserver = new ResizeObserver(calculateScale);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [device, zoom, deviceConfig]);

  useEffect(() => {
    const updateIframe = () => {
      if (!iframeRef.current) return;
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;

      // Добавляем сброс стилей (margin: 0) и фикс для высоты, чтобы не было "белых полей"
      const styleReset = `
        <style>
          body { margin: 0; padding: 0; min-height: 100vh; }
          img { max-width: 100%; height: auto; display: block; }
          * { box-sizing: border-box; }
        </style>
      `;

      const logCapture = `
        <script>
          (function() {
            window.onerror = function(msg, url, line) {
              window.parent.postMessage({type: 'log', level: 'error', message: msg + ' (line ' + line + ')'}, '*');
            };
            const origLog = console.log;
            console.log = function(...args) {
              window.parent.postMessage({type: 'log', level: 'info', message: args.join(' ')}, '*');
              origLog.apply(console, args);
            };
            document.addEventListener('click', e => {
              if (e.target.tagName === 'A') e.preventDefault();
            });
          })();
        </script>
      `;

      doc.open();
      let fullCode = code;
      if (fullCode.includes('<head>')) {
        fullCode = fullCode.replace('<head>', '<head>' + styleReset + logCapture);
      } else {
        fullCode = styleReset + logCapture + fullCode;
      }
      doc.write(fullCode);
      doc.close();
    };

    const timer = setTimeout(updateIframe, 400);
    return () => clearTimeout(timer);
  }, [code]);

  const getFrameBaseStyles = () => {
    switch (deviceConfig.frame) {
      case 'phone': 
        return 'border-[12px] border-[#1a1a1a] rounded-[44px] ring-4 ring-black/10 bg-[#1a1a1a]';
      case 'tablet': 
        return 'border-[12px] border-[#2f2f2f] rounded-[24px] ring-4 ring-black/10 bg-[#2f2f2f]';
      case 'laptop': 
        return 'border-[14px] border-[#222] border-b-[20px] rounded-t-[18px] rounded-b-[4px] shadow-2xl bg-[#222]';
      case 'monitor':
      case 'desktop': 
        return 'border-[16px] border-[#1a1a1a] border-b-[40px] rounded-[10px] shadow-2xl bg-[#1a1a1a]';
      default: 
        return 'rounded-sm ring-1 ring-gray-200 bg-white';
    }
  };

  const getIframeRadius = () => {
    switch (deviceConfig.frame) {
      case 'phone': return '32px';
      case 'tablet': return '12px';
      case 'laptop': return '4px';
      case 'monitor':
      case 'desktop': return '0px';
      default: return '0px';
    }
  };

  return (
    <div ref={containerRef} className="flex-1 bg-[#f1f3f4] relative flex items-center justify-center overflow-hidden">
      <div 
        id="device-host"
        style={{ 
          width: deviceConfig.width, 
          height: deviceConfig.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.4s ease, height 0.4s ease',
          boxSizing: 'content-box'
        }}
        className={`relative shrink-0 ${getFrameBaseStyles()} ${isRefreshing ? 'refreshing' : ''}`}
      >
        {/* Внутренний контейнер с обрезкой углов */}
        <div 
          className="absolute inset-0 overflow-hidden bg-white" 
          style={{ borderRadius: getIframeRadius() }}
        >
          <iframe 
            ref={iframeRef}
            title="preview"
            className="w-full h-full border-none bg-white"
          />
          
          {/* Сетка Tilda (внутри обрезки) */}
          <div 
            style={{ width: gridSize, opacity: gridActive ? 1 : 0 }}
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 grid grid-cols-12 gap-5 pointer-events-none z-40 transition-opacity duration-300"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-red-400/[0.03] border-x border-red-400/[0.08] h-full" />
            ))}
          </div>
        </div>

        {/* Детализация рамок */}

        {/* Ноутбук: База */}
        {deviceConfig.frame === 'laptop' && (
          <>
            <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#333] rounded-full z-[60]" />
            <div className="absolute -bottom-[54px] left-1/2 -translate-x-1/2 w-[112%] h-[34px] bg-gradient-to-b from-[#ccc] via-[#aaa] to-[#888] rounded-b-[14px] shadow-xl z-[-1] border-t border-white/30 flex justify-center">
               <div className="w-24 h-2 bg-black/10 rounded-b-full shadow-inner" />
            </div>
          </>
        )}

        {/* Монитор/ПК: Подставка */}
        {(deviceConfig.frame === 'monitor' || deviceConfig.frame === 'desktop') && (
          <div className="absolute -bottom-[125px] left-1/2 -translate-x-1/2 flex flex-col items-center z-[-1]">
             <div className="w-24 h-[90px] bg-gradient-to-r from-[#777] via-[#aaa] to-[#777] shadow-inner" />
             <div className="w-72 h-6 bg-gradient-to-b from-[#999] to-[#666] rounded-t-xl shadow-lg border-b border-black/20" />
          </div>
        )}

        {/* Вырезы для телефонов */}
        {deviceConfig.frame === 'phone' && (
           device === 'iphone' ? (
             <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#1a1a1a] rounded-full z-[60] flex items-center justify-end px-3 gap-1.5 ring-1 ring-white/5">
                <div className="w-1.5 h-1.5 bg-blue-500/20 rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-[#0a0a0a] rounded-full border border-white/5"></div>
             </div>
           ) : (
             <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-[60] flex items-center justify-center border border-white/10 shadow-inner">
                <div className="w-1.5 h-1.5 bg-[#111] rounded-full opacity-60"></div>
             </div>
           )
        )}
      </div>
    </div>
  );
};

export default Preview;
