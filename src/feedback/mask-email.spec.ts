import { maskEmail } from './mask-email';

describe('maskEmail', () => {
  it('keeps the first two characters of the local part and the first of the domain', () => {
    expect(maskEmail('anahelenasilva@hotmail.com')).toBe('an****@h****.***');
  });

  it('hides the TLD of a domain with several labels', () => {
    expect(maskEmail('someone@mail.example.co.uk')).toBe('so****@m****.***');
  });

  it('never shows a two-character local part in full', () => {
    expect(maskEmail('ab@example.com')).toBe('a****@e****.***');
  });

  it('shows nothing of a one-character local part', () => {
    expect(maskEmail('a@example.com')).toBe('****@e****.***');
  });

  it('masks everything when the value is not an email', () => {
    expect(maskEmail('not-an-email')).toBe('****');
    expect(maskEmail('@example.com')).toBe('****');
    expect(maskEmail('user@')).toBe('****');
  });
});
