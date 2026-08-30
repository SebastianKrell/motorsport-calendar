import type { Language } from '../i18n';

export function SourceAttribution({ language }: { language: Language }) {
  if (language === 'en') {
    return (
      <p>
        Race dates: <a href="https://toomuchracing.com">toomuchracing.com</a> (licensed under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</a>) and{' '}
        <a href="https://github.com/sportstimes/f1">sportstimes/f1</a> (MIT). Session times: official
        websites of <a href="https://www.nuerburgring-langstrecken-serie.de">NLS</a>,{' '}
        <a href="https://www.fiawec.com">WEC</a>, <a href="https://www.britishgt.com">British GT</a>,{' '}
        <a href="https://dtm.com">DTM</a>, <a href="https://www.lemanscup.com">Michelin Le Mans Cup</a>,{' '}
        <a href="https://supergt.net/en/calendar">Super GT</a>, SRO series, and{' '}
        <a href="https://raceweek.io">raceweek.io</a> for IMSA.
      </p>
    );
  }

  return (
    <p>
      Renntermine: <a href="https://toomuchracing.com">toomuchracing.com</a> (lizenziert unter{' '}
      <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</a>) und{' '}
      <a href="https://github.com/sportstimes/f1">sportstimes/f1</a> (MIT). Session-Zeiten: offizielle
      Seiten von <a href="https://www.nuerburgring-langstrecken-serie.de">NLS</a>,{' '}
      <a href="https://www.fiawec.com">WEC</a>, <a href="https://www.britishgt.com">British GT</a>,{' '}
      <a href="https://dtm.com">DTM</a>, <a href="https://www.lemanscup.com">Michelin Le Mans Cup</a>,{' '}
      <a href="https://supergt.net/en/calendar">Super GT</a>, den SRO-Serien sowie{' '}
      <a href="https://raceweek.io">raceweek.io</a> für IMSA.
    </p>
  );
}
