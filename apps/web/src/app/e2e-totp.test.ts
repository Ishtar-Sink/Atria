import { describe, expect, it } from 'vitest';
import { totpCode } from './e2e-totp';

// Segredo "12345678901234567890" da RFC 6238, em base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totpCode', () => {
  it('matches the RFC 6238 SHA-1 vectors with six digits', async () => {
    await expect(totpCode(RFC_SECRET, 59_000)).resolves.toBe('287082');
    await expect(totpCode(RFC_SECRET, 1_111_111_109_000)).resolves.toBe('081804');
    await expect(totpCode(RFC_SECRET, 1_234_567_890_000)).resolves.toBe('005924');
  });

  it('refuses a secret outside base32', async () => {
    await expect(totpCode('não-é-base32')).rejects.toThrow('base32');
  });
});
