import React, { useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageProvider';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';

export default function DatePresetFilter({ onChange }) {
  const { t } = useTranslation();
  const { state, setState, range } = usePeriodFilter();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    onChange?.(range);
  }, [range.startDate, range.endDate]);

  const presets = [
    { value: 'today', label: t('today') },
    { value: 'month', label: t('thisMonth') },
    { value: 'all', label: t('all') },
    { value: 'custom', label: t('period') },
  ];

  const handlePreset = (val) => {
    setState({ preset: val });
  };

  const handleCustom = (customStart, customEnd) => {
    setState({ preset: 'custom', customStart, customEnd });
  };

  return (
    <div className="date-preset-filter">
      <Calendar size={14} className="dpf-icon" />
      {presets.map(p => (
        <button
          key={p.value}
          className={`dpf-btn ${state.preset === p.value ? 'active' : ''}`}
          onClick={() => handlePreset(p.value)}
        >
          {p.label}
        </button>
      ))}
      {state.preset === 'custom' && (
        <div className="dpf-custom">
          <input type="date" className="dpf-input" value={state.customStart} onChange={e => handleCustom(e.target.value, state.customEnd)} />
          <span className="dpf-sep">→</span>
          <input type="date" className="dpf-input" value={state.customEnd} onChange={e => handleCustom(state.customStart, e.target.value)} />
        </div>
      )}
    </div>
  );
}
