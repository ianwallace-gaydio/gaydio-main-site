/* Start and end dates, as Aiir has on everything: a block in a content area,
 * an item in a sectional, a page's "Page Available". Wall-clock London time,
 * written as 2026-10-17T09:00 (or a date alone, which means all of that day).
 *
 * The site is static, so "now" is build time. Something scheduled to start
 * or finish between builds appears or disappears at the next build; the
 * nightly rebuild (see README) keeps that to a day at most, and anything
 * that must be exact to the minute is read live from the hub instead. */

const LONDON = 'Europe/London';

/** The London wall-clock parts of an instant. */
export function londonParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { year: +get('year'), month: +get('month'), day: +get('day'), hour: +get('hour'), minute: +get('minute') };
}

/** A London wall-clock string to an instant (ms). Invalid or empty: null. */
export function londonToMs(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(text || '').trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const h = m[4] == null ? 0 : +m[4];
  const mi = m[5] == null ? 0 : +m[5];
  // Guess UTC, then correct by the London offset at that moment (twice, for
  // the hour the clocks change).
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i += 1) {
    const p = londonParts(new Date(guess));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess -= asUtc - Date.UTC(y, mo - 1, d, h, mi);
  }
  return guess;
}

/** Whether something with optional start/end is live at `now`. A date-only
 *  end means the whole of that day. */
export function isLiveAt(item, now = Date.now()) {
  const start = londonToMs(item?.start);
  if (start != null && now < start) return false;
  const endText = String(item?.end || '').trim();
  if (endText) {
    const end = londonToMs(endText.length === 10 ? `${endText}T23:59` : endText);
    if (end != null && now > end) return false;
  }
  return true;
}
