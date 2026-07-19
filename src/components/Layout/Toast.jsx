import React from 'react';
import { useDiagramStore } from '../../store/useDiagramStore.js';

export default function Toast() {
  const toast = useDiagramStore(s => s.toast);
  if (!toast) return null;
  return <div className={`toast ${toast.kind === 'warn' ? 'warn' : ''}`}>{toast.msg}</div>;
}
