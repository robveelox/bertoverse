export type Tile = { x: number; y: number };
export type Appearance = {
  bodyTone: string;
  hairStyle: string;
  hairColor: string;
  topStyle: string;
  topColor: string;
  bottomStyle: string;
  bottomColor: string;
  shoesStyle: string;
  shoesColor: string;
  accessory: string | null;
};
export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type Player = Tile & {
  id: string;
  name: string;
  motto: string;
  joinedAt: string | null;
  color: string;
  direction: Direction;
  avatarKey: 'avatar-green' | 'avatar-lime';
  appearance: Appearance;
  registered: boolean;
  roomId: string;
};

export const ROOM_WIDTH = 10;
export const ROOM_HEIGHT = 10;
// Empty starter room: furniture placement will populate collision cells in Phase 3.
export const BLOCKED = new Set<string>();

export type PathOptions = {
  width?: number;
  height?: number;
  blocked?: ReadonlySet<string>;
  occupied?: ReadonlySet<string>;
};

export function isWalkable(tile: Tile): boolean;
export function isWalkable(tile: Tile, options: PathOptions): boolean;
export function isWalkable(tile: Tile, options: PathOptions = {}): boolean {
  const width = options.width ?? ROOM_WIDTH;
  const height = options.height ?? ROOM_HEIGHT;
  const blocked = options.blocked ?? BLOCKED;
  const occupied = options.occupied;
  return Number.isInteger(tile.x) && Number.isInteger(tile.y) &&
    tile.x >= 0 && tile.y >= 0 && tile.x < width && tile.y < height &&
    !blocked.has(`${tile.x},${tile.y}`) && !occupied?.has(`${tile.x},${tile.y}`);
}

export function findPath(start: Tile, goal: Tile, options: PathOptions = {}): Tile[] {
  const occupied = new Set(options.occupied ?? []);
  occupied.delete(`${start.x},${start.y}`);
  if (!isWalkable(start, { ...options, occupied }) || !isWalkable(goal, { ...options, occupied })) return [];
  const key = (p: Tile) => `${p.x},${p.y}`;
  const heuristic = (p: Tile) => Math.max(Math.abs(goal.x - p.x), Math.abs(goal.y - p.y));
  const queue: Tile[] = [start];
  const score = new Map<string, number>([[key(start), 0]]);
  const previous = new Map<string, Tile | null>([[key(start), null]]);
  const moves = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ];

  while (queue.length) {
    queue.sort((a, b) => (score.get(key(a)) ?? Infinity) + heuristic(a) - ((score.get(key(b)) ?? Infinity) + heuristic(b)));
    const current = queue.shift()!;
    if (current.x === goal.x && current.y === goal.y) break;
    for (const move of moves) {
      const next = { x: current.x + move.x, y: current.y + move.y };
      const diagonal = move.x !== 0 && move.y !== 0;
      const clearsCorner = !diagonal || (
        isWalkable({ x: current.x + move.x, y: current.y }, { ...options, occupied }) &&
        isWalkable({ x: current.x, y: current.y + move.y }, { ...options, occupied })
      );
      if (clearsCorner && isWalkable(next, { ...options, occupied })) {
        const nextKey = key(next);
        const nextScore = (score.get(key(current)) ?? Infinity) + (diagonal ? 1.4142 : 1);
        if (nextScore >= (score.get(nextKey) ?? Infinity)) continue;
        score.set(nextKey, nextScore);
        previous.set(key(next), current);
        queue.push(next);
      }
    }
  }

  if (!previous.has(key(goal))) return [];
  const path: Tile[] = [];
  let cursor: Tile | null = goal;
  while (cursor && key(cursor) !== key(start)) {
    path.unshift(cursor);
    cursor = previous.get(key(cursor)) ?? null;
  }
  return path;
}

export function cleanName(value: unknown): string {
  const name = String(value ?? '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 16);
  return name.length >= 2 ? name : `Guest${Math.floor(100 + Math.random() * 900)}`;
}

export function cleanMessage(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 160);
}
