import { StaticCredential } from './static-credential';

const HEADER = 'x-external-token';
// From `printf %s second-token | shasum -a 256`.
const SECOND_TOKEN_SHA256 =
  '7a35833597e6687c599a0988b7a53b9b6a7ec18b88ca2a8e60f3265c8be6d527';
const requestWith = (value?: string | string[]) => ({
  headers: value === undefined ? {} : { [HEADER]: value },
});

describe('StaticCredential', () => {
  it.each([undefined, '', [] as string[], ['']])(
    'never accepts a request when the configured value is %p',
    (configured) => {
      const credential = StaticCredential.from(configured);

      expect(credential.check(requestWith(''), HEADER)).toBe('missing');
      expect(credential.check(requestWith('anything'), HEADER)).toBe('invalid');
    },
  );

  describe('with a configured secret', () => {
    const credential = StaticCredential.from('secret-key');

    it('reports a missing header as missing', () => {
      expect(credential.check(requestWith(), HEADER)).toBe('missing');
    });

    it.each(['', '   '])('reports the blank header %p as missing', (value) => {
      expect(credential.check(requestWith(value), HEADER)).toBe('missing');
    });

    it('reads the first value of an array header', () => {
      expect(
        credential.check(requestWith(['secret-key', 'other']), HEADER),
      ).toBe('valid');
      expect(
        credential.check(requestWith(['other', 'secret-key']), HEADER),
      ).toBe('invalid');
    });

    it.each(['secret', 'secret-key-but-longer'])(
      'rejects %p, whose length differs from the secret',
      (value) => {
        expect(credential.check(requestWith(value), HEADER)).toBe('invalid');
      },
    );

    it('reads the header the caller names', () => {
      const request = { headers: { 'x-api-key': 'secret-key' } };

      expect(credential.check(request, 'x-api-key')).toBe('valid');
      expect(credential.check(request, HEADER)).toBe('missing');
    });
  });

  it('accepts a match against any entry in a list', () => {
    const credential = StaticCredential.from(['first-token', 'second-token']);

    expect(credential.check(requestWith('first-token'), HEADER)).toBe('valid');
    expect(credential.check(requestWith('second-token'), HEADER)).toBe('valid');
    expect(credential.check(requestWith('third-token'), HEADER)).toBe(
      'invalid',
    );
  });

  describe('verifiedDigest', () => {
    const credential = StaticCredential.from(['first-token', 'second-token']);

    it('gives the sha256 hex of a matching value instead of the value', () => {
      expect(
        credential.verifiedDigest(requestWith('second-token'), HEADER),
      ).toBe(SECOND_TOKEN_SHA256);
    });

    it.each([undefined, 'third-token'])(
      'gives null for the header %p',
      (value) => {
        expect(
          credential.verifiedDigest(requestWith(value), HEADER),
        ).toBeNull();
      },
    );
  });
});

