import React, { useState, useRef, useLayoutEffect } from 'react';

const PRESETS = ['#4B5563', '#FF7A00', '#71717A', '#8B5CF6', '#00E5FF', '#10B981', '#F59E0B', '#FF3333', '#EC4899', '#3B82F6'];

// A small, fully custom color picker (presets + hex input + native <input
// type="color"> for a system picker) rendered in a popover that clamps its
// own position to stay fully on-screen — unlike the raw native color input,
// whose OS "Custom colors" panel can render past the viewport edge when the
// trigger sits near the edge of a docked panel like the Inspector.
export default function ColorPickerPopover({ value, onChange, onReset, resettable }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const POP_W = 200, POP_H = 210;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + POP_W > window.innerWidth - 8) left = window.innerWidth - POP_W - 8;
    if (left < 8) left = 8;
    if (top + POP_H > window.innerHeight - 8) top = rect.top - POP_H - 6;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const close = (e) => { if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <>
      <div
        ref={btnRef}
        className="color-picker-trigger"
        style={{ background: value }}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title="Choose color"
      />
      {open && (
        <div ref={popRef} className="color-picker-popover" style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
          <div className="color-swatches">
            {PRESETS.map(c => (
              <div key={c} className={`color-swatch ${value === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => { onChange(c); setOpen(false); }} />
            ))}
          </div>
          <div className="color-picker-custom-row">
            <input type="color" className="color-input-native" value={value} onChange={e => onChange(e.target.value)} />
            <input
              className="field-input mono"
              style={{ fontSize: 10.5 }}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="#RRGGBB"
            />
          </div>
          {resettable && <button className="btn small" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { onReset(); setOpen(false); }}>Reset to default</button>}
        </div>
      )}
    </>
  );
}
