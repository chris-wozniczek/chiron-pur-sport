import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const KEEP = ['position', 'normal', 'uv']

export function prepGeometry(g: THREE.BufferGeometry, m: THREE.Matrix4) {
  const out = g.clone()
  for (const name of Object.keys(out.attributes)) if (!KEEP.includes(name)) out.deleteAttribute(name)
  const n = out.attributes.position.count
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  if (!out.attributes.normal) out.computeVertexNormals()
  if (!out.index) {
    const idx = new Uint32Array(n)
    for (let i = 0; i < n; i++) idx[i] = i
    out.setIndex(new THREE.BufferAttribute(idx, 1))
  }
  out.morphAttributes = {}
  out.applyMatrix4(m)
  if (m.determinant() < 0) {
    const idx = out.index!
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1)
      idx.setX(i + 1, idx.getX(i + 2))
      idx.setX(i + 2, a)
    }
  }
  return out
}

export interface Placement {
  obj: THREE.Object3D
  matrix: THREE.Matrix4
}

/** Bakes many placed copies of objects into one merged mesh per material. */
export function bakePlacements(items: Placement[]) {
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>()
  for (const { obj, matrix } of items) {
    obj.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert()
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const local = inv.clone().multiply(mesh.matrixWorld)
      const g = prepGeometry(mesh.geometry, matrix.clone().multiply(local))
      const mat = mesh.material as THREE.Material
      const list = groups.get(mat) ?? []
      list.push(g)
      groups.set(mat, list)
    })
  }
  const meshes: THREE.Mesh[] = []
  for (const [mat, list] of groups) {
    const merged = mergeGeometries(list, false)
    if (!merged) continue
    merged.computeBoundingSphere()
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshes.push(mesh)
  }
  return meshes
}

export function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function compose(x: number, y: number, z: number, ry = 0, s = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(s, s, s),
  )
}
