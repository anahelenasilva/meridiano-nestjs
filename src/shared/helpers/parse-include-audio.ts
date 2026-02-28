const TRUTHY_VALUES = new Set(['true', '1', 'yes']);

export function parseIncludeAudio(value: string | undefined): boolean {
  if (value === undefined || value === '') {
    return false;
  }
  return TRUTHY_VALUES.has(value.toLowerCase().trim());
}
