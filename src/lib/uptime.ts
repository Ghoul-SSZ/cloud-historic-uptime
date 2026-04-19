/** Max downtime contribution per incident (24 hours).
 *  Multi-week "known issues" are tracked as incidents but aren't continuous full outages. */
export const MAX_INCIDENT_MINUTES = 24 * 60;

/** Build Y-axis ticks that won't produce duplicate labels when formatted.
 *  Returns { ticks, formatter } for the given min..100 range. */
export function buildYAxisConfig(minValue: number): {
  domain: [number, number];
  ticks: number[];
  formatter: (v: number) => string;
} {
  const yMin = Math.floor(minValue * 10) / 10;
  const range = 100 - yMin;

  let step: number;
  let precision: number;

  if (range >= 5) {
    step = Math.ceil(range / 5);
    precision = 0;
  } else if (range >= 1) {
    step = Math.ceil(range * 2) / 10;
    precision = 1;
  } else if (range >= 0.1) {
    step = Math.ceil(range * 20) / 100;
    precision = 2;
  } else {
    step = Math.ceil(range * 200) / 1000;
    precision = 3;
  }

  // Ensure step is not zero
  if (step === 0) step = 0.001;

  const ticks: number[] = [];
  for (let v = yMin; v <= 100; v = Math.round((v + step) * 1000) / 1000) {
    ticks.push(v);
  }
  if (ticks[ticks.length - 1] !== 100) ticks.push(100);

  return {
    domain: [yMin, 100] as [number, number],
    ticks,
    formatter: (v: number) => `${v.toFixed(precision)}%`,
  };
}

interface IncidentInterval {
  startedAt: string;
  durationMinutes: number | null;
}

/** Merge overlapping time intervals and return total non-overlapping minutes.
 *  Each incident is capped at MAX_INCIDENT_MINUTES. */
export function mergedDowntimeMinutes(incidents: IncidentInterval[]): number {
  const intervals = incidents
    .map((inc) => {
      const start = new Date(inc.startedAt).getTime();
      const duration = Math.min(inc.durationMinutes ?? 0, MAX_INCIDENT_MINUTES);
      return { start, end: start + duration * 60000 };
    })
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let curEnd = -Infinity;

  for (const { start, end } of intervals) {
    if (start >= curEnd) {
      total += end - start;
      curEnd = end;
    } else if (end > curEnd) {
      total += end - curEnd;
      curEnd = end;
    }
  }

  return total / 60000;
}
