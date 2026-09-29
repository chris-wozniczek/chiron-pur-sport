import * as THREE from 'three'
import type { Island, PartKey } from './carParts'

type P = [number, number]

/** Door outline in side view (z forward, y up), metres. */
export const DOOR_OUTLINE: P[] = [
  [0.86, 0.84], [0.62, 0.97], [0.37, 1.08], [0.0, 1.1], [-0.36, 1.05], [-0.42, 0.86],
  [-0.62, 0.86], [-0.77, 0.75], [-0.83, 0.57], [-0.77, 0.39], [-0.62, 0.25], [-0.45, 0.19],
  [0.88, 0.2],
]

/** Engine cover outline in top view (x, z). */
export const COVER_OUTLINE: P[] = [
  [-0.5, -0.95], [0.5, -0.95], [0.58, -1.9], [-0.58, -1.9],
]
export const COVER_MIN_Y = 0.85

export function inPoly(x: number, y: number, poly: P[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export const DOOR_MIN_X = 0.55

export function classifyBody(c: THREE.Vector3): PartKey {
  if (Math.abs(c.x) > DOOR_MIN_X && inPoly(c.z, c.y, DOOR_OUTLINE)) return c.x > 0 ? 'doorL' : 'doorR'
  if (c.y > COVER_MIN_Y && inPoly(c.x, c.z, COVER_OUTLINE)) return 'cover'
  return 'body'
}

/** Door trim reaches past DOOR_INNER_X; cabin parts (seats, belts, dash) stay inboard of it. */
export const DOOR_INNER_X = 0.67
const CABIN_X = 0.6
/** Loose strips (intake vanes, shut-line quads) are too small to judge as a whole and stay on the body. */
const MIN_DOOR_ISLAND_TRIS = 8
/** Door outline bounds (x = z, y = y) with a little slack for trim that wraps the shut line. */
const DOOR_BOUNDS = new THREE.Box2().setFromPoints(DOOR_OUTLINE.map(([z, y]) => new THREE.Vector2(z, y))).expandByScalar(0.05)

/**
 * Assign whole connected islands so door trim moves as one piece and cabin parts stay put.
 * Only the painted shell, which is welded across the door gap, is cut per triangle.
 */
export function resolveDoor(material: string, key: PartKey, c: THREE.Vector3, isl: Island): PartKey {
  const { min, max } = isl.box
  const inDoorBounds = DOOR_BOUNDS.containsBox(new THREE.Box2(new THREE.Vector2(min.z, min.y), new THREE.Vector2(max.z, max.y)))
  const side = !inDoorBounds || isl.tris < MIN_DOOR_ISLAND_TRIS ? null : min.x >= CABIN_X && max.x >= DOOR_INNER_X ? 'doorL' : max.x <= -CABIN_X && min.x <= -DOOR_INNER_X ? 'doorR' : null
  if (side) return (isl.counts.get(side) ?? 0) / isl.tris >= 0.9 ? side : key === side ? 'body' : key
  if (key !== 'doorL' && key !== 'doorR') return key
  if (!material.includes('Paint')) return 'body'
  return Math.abs(c.x) < CABIN_X ? 'body' : key
}
