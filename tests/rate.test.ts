'use strict';

import type { RateLimit } from '../server';

let checkRateLimit: (socketId: string, event: string) => boolean;
let clearRateLimitState: (socketId: string) => void;
let RATE_LIMITS: Record<string, RateLimit>;
let rateLimitState: Map<string, Map<string, number[]>>;

beforeEach(() => {
  const server = require('../server');
  checkRateLimit = server.checkRateLimit;
  clearRateLimitState = server.clearRateLimitState;
  RATE_LIMITS = server.RATE_LIMITS;
  rateLimitState = server.rateLimitState;
  rateLimitState.clear();
});

afterAll(() => {
  require('../server').httpServer.close();
});

describe('checkRateLimit', () => {
  test('returns true for first call on limited event', () => {
    expect(checkRateLimit('sock-1', 'roll-dice')).toBe(true);
  });

  test('returns false when maxCalls exceeded within window', () => {
    const { maxCalls } = RATE_LIMITS['roll-dice'];
    for (let i = 0; i < maxCalls; i++) {
      checkRateLimit('sock-1', 'roll-dice');
    }
    expect(checkRateLimit('sock-1', 'roll-dice')).toBe(false);
  });

  test('returns true for unknown event (no limit defined)', () => {
    expect(checkRateLimit('sock-1', 'some-unknown-event')).toBe(true);
  });

  test('rate limits are per-socket (different sockets independent)', () => {
    const { maxCalls } = RATE_LIMITS['roll-dice'];
    for (let i = 0; i < maxCalls; i++) {
      checkRateLimit('sock-A', 'roll-dice');
    }
    expect(checkRateLimit('sock-A', 'roll-dice')).toBe(false);
    expect(checkRateLimit('sock-B', 'roll-dice')).toBe(true);
  });

  test('rate limits are per-event (different events independent)', () => {
    const { maxCalls } = RATE_LIMITS['roll-dice'];
    for (let i = 0; i < maxCalls; i++) {
      checkRateLimit('sock-1', 'roll-dice');
    }
    expect(checkRateLimit('sock-1', 'roll-dice')).toBe(false);
    expect(checkRateLimit('sock-1', 'requestSync')).toBe(true);
  });
});

describe('clearRateLimitState', () => {
  test('removes socket from rateLimitState map', () => {
    checkRateLimit('sock-1', 'roll-dice');
    expect(rateLimitState.has('sock-1')).toBe(true);

    clearRateLimitState('sock-1');
    expect(rateLimitState.has('sock-1')).toBe(false);
  });

  test('safe to call for unknown socketId', () => {
    expect(() => clearRateLimitState('unknown-sock')).not.toThrow();
  });
});

describe('RATE_LIMITS config', () => {
  test('roll-dice allows 1 call per 3 seconds', () => {
    expect(RATE_LIMITS['roll-dice'].maxCalls).toBe(1);
    expect(RATE_LIMITS['roll-dice'].windowMs).toBe(3000);
  });

  test('all limits have maxCalls and windowMs', () => {
    for (const [, config] of Object.entries(RATE_LIMITS)) {
      expect(typeof config.maxCalls).toBe('number');
      expect(typeof config.windowMs).toBe('number');
    }
  });
});
