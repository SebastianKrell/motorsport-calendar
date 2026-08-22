// Drei parallele schräge Pixel-Balken vor dem Schriftzug (klassisches
// "MOTORSPORT"-Wordmark-Motiv) -- nur Rot-Abstufungen, hell zu unserem
// Marken-Rot, keine Fremdmarken-Farben. Die Schräge entsteht durch eine
// Treppenstufen-Verschiebung pro Zeile (Pixel-Look statt glatter Linie).
const STRIPE_BARS = [
  { startCol: 0, color: '#e6b3b3' },
  { startCol: 4, color: '#b5504f' },
  { startCol: 8, color: '#7a1f1f' },
];
const STRIPE_ROWS = 8;
const STRIPE_BAR_WIDTH = 2;
const STRIPE_PIXEL_SIZE = 3;
const STRIPE_SHIFT_EVERY = 2;
const STRIPE_MAX_SHIFT = Math.floor((STRIPE_ROWS - 1) / STRIPE_SHIFT_EVERY);

function PixelStripes() {
  const pixels = STRIPE_BARS.flatMap((bar) =>
    Array.from({ length: STRIPE_ROWS }, (_, row) => {
      const shift = STRIPE_MAX_SHIFT - Math.floor(row / STRIPE_SHIFT_EVERY);
      return Array.from({ length: STRIPE_BAR_WIDTH }, (_, w) => ({
        key: `${bar.startCol}-${row}-${w}`,
        x: (bar.startCol + shift + w) * STRIPE_PIXEL_SIZE,
        y: row * STRIPE_PIXEL_SIZE,
        color: bar.color,
      }));
    }).flat(),
  );

  const gridCols = STRIPE_BARS[STRIPE_BARS.length - 1].startCol + STRIPE_MAX_SHIFT + STRIPE_BAR_WIDTH + 1;
  const width = gridCols * STRIPE_PIXEL_SIZE;
  const height = STRIPE_ROWS * STRIPE_PIXEL_SIZE;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      {pixels.map((pixel) => (
        <rect
          key={pixel.key}
          x={pixel.x}
          y={pixel.y}
          width={STRIPE_PIXEL_SIZE}
          height={STRIPE_PIXEL_SIZE}
          fill={pixel.color}
        />
      ))}
    </svg>
  );
}

export function SiteHeader({
  theme,
  onSelectTheme,
}: {
  theme: 'light' | 'dark';
  onSelectTheme: (theme: 'light' | 'dark') => void;
}) {
  return (
    <header className="site-header-outer">
      <div className="site-header-inner">
        <div className="site-header-logo">
          <PixelStripes />
          <h1 className="site-header-title">MOTORSPORT-KALENDER</h1>
        </div>
        <div className="site-header-actions">
          <div className="theme-toggle">
            <button
              type="button"
              className={theme === 'light' ? 'is-active' : ''}
              onClick={() => onSelectTheme('light')}
            >
              Hell
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'is-active' : ''}
              onClick={() => onSelectTheme('dark')}
            >
              Dunkel
            </button>
          </div>
          <a
            className="site-header-contact"
            href="https://github.com/SebastianKrell/motorsport-calendar/issues"
          >
            Contact
          </a>
        </div>
      </div>
    </header>
  );
}
