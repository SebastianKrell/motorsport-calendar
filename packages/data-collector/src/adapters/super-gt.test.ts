import { describe, expect, it } from 'vitest';
import { extractSuperGtEvents, extractSuperGtSchedule } from './super-gt.js';

const CALENDAR_HTML = `
  <h2>2026 Calendar</h2>
  <table><tbody>
    <tr>
      <td><span class="numerator_s">9</span><span class="denominator_s">19-20</span></td>
      <td><a href="https://supergt.net/en/races/round6-sugo-2">Round6 SUGO</a></td>
      <td>Sportsland SUGO</td>
      <td>2026 AUTOBACS SUPER GT Round6 SUGO GT 300km RACE</td>
    </tr>
    <tr>
      <td><span class="numerator_s">6</span><span class="denominator_s">20-21</span></td>
      <td><a href="https://supergt.net/en/races/round3-malaysia">Round3 MALAYSIA</a></td>
      <td>SEPANG INTERNATIONAL CIRCUIT</td>
      <td>2026 AUTOBACS SUPER GT Round3 (Postponed to 2027)</td>
    </tr>
  </tbody></table>`;

const SCHEDULE_HTML = `
  <div class="table_date_tab"><a data-target="2026-09-19">9/19 予選</a></div>
  <div class="table_date_tab"><a data-target="2026-09-20">9/20 決勝</a></div>
  <div class="table_box">
    <div class="race_box schedule_box pc520" data-from="09:10" data-to="10:45">
      <h6>09:10 - 10:45 SUPER GT : 公式練習</h6>
    </div>
    <div class="race_box schedule_box pc520" data-from="15:00" data-to="15:43">
      <h6>15:00 - 15:43 SUPER GT : 公式予選（Q1）</h6>
    </div>
    <div class="race_box schedule_box pc520" data-from="12:00" data-to="">
      <h6>12:00 - ピットウォーク</h6>
    </div>
  </div>
  <div class="table_box hidden">
    <div class="race_box schedule_box pc520" data-from="12:00" data-to="12:20">
      <h6>12:00 - 12:20 SUPER GT : ウォームアップ走行</h6>
    </div>
    <div class="race_box schedule_box pc520" data-from="13:30" data-to="15:30">
      <h6>13:30 - SUPER GT : 決勝レース（84Laps）</h6>
    </div>
  </div>`;

describe('SUPER-GT-Adapter', () => {
  it('liest bestätigte Rennen und lässt verschobene Läufe aus', () => {
    expect(extractSuperGtEvents(CALENDAR_HTML)).toEqual([
      {
        eventName: 'Sportsland SUGO',
        circuit: 'Sportsland SUGO',
        round: 6,
        raceDate: '2026-09-20',
        scheduleUrl: 'https://supergt.net/races/round6-sugo-2',
        timeZone: 'Asia/Tokyo',
      },
    ]);
  });

  it('übernimmt nur SUPER-GT-Sessions und wandelt japanische Lokalzeit in UTC um', () => {
    const [event] = extractSuperGtEvents(CALENDAR_HTML);

    expect(extractSuperGtSchedule(SCHEDULE_HTML, event)).toEqual([
      expect.objectContaining({
        sessionType: 'fp',
        startUtc: '2026-09-19T00:10:00.000Z',
        endUtc: '2026-09-19T01:45:00.000Z',
      }),
      expect.objectContaining({
        sessionType: 'quali',
        startUtc: '2026-09-19T06:00:00.000Z',
      }),
      expect.objectContaining({
        sessionType: 'fp',
        startUtc: '2026-09-20T03:00:00.000Z',
      }),
      expect.objectContaining({
        sessionType: 'race',
        startUtc: '2026-09-20T04:30:00.000Z',
        endUtc: '2026-09-20T06:30:00.000Z',
      }),
    ]);
  });
});
