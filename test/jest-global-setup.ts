/**
 * Jest globalSetup for unit tests. Pins a time zone west of UTC so specs that
 * check local-date behavior (date presets, date-only parsing) fail on a UTC
 * machine like CI when code slips into UTC formatting.
 */
export default function globalSetup(): void {
  process.env.TZ = 'America/Sao_Paulo';
}
