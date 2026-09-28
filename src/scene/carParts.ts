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

/** Splits an indexed geometry into sub-geometries per triangle classification. */
export function partition(g: THREE.BufferGeometry, classify: Classifier) {
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const idx = g.index!
  const buckets = new Map<PartKey, number[]>()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3()
  for (let i = 0; i < idx.count; i += 3) {
    const i0 = idx.getX(i), i1 = idx.getX(i + 1), i2 = idx.getX(i + 2)
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
    const cen = a.add(b).add(c).multiplyScalar(1 / 3)
    n.fromBufferAttribute(nor, i0)
    const key = classify(cen, n)
    let arr = buckets.get(key)
    if (!arr) buckets.set(key, (arr = []))
    arr.push(i0, i1, i2)
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
