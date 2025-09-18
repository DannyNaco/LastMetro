const { nextTimeFromNow } = require('../../src/time');

describe('nextTimeFromNow', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('headway=3 -> +3 min au format "HH:MM"', () => {
    expect(nextTimeFromNow(3)).toBe('12:03');
  });

  test('headway par défaut (non passé) -> même résultat que 3', () => {
    expect(nextTimeFromNow()).toBe('12:03');
  });

  test('headway <= 0 -> throw "invalid headway"', () => {
    expect(() => nextTimeFromNow(0)).toThrow('invalid headway');
    expect(() => nextTimeFromNow(-5)).toThrow('invalid headway');
  });
});
