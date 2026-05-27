# Collision detection guide

zx-kit provides three tiers of collision detection. This guide explains when to reach for each one and how to wire it into a game's update loop.

---

## The three tiers

| Tier | Functions | Cost | Use when |
|------|-----------|------|----------|
| **AABB** | `rectsOverlap`, `spritesOverlap`, `bitmapRect` | O(1) | Hit tests for square/rectangular sprites |
| **Rect-vs-tile** | `resolveRectX`, `resolveRectY`, `isSolidAt` | O(rows/cols spanned) | Moving a sprite through a tile map |
| **Pixel-precise** | `bitmapPixelMask`, `masksOverlap`, `pixelSolidCount` | O(opaque pixels) | Non-rectangular sprites, severity counts, visual accuracy |

Start with AABB. Upgrade to pixel-precise only where it matters. Both can coexist in the same game loop — AABB as the fast broad-phase gate, pixel-precise for the cases that need it.

---

## Tier 1 — AABB (axis-aligned bounding box)

### How it works

Every sprite occupies a rectangle. Two sprites collide when their rectangles overlap by at least one pixel. Touching edges (zero-area overlap) do not count as a collision.

AABB is exact for sprites that fill their bounding box — `CELL × CELL` (8×8) solid blocks, score items, full-rectangle platforms. It overshoots for sprites with transparent corners.

### Setup

No pre-computation. Call the functions directly in your update loop.

```ts
import { spritesOverlap, rectsOverlap, bitmapRect } from 'zx-kit'

// Two 8×8 sprites — AABB is exact, no pixel waste
if (spritesOverlap(player, coin)) {
  collectCoin(coin)
}

// Sprites of different sizes — bitmapRect gives the right box
const heroBox   = bitmapRect(HERO_BMP, hero.x, hero.y)
const enemyBox  = bitmapRect(ENEMY_BMP, enemy.x, enemy.y)
if (rectsOverlap(heroBox, enemyBox)) {
  triggerCombat()
}
```

### Full example — bullet vs. enemy list

```ts
import { Sprite, spriteRect, rectsOverlap } from 'zx-kit'

function updateBullets(bullets: Sprite[], enemies: Sprite[]) {
  for (const b of bullets) {
    const br = spriteRect(b)
    for (const e of enemies) {
      if (rectsOverlap(br, spriteRect(e))) {
        destroyBullet(b)
        hitEnemy(e)
      }
    }
  }
}
```

---

## Tier 2 — Rect-vs-tile (wall resolution)

### How it works

`resolveRectX` and `resolveRectY` move a rectangle through a tile map and stop it flush against the first solid tile it hits. They check the full span of rows (or columns) that the rectangle covers — so a 16×24 hero walking into a wall is checked against every tile row from head to feet, not just the four corners.

### Setup

```ts
import { bitmapRect, resolveRectX, resolveRectY } from 'zx-kit'

function moveHero(hero: Hero, map: TileMap, dx: number, dy: number) {
  const rect = bitmapRect(HERO_BMP, hero.x, hero.y)

  const rx = resolveRectX(rect, map, hero.x + dx)
  hero.x = rx.x
  if (rx.hitLeft || rx.hitRight) hero.vx = 0

  const ry = resolveRectY(rect, map, hero.y + dy)
  hero.y = ry.y
  if (ry.hitBottom) { hero.vy = 0; hero.onGround = true }
  if (ry.hitTop)    { hero.vy = 0 }
}
```

Resolve X and Y separately, in that order, so diagonal motion doesn't tunnel through a corner.

### 8×8 shorthand

For the common `CELL × CELL` sprite, `resolveX` / `resolveY` are wrappers that skip the `bitmapRect` call:

```ts
import { resolveX, resolveY } from 'zx-kit'

const { x, hitLeft, hitRight } = resolveX(player, map, player.x + dx)
player.x = x
```

---

## Tier 3 — Pixel-precise collision

### Why AABB isn't always enough

Consider a round hero sprite in an 8×8 bounding box. The four corners of the box are transparent. If AABB reports a collision when the box overlaps a platform's edge, the hero appears to float or stick to air that its pixels never actually touch.

```
Sprite (circular):        AABB:
      ░░░░                ████████
    ░░████░░              ████████
   ░████████░             ████████
   ░████████░             ████████
    ░░████░░              ████████
      ░░░░                ████████
```

The round sprite has nothing in its corners. AABB fires when the corner passes over a tile; the sprite visually never reached it.

Pixel-precise collision solves this by only counting pixels that are actually opaque in the bitmap data.

### Visual gap with a real number

For a 2×2 lit region inside an 8×8 bounding box, AABB fires **6 pixels before** the sprites visually meet — that 6-pixel gap is a false positive the player sees as "I didn't even touch it." This is what the visual ground truth test in `src/__tests__/collision.test.ts` proves directly.

### Setup — pre-compute masks once

```ts
import { bitmapPixelMask, type PixelMask } from 'zx-kit'

// Module level — build once, reuse every frame
const HERO_MASK:   PixelMask = bitmapPixelMask(HERO_BMP)
const ENEMY_MASK:  PixelMask = bitmapPixelMask(ENEMY_BMP)
const BULLET_MASK: PixelMask = bitmapPixelMask(BULLET_BMP)
```

`PixelMask` stores, per row, the sorted column indices of opaque pixels. It derives from immutable `Bitmap` data, so it never needs rebuilding.

### Hit test — `masksOverlap`

```ts
import { masksOverlap } from 'zx-kit'

// Returns 0 → no collision; > 0 → collision (value = overlapping pixel count)
if (masksOverlap(BULLET_MASK, bullet.x, bullet.y, ENEMY_MASK, enemy.x, enemy.y) > 0) {
  destroyEnemy(enemy)
}
```

The return value is the number of pixels that actually overlap. Use it for:

- **Simple hit test** — `> 0` is enough.
- **Damage scaling** — more overlap = more damage. `Math.round(overlap / ENEMY_MASK.totalPixels * maxDamage)`.
- **Ignore grazes** — require `>= 3` to suppress single-pixel corner touches.

### Ground and wall checks — `pixelSolidCount`

```ts
import { pixelSolidCount } from 'zx-kit'

// Standing: test 1 px below the sprite's current bottom edge
const onGround = pixelSolidCount(HERO_MASK, hero.x, hero.y + 1, map) > 0

// Right wall: test 1 px past the right edge
const wallRight = pixelSolidCount(HERO_MASK, hero.x + 1, hero.y, map) > 0

// Ground contact fraction — how many foot pixels land on solid?
const contact = pixelSolidCount(HERO_MASK, hero.x, hero.y + 1, map)
const gripFraction = contact / HERO_MASK.totalPixels
```

A circular sprite hanging over a platform edge has zero contact pixels — `pixelSolidCount` returns 0, and the hero correctly doesn't stick to air.

---

## Combining both tiers in one game loop

AABB as a cheap first gate, pixel-precise only when the boxes actually overlap:

```ts
function checkEnemyHit(
  heroMask: PixelMask, hx: number, hy: number,
  enemyMask: PixelMask, ex: number, ey: number,
): number {
  // Broad-phase: reject when boxes don't overlap (O(1))
  const hBox = { x: hx, y: hy, w: heroMask.width,  h: heroMask.height  }
  const eBox = { x: ex, y: ey, w: enemyMask.width, h: enemyMask.height }
  if (!rectsOverlap(hBox, eBox)) return 0

  // Narrow-phase: pixel-precise only when boxes overlap
  return masksOverlap(heroMask, hx, hy, enemyMask, ex, ey)
}
```

The AABB gate costs nothing when sprites are far apart. When it passes, `masksOverlap` only iterates the overlap window, so cost stays proportional to how close the sprites actually are.

---

## Non-rectangular collision without a tile map

For collision against an arbitrary screen boundary (road edge, play-field wall, custom shape) instead of a tile map, walk the mask rows manually:

```ts
function isInsideBoundary(mask: PixelMask, mx: number, my: number): boolean {
  for (let row = 0; row < mask.height; row++) {
    for (const col of mask.rows[row]!) {
      const px = mx + col
      const py = my + row
      if (!boundary.contains(px, py)) return false
    }
  }
  return true
}
```

This is how Ice Haul's off-road detection works: each opaque truck pixel is tested against the computed road edge coordinates for that screen row. Only pixels that cross the road boundary trigger the off-road warning — a truck that is visually fully on the asphalt produces zero off-road pixels regardless of its bounding box.

---

## Quick-reference checklist

| Task | Use |
|------|-----|
| Coin pickup, simple hit | `spritesOverlap` |
| Different-size sprite hit | `rectsOverlap(bitmapRect(...), bitmapRect(...))` |
| Hero walks into a wall | `resolveRectX` + `resolveRectY` |
| Round/non-rectangular sprite on floor | `pixelSolidCount(..., map) > 0` |
| Bullet vs. irregular boss | `masksOverlap > 0` |
| Overlap severity / damage scaling | `masksOverlap / totalPixels` |
| Custom boundary (road, arena) | Manual mask row loop |
| Fast loop with many enemies | AABB gate first, `masksOverlap` second |
