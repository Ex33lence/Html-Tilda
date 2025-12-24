
import { DeviceConfig, DeviceType } from './types.ts';

export const DEVICES: Record<DeviceType, DeviceConfig> = {
  monitor: { width: 2560, height: 1440, label: '4K', frame: 'monitor' },
  desktop: { width: 1920, height: 1080, label: 'ПК', frame: 'desktop' },
  laptop:  { width: 1440, height: 900,  label: 'Ноутбук', frame: 'laptop' },
  tablet:  { width: 768,  height: 1024, label: 'Планшет', frame: 'tablet' },
  iphone:  { width: 390,  height: 844,  label: 'iPhone', frame: 'phone' },
  xiaomi:  { width: 360,  height: 800,  label: 'Xiaomi', frame: 'phone' }
};

export const GRIDS = [960, 1200, 1400, 1600];

export const DEFAULT_CODE = `<!-- Ex33 Pro Ultimate — Алексей Edition -->
<div style="padding: 80px 20px; text-align: center; font-family: 'Google Sans', sans-serif;">
  <h1 style="color: #1a73e8; font-size: 48px; font-weight: 700;">Ex33 Pro 🚀</h1>
  <p style="color: #5f6368; font-size: 18px;">Профессиональный редактор с AI-архитектором и симулятором устройств.</p>
  <img src="https://picsum.photos/800/400" style="border-radius: 24px; margin-top: 40px; width: 100%; max-width: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
  <div style="margin-top: 40px;">
    <button style="background: #1a73e8; color: white; border: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; cursor: pointer;">Начать работу ✨</button>
  </div>
</div>`;
