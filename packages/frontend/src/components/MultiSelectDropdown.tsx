import { useEffect, useRef, useState } from 'react';

export function MultiSelectDropdown<T extends string>({
  label,
  options,
  labels,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  allLabel,
  noneLabel,
  favorites,
  onToggleFavorite,
  favoriteLabels,
}: {
  label: string;
  options: T[];
  labels: Record<T, string>;
  selected: Set<T>;
  onToggle: (value: T) => void;
  onSelectAll?: () => void;
  onSelectNone?: () => void;
  allLabel: string;
  noneLabel: string;
  /** Optional: zeigt pro Option einen Stern-Button zum Favorisieren (z.B. für Serien). */
  favorites?: Set<T>;
  onToggleFavorite?: (value: T) => void;
  favoriteLabels?: { add: string; remove: string };
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

  const summary = selected.size === options.length ? allLabel : `${selected.size}/${options.length}`;

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
                {allLabel}
              </button>
              <button type="button" onClick={onSelectNone}>
                {noneLabel}
              </button>
            </div>
          )}
          {options.map((option) => (
            <label className="dropdown-option" key={option}>
              <input type="checkbox" checked={selected.has(option)} onChange={() => onToggle(option)} />
              <span className="dropdown-option-label">{labels[option]}</span>
              {onToggleFavorite && favoriteLabels && (
                <button
                  type="button"
                  className={`dropdown-favorite${favorites?.has(option) ? ' is-favorite' : ''}`}
                  aria-label={favorites?.has(option) ? favoriteLabels.remove : favoriteLabels.add}
                  title={favorites?.has(option) ? favoriteLabels.remove : favoriteLabels.add}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleFavorite(option);
                  }}
                >
                  {favorites?.has(option) ? '★' : '☆'}
                </button>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
