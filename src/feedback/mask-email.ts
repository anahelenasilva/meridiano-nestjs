/**
 * Feedback issues are public, so the submitter shows as `an****@h****.***`:
 * enough for the owner to recognise a user, not enough to harvest the address.
 * The local part never shows in full, even when it is one or two characters.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) {
    return '****';
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visibleLocal = local.slice(0, Math.min(2, local.length - 1));
  return `${visibleLocal}****@${domain[0]}****.***`;
}
