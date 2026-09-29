import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { bakePlacements, compose, mulberry, type Placement } from './bake'

const ENV = `${import.meta.env.BASE_URL}models/env/`

interface Module {
  obj: THREE.Object3D
  width: number
}

/** Extracts wall modules (with their window/door inserts) from a Poly Haven modular kit, re-origined to (0,0,0). */
function extractKit(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true)
  const nodes = scene.children.flatMap((c) => (c.children.length && !(c as THREE.Mesh).isMesh ? c.children : [c]))
  const all = (nodes.length < 10 ? scene.children[0].children : nodes).map((o) => ({ o, box: new THREE.Box3().setFromObject(o) }))
  const kit = new Map<string, Module>()
  for (const { o, box } of all) {
    const name = o.name
    const isWall = name.startsWith('wall_') && !name.startsWith('wall_pier')
    const isTrim = /^(cornice0?1?_standard_standard|crown_standard_standard)/.test(name)
    if (!isWall && !isTrim) continue
    const holder = new THREE.Group()
    const add = (src: THREE.Object3D) => {
      const c = src.clone()
      c.matrix.copy(src.matrixWorld)
      c.matrix.decompose(c.position, c.quaternion, c.scale)
      holder.add(c)
    }
    add(o)
    if (isWall) {
      for (const other of all) {
        if (other.o === o || other.o.name.startsWith('wall_')) continue
        const c = other.box.getCenter(new THREE.Vector3())
        if (c.x > box.min.x && c.x < box.max.x && c.y > box.min.y && c.y < box.max.y && Math.abs(c.z - box.max.z) < 0.6) add(other.o)
      }
    }
    const shift = new THREE.Group()
    holder.position.set(-box.min.x, -box.min.y, -box.max.z)
    shift.add(holder)
    shift.updateMatrixWorld(true)
    kit.set(name, { obj: shift, width: Math.round(box.max.x - box.min.x) })
  }
  return kit
}

interface Style {
  kit: Map<string, Module>
  ground: string[]
  upper: string[]
  cornice: string
  crown: string
}

const FLOOR = 3

export interface WindowLight {
  position: THREE.Vector3
  normal: THREE.Vector3
  color: THREE.Color
}

function buildStreetSide(styles: Style[], side: 1 | -1, z0: number, z1: number, seed: number) {
  const rnd = mulberry(seed)
  const items: Placement[] = []
  const lit: WindowLight[] = []
  const backs: THREE.Matrix4[] = []
  const x = side * 9
  const ry = side === 1 ? -Math.PI / 2 : Math.PI / 2
  let z = z0
  while (z < z1) {
    const style = styles[Math.floor(rnd() * styles.length)]
    const floors = 3 + Math.floor(rnd() * 4)
    const bays = 3 + Math.floor(rnd() * 4)
    const upperPick = style.upper[Math.floor(rnd() * style.upper.length)]
    let width = 0
    const start = z
    for (let b = 0; b < bays; b++) {
      const gName = style.ground[Math.floor(rnd() * style.ground.length)]
      const g = style.kit.get(gName)
      if (!g) continue
      const w = g.width
      const along = (zz: number) => (side === -1 ? zz + w : zz)
      items.push({ obj: g.obj, matrix: compose(x, 0, along(z + width), ry) })
      for (let f = 1; f < floors; f++) {
        const un = rnd() < 0.8 ? upperPick : style.upper[Math.floor(rnd() * style.upper.length)]
        const u = style.kit.get(un)
        for (let k = 0; k < w; k += 3) {
          if (!u) continue
          items.push({ obj: u.obj, matrix: compose(x, f * FLOOR, (side === -1 ? z + width + k + 3 : z + width + k), ry) })
          if (rnd() < 0.3) {
            const warm = rnd()
            lit.push({
              position: new THREE.Vector3(x, f * FLOOR + 1.45, z + width + k + 1.5),
              normal: new THREE.Vector3(-side, 0, 0),
              color: new THREE.Color().setHSL(warm < 0.7 ? 0.08 : warm < 0.9 ? 0.55 : 0.8, warm < 0.7 ? 0.8 : 0.4, 0.55),
            })
          }
        }
      }
      for (let k = 0; k < w; k += 3) {
        const top = floors * FLOOR
        const c = style.kit.get(style.cornice)
        const cr = style.kit.get(style.crown)
        const zz = side === -1 ? z + width + k + 3 : z + width + k
        if (c) items.push({ obj: c.obj, matrix: compose(x, top - 0.05, zz, ry) })
        if (cr) items.push({ obj: cr.obj, matrix: compose(x, top + 0.12, zz, ry) })
      }
      width += w
    }
    const h = floors * FLOOR + 1
    backs.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x + side * 4.3, h / 2, start + width / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(8, h, width),
      ),
    )
    z += width + (rnd() < 0.3 ? 3 : 0)
  }
  return { items, lit, backs }
}

export function useCity() {
  const apt = useGLTF(ENV + 'modular_urban_apartments_facade.glb')
  const fac = useGLTF(ENV + 'modular_factory_facade.glb')
  return useMemo(() => {
    const aptKit = extractKit(apt.scene)
    const facKit = extractKit(fac.scene)
    const styles: Style[] = [
      {
        kit: aptKit,
        ground: ['wall_door_centered_small_01', 'wall_standard_standard_01', 'wall_door_offset_small_01', 'wall_door_centered_large_01', 'wall_standard_standard_01'],
        upper: ['wall_window_centered_small_01', 'wall_window_centered_large_01', 'wall_window_centered_double_01', 'wall_window_offset_small_01', 'wall_door_window_small_01'],
        cornice: 'cornice_standard_standard_01',
        crown: 'crown_standard_standard_01',
      },
      {
        kit: facKit,
        ground: ['wall_door_garage_door_01', 'wall_door_recessed_small_01', 'wall_standard_standard_01', 'wall_door_centered_small_01', 'wall_door_recessed_large_01'],
        upper: ['wall_window_tall_large_01', 'wall_window_tall_small_01', 'wall_window_centered_large_01', 'wall_window_centered_medium_01', 'wall_window_centered_double_01'],
        cornice: 'cornice01_standard_standard_01',
        crown: 'crown_standard_standard_01',
      },
    ]
    const left = buildStreetSide(styles, -1, -48, 48, 7)
    const right = buildStreetSide(styles, 1, -48, 48, 21)
    const meshes = bakePlacements([...left.items, ...right.items])
    for (const m of meshes) {
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat.transparent) {
        mat.roughness = 0.08
        mat.envMapIntensity = 1.5
        m.castShadow = false
      }
    }
    return { meshes, lit: [...left.lit, ...right.lit], backs: [...left.backs, ...right.backs] }
  }, [apt.scene, fac.scene])
}

function WindowGlow({ lit }: { lit: WindowLight[] }) {
  const mesh = useMemo(() => {
    const tex = (() => {
      const c = document.createElement('canvas')
      c.width = 128
      c.height = 128
      const g = c.getContext('2d')!
      const grd = g.createRadialGradient(64, 70, 5, 64, 64, 80)
      grd.addColorStop(0, '#fff')
      grd.addColorStop(0.6, '#aaa')
      grd.addColorStop(1, '#222')
      g.fillStyle = grd
      g.fillRect(0, 0, 128, 128)
      g.fillStyle = 'rgba(0,0,0,0.55)'
      g.fillRect(0, 0, 38, 128)
      g.fillRect(96, 0, 32, 128)
      return new THREE.CanvasTexture(c)
    })()
    tex.colorSpace = THREE.SRGBColorSpace
    const geo = new THREE.PlaneGeometry(1.7, 2.1)
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: true })
    const inst = new THREE.InstancedMesh(geo, mat, lit.length)
    const m = new THREE.Matrix4()
    lit.forEach((l, i) => {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), l.normal)
      m.compose(l.position.clone().addScaledVector(l.normal, -0.24), q, new THREE.Vector3(1, 1, 1))
      inst.setMatrixAt(i, m)
      inst.setColorAt(i, l.color.clone().multiplyScalar(2.2))
    })
    return inst
  }, [lit])
  return <primitive object={mesh} />
}

function Backs({ backs }: { backs: THREE.Matrix4[] }) {
  const mesh = useMemo(() => {
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 1 }), backs.length)
    backs.forEach((m, i) => inst.setMatrixAt(i, m))
    return inst
  }, [backs])
  return <primitive object={mesh} />
}

export function Buildings() {
  const { meshes, lit, backs } = useCity()
  return (
    <group>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
      <WindowGlow lit={lit} />
      <Backs backs={backs} />
    </group>
  )
}

useGLTF.preload(ENV + 'modular_urban_apartments_facade.glb')
useGLTF.preload(ENV + 'modular_factory_facade.glb')
