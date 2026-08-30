import { useEffect, useRef, useState } from 'react';
import { LANGUAGE_OPTIONS, type Language } from '../i18n';

function LanguageFlag({ language }: { language: Language }) {
  if (language === 'de') {
    return (
      <svg className="language-flag" viewBox="0 0 30 18" aria-hidden="true">
        <rect width="30" height="6" fill="#000" />
        <rect y="6" width="30" height="6" fill="#dd0000" />
        <rect y="12" width="30" height="6" fill="#ffce00" />
      </svg>
    );
  }

  return (
    <svg className="language-flag" viewBox="0 0 60 36" aria-hidden="true">
      <rect width="60" height="36" fill="#012169" />
      <path d="M0 0 60 36M60 0 0 36" stroke="#fff" strokeWidth="7" />
      <path d="M0 0 60 36M60 0 0 36" stroke="#c8102e" strokeWidth="3" />
      <path d="M30 0v36M0 18h60" stroke="#fff" strokeWidth="11" />
      <path d="M30 0v36M0 18h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}

export function LanguageSelector({
  language,
  label,
  onSelect,
}: {
  language: Language;
  label: string;
  onSelect: (language: Language) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = LANGUAGE_OPTIONS.find((option) => option.value === language)!;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="language-selector" ref={ref}>
      <button
        type="button"
        className={open ? 'is-open' : ''}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LanguageFlag language={language} />
        <span>{selected.label}</span>
        <span className="dropdown-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="language-selector-menu" role="listbox" aria-label={label}>
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === language}
              className={option.value === language ? 'is-selected' : ''}
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
              key={option.value}
            >
              <LanguageFlag language={option.value} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
