/**
 * The domain never reads the system clock directly. Time is injected so that
 * the demo scenario engine can advance it and tests can pin it.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock {
  const t = new Date(iso);
  return { now: () => new Date(t) };
}
