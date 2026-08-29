import { useEffect, useRef, useState } from 'react';

export function MultiSelectDropdown<T extends string>({
  label,
  options,
  labels,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  label: string;
  options: T[];
  labels: Record<T, string>;
  selected: Set<T>;
  onToggle: (value: T) => void;
  onSelectAll?: () => void;
  onSelectNone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const summary = selected.size === options.length ? 'Alle' : `${selected.size}/${options.length}`;

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className={`dropdown-toggle${open ? ' is-open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className="dropdown-toggle-label">{label}</span>
        <span className="dropdown-toggle-summary">{summary}</span>
        <span className="dropdown-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="dropdown-panel">
          {onSelectAll && onSelectNone && (
            <div className="dropdown-actions">
              <button type="button" onClick={onSelectAll}>
                Alle
              </button>
              <button type="button" onClick={onSelectNone}>
                Keine
              </button>
            </div>
          )}
          {options.map((option) => (
            <label className="dropdown-option" key={option}>
              <input type="checkbox" checked={selected.has(option)} onChange={() => onToggle(option)} />
              {labels[option]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
