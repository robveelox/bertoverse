import { describe, expect, it } from 'vitest';
import { parseCookies } from './auth.js';

describe('authentication helpers', () => {
  it('parses the session cookie without trusting unrelated values', () => {
    expect(parseCookies('theme=dark; greenroom_session=abc123; compact=true')).toEqual({ theme: 'dark', greenroom_session: 'abc123', compact: 'true' });
  });

  it('handles an empty cookie header', () => {
    expect(parseCookies()).toEqual({});
  });
});
