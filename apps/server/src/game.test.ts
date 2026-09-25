import { describe, expect, it } from 'vitest';
import { BLOCKED, cleanMessage, cleanName, findPath, isWalkable } from './game.js';

describe('authoritative game rules', () => {
  it('accepts empty-room tiles and rejects out-of-bounds tiles', () => {
    expect(isWalkable({ x: 4, y: 4 })).toBe(true);
    expect(isWalkable({ x: -1, y: 0 })).toBe(false);
  });
  it('uses diagonal steps when they shorten a route', () => {
    const path = findPath({ x: 3, y: 4 }, { x: 5, y: 5 });
    expect(path).toHaveLength(2);
    expect(path.every(tile => isWalkable(tile))).toBe(true);
  });
  it('does not cut diagonally through a blocked corner', () => {
    BLOCKED.add('4,3');
    BLOCKED.add('3,4');
    const path = findPath({ x: 3, y: 3 }, { x: 4, y: 4 });
    expect(path[0]).not.toEqual({ x: 4, y: 4 });
    expect(path.length).toBeGreaterThan(1);
    BLOCKED.clear();
  });
  it('respects custom room bounds and blocked corner tiles', () => {
    const blocked = new Set(['1,0']);
    expect(isWalkable({ x: 3, y: 1 }, { width: 3, height: 3, blocked })).toBe(false);
    const path = findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, { width: 3, height: 3, blocked });
    expect(path[0]).toEqual({ x: 0, y: 1 });
    expect(path.at(-1)).toEqual({ x: 1, y: 1 });
  });
  it('routes around an occupied tile instead of walking through another player', () => {
    const occupied = new Set(['4,4']);
    const path = findPath({ x: 3, y: 4 }, { x: 5, y: 4 }, { occupied });
    expect(path).not.toContainEqual({ x: 4, y: 4 });
    expect(path.at(-1)).toEqual({ x: 5, y: 4 });
  });
  it('sanitises user-authored fields', () => {
    expect(cleanName('<b>Rob</b>')).toBe('bRobb');
    expect(cleanMessage('hello\u0000 world')).toBe('hello world');
  });

  it('rejects non-integer and oversized movement coordinates', () => {
    expect(isWalkable({ x: 1.5, y: 2 })).toBe(false);
    expect(isWalkable({ x: 999, y: 999 })).toBe(false);
    expect(findPath({ x: 0, y: 0 }, { x: Number.NaN, y: 2 })).toEqual([]);
  });
});
