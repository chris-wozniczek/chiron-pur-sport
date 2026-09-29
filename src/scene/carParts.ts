import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { prepGeometry } from './bake'

export const CAR_LENGTH = 4.544

export type PartKey = 'body' | 'doorL' | 'doorR' | 'cover' | 'headlight' | 'taillight'

export interface CarBake {
  byMaterial: Map<string, { material: THREE.Material; geometry: THREE.BufferGeometry }>
  box: THREE.Box3
}

/** Flattens the glTF hierarchy into one geometry per material, in car space (metres, +Z forward, ground at y=0). */
export function bakeCar(root: THREE.Object3D): CarBake {
  root.updateMatrixWorld(true)
  const raw = new THREE.Box3().setFromObject(root)
  const size = raw.getSize(new THREE.Vector3())
  const s = CAR_LENGTH / size.z
  const center = raw.getCenter(new THREE.Vector3())
  const norm = new THREE.Matrix4()
    .makeScale(s, s, s)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -raw.min.y, -center.z))

  const groups = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[] }>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as THREE.Material
    const m = norm.clone().multiply(mesh.matrixWorld)
    const g = prepGeometry(mesh.geometry, m)
    const e = groups.get(mat.name) ?? { material: mat, parts: [] }
    e.parts.push(g)
    groups.set(mat.name, e)
  })

  const byMaterial = new Map<string, { material: THREE.Material; geometry: THREE.BufferGeometry }>()
  const box = new THREE.Box3()
  for (const [name, { material, parts }] of groups) {
    const geometry = mergeGeometries(parts, false)!
    geometry.computeBoundingBox()
    box.union(geometry.boundingBox!)
    byMaterial.set(name, { material, geometry })
  }
  return { byMaterial, box }
}

export type Classifier = (c: THREE.Vector3, n: THREE.Vector3) => PartKey

export interface Island {
  box: THREE.Box3
  tris: number
  counts: Map<PartKey, number>
}

export type Resolver = (key: PartKey, c: THREE.Vector3, island: Island) => PartKey

/** Groups triangles into connected islands (shared indices or coincident positions). */
function islands(g: THREE.BufferGeometry) {
  const pos = g.attributes.position
  const idx = g.index!
  const n = pos.count
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (x: number) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]]
    return x
  }
  const union = (a: number, b: number) => {
    a = find(a)
    b = find(b)
    if (a !== b) parent[a] = b
  }
  for (let i = 0; i < idx.count; i += 3) {
    union(idx.getX(i), idx.getX(i + 1))
    union(idx.getX(i), idx.getX(i + 2))
  }
  const seen = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`
    const o = seen.get(k)
    if (o === undefined) seen.set(k, i)
    else union(i, o)
  }
  return find
}

/** Splits an indexed geometry into sub-geometries per triangle classification, refined per connected island. */
export function partition(g: THREE.BufferGeometry, classify: Classifier, resolve?: Resolver) {
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const idx = g.index!
  const find = islands(g)
  const triCount = idx.count / 3
  const keys: PartKey[] = new Array(triCount)
  const cens = new Float32Array(triCount * 3)
  const root = new Int32Array(triCount)
  const info = new Map<number, Island>()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3()
  for (let t = 0; t < triCount; t++) {
    const i0 = idx.getX(t * 3), i1 = idx.getX(t * 3 + 1), i2 = idx.getX(t * 3 + 2)
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
    const r = find(i0)
    let isl = info.get(r)
    if (!isl) info.set(r, (isl = { box: new THREE.Box3(), tris: 0, counts: new Map() }))
    isl.box.expandByPoint(a).expandByPoint(b).expandByPoint(c)
    const cen = a.add(b).add(c).multiplyScalar(1 / 3)
    n.fromBufferAttribute(nor, i0)
    const key = classify(cen, n)
    keys[t] = key
    root[t] = r
    cen.toArray(cens, t * 3)
    isl.tris++
    isl.counts.set(key, (isl.counts.get(key) ?? 0) + 1)
  }
  const buckets = new Map<PartKey, number[]>()
  for (let t = 0; t < triCount; t++) {
    const key = resolve ? resolve(keys[t], c.fromArray(cens, t * 3), info.get(root[t])!) : keys[t]
    let arr = buckets.get(key)
    if (!arr) buckets.set(key, (arr = []))
    arr.push(idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2))
  }
  const out = new Map<PartKey, THREE.BufferGeometry>()
  for (const [key, list] of buckets) {
    const sub = new THREE.BufferGeometry()
    for (const name of Object.keys(g.attributes)) sub.setAttribute(name, g.attributes[name])
    sub.setIndex(list)
    sub.computeBoundingBox()
    sub.computeBoundingSphere()
    out.set(key, sub)
  }
  return out
}
