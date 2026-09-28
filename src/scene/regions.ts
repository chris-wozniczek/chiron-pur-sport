import * as THREE from 'three'
import type { PartKey } from './carParts'

type P = [number, number]

/** Door outline in side view (z forward, y up), metres. */
export const DOOR_OUTLINE: P[] = [
  [0.86, 0.84], [0.62, 0.97], [0.37, 1.08], [0.0, 1.1], [-0.36, 1.05],
  [-0.62, 0.89], [-0.77, 0.75], [-0.83, 0.57], [-0.77, 0.39], [-0.62, 0.25], [-0.45, 0.19],
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
