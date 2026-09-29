import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { bakeCar, partition, type PartKey } from './carParts'
import { classifyBody, resolveDoor } from './regions'
import { Engine } from './Engine'

export const CAR_URL = `${import.meta.env.BASE_URL}models/car/chiron_pur_sport.glb`

export interface Paint {
  name: string
  color: string
  flake: number
}

export const PAINTS: Paint[] = [
  { name: 'Bleu Français', color: '#0d2c6b', flake: 0.55 },
  { name: 'Nocturne Black', color: '#07080a', flake: 0.35 },
  { name: 'Argent Silver', color: '#8d9197', flake: 0.8 },
  { name: 'Graphite Grey', color: '#2b2e33', flake: 0.6 },
  { name: 'Rouge Italien', color: '#6e0b10', flake: 0.5 },
  { name: 'Vert Racing', color: '#0e2a1f', flake: 0.45 },
]

function flakeNormal() {
  const s = 512
  const data = new Uint8Array(s * s * 4)
  for (let i = 0; i < s * s; i++) {
    const x = Math.random() * 2 - 1
    const y = Math.random() * 2 - 1
    data[i * 4] = 128 + x * 40
    data[i * 4 + 1] = 128 + y * 40
    data[i * 4 + 2] = 255
    data[i * 4 + 3] = 255
  }
  const t = new THREE.DataTexture(data, s, s)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(90, 90)
  t.needsUpdate = true
  return t
}

interface Built {
  groups: Record<PartKey, THREE.Group>
  paint: THREE.MeshPhysicalMaterial
  headlight: THREE.MeshPhysicalMaterial
  taillight: THREE.MeshPhysicalMaterial
  drl: THREE.MeshStandardMaterial[]
}

const DOOR_HINGE_L = new THREE.Vector3(0.93, 0.62, 0.9)
const COVER_HINGE = new THREE.Vector3(0, 1.08, -0.95)

function upgrade(src: THREE.Material): THREE.MeshPhysicalMaterial {
  const s = src as THREE.MeshStandardMaterial
  const m = new THREE.MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.roughnessMap,
    metalnessMap: s.metalnessMap,
    color: s.color,
    roughness: s.roughness,
    metalness: s.metalness,
    transparent: s.transparent,
    opacity: s.opacity,
    side: THREE.DoubleSide,
    envMapIntensity: 5,
  })
  m.name = s.name
  return m
}

function buildCar(scene: THREE.Object3D): Built {
  const bake = bakeCar(scene)
  const groups = { body: new THREE.Group(), doorL: new THREE.Group(), doorR: new THREE.Group(), cover: new THREE.Group(), headlight: new THREE.Group(), taillight: new THREE.Group() }
  const paint = new THREE.MeshPhysicalMaterial({
    color: PAINTS[0].color,
    metalness: 0.75,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    normalMap: flakeNormal(),
    normalScale: new THREE.Vector2(0.18, 0.18),
    envMapIntensity: 6,
    side: THREE.DoubleSide,
  })
  paint.name = 'paint'
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0b0d10', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.55, envMapIntensity: 8, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })
  const taillight = new THREE.MeshPhysicalMaterial({ color: '#3a0306', emissive: '#ff0a16', emissiveIntensity: 0, roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1, side: THREE.DoubleSide })
  const headlight = new THREE.MeshPhysicalMaterial({ color: '#cfd4da', metalness: 1, roughness: 0.12, emissive: '#e8f1ff', emissiveIntensity: 0 })
  const drl: THREE.MeshStandardMaterial[] = []
  const carbon = new THREE.MeshPhysicalMaterial({ color: '#15171b', metalness: 0.4, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide })

  for (const [name, { material, geometry }] of bake.byMaterial) {
    let mat: THREE.Material
    if (name.includes('Paint')) mat = paint
    else if (name.includes('Window')) mat = glass
    else if (name === 'RED_GLASS') mat = taillight
    else if (name.includes('LightA')) {
      const m = upgrade(material)
      m.emissiveMap = m.map
      m.emissive = new THREE.Color('#ffffff')
      m.emissiveIntensity = 0
      m.metalness = 0.9
      m.roughness = 0.15
      drl.push(m)
      mat = m
    } else if (name.includes('Base_Material')) {
      mat = new THREE.MeshStandardMaterial({ color: '#020202', roughness: 0.9 })
    } else {
      const m = upgrade(material)
      if (name.includes('Textured2A')) {
        m.clearcoat = 1
        m.clearcoatRoughness = 0.05
        m.color.set('#b8bcc4')
      }
      if (name.includes('Wheel')) {
        m.metalness = 0.85
        m.roughness = 0.3
      }
      if (name.includes('Calliper')) {
        m.color.set('#0a0a0a')
        m.clearcoat = 1
      }
      mat = m
    }
    void carbon
    void headlight
    const parts = name.includes('Wheel') || name.includes('Calliper') ? new Map([['body' as PartKey, geometry]]) : partition(geometry, classifyBody, (k, c, isl) => resolveDoor(name, k, c, isl))
    for (const [key, g] of parts) {
      const mesh = new THREE.Mesh(g, mat)
      mesh.castShadow = !(mat as THREE.MeshPhysicalMaterial).transparent
      mesh.receiveShadow = true
      mesh.name = name
      groups[key].add(mesh)
    }
  }
  return { groups, paint, headlight, taillight, drl }
}

export interface CarState {
  doors: boolean
  lights: boolean
  engine: boolean
  paint: Paint
}

export function Car({ state, onEngineClick }: { state: CarState; onEngineClick: () => void }) {
  const { scene } = useGLTF(CAR_URL)
  const built = useMemo(() => buildCar(scene), [scene])
  const doorL = useRef<THREE.Group>(null)
  const doorR = useRef<THREE.Group>(null)
  const cover = useRef<THREE.Group>(null)
  const anim = useRef({ door: 0, cover: 0, light: 0 })
  const shadowTex = useShadowTex()

  useLayoutEffect(() => {
    built.paint.color.set(state.paint.color)
    built.paint.normalScale.setScalar(0.01 + state.paint.flake * 0.04)
  }, [built, state.paint])

  useFrame((_, dt) => {
    const a = anim.current
    a.door = THREE.MathUtils.damp(a.door, state.doors ? 1 : 0, 2.6, dt)
    a.cover = THREE.MathUtils.damp(a.cover, state.engine ? 1 : 0, 2.4, dt)
    a.light = THREE.MathUtils.damp(a.light, state.lights ? 1 : 0, 9, dt)
    const e = a.door * a.door * (3 - 2 * a.door)
    if (doorL.current) doorL.current.rotation.set(0, -e * 1.02, e * 0.07)
    if (doorR.current) doorR.current.rotation.set(0, e * 1.02, -e * 0.07)
    const c = a.cover * a.cover * (3 - 2 * a.cover)
    if (cover.current) cover.current.rotation.set(-c * 0.95, 0, 0)
    built.taillight.emissiveIntensity = 0.25 + a.light * 9
    for (const m of built.drl) m.emissiveIntensity = a.light * 7
  })

  const hingeR = new THREE.Vector3(-DOOR_HINGE_L.x, DOOR_HINGE_L.y, DOOR_HINGE_L.z)
  const rearClick = (e: ThreeEvent<MouseEvent>) => {
    const p = e.object.worldToLocal(e.point.clone())
    if (p.z < -0.9 && p.y > 0.6) {
      e.stopPropagation()
      onEngineClick()
    }
  }

  return (
    <group>
      <primitive object={built.groups.body} onClick={rearClick} />
      <group position={DOOR_HINGE_L}>
        <group ref={doorL}>
          <primitive object={built.groups.doorL} position={DOOR_HINGE_L.clone().negate()} />
        </group>
      </group>
      <group position={hingeR}>
        <group ref={doorR}>
          <primitive object={built.groups.doorR} position={hingeR.clone().negate()} />
        </group>
      </group>
      <group position={COVER_HINGE}>
        <group ref={cover}>
          <primitive object={built.groups.cover} position={COVER_HINGE.clone().negate()} onClick={(e: ThreeEvent<MouseEvent>) => (e.stopPropagation(), onEngineClick())} />
        </group>
      </group>
      <Engine on={state.engine} />
      <CarLights on={state.lights} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -0.1]}>
        <planeGeometry args={[2.6, 5.4]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function useShadowTex() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 256
    const g = c.getContext('2d')!
    g.filter = 'blur(14px)'
    g.fillStyle = 'rgba(0,0,0,0.92)'
    g.beginPath()
    g.roundRect(24, 30, 80, 196, 30)
    g.fill()
    const t = new THREE.CanvasTexture(c)
    return t
  }, [])
}

function CarLights({ on }: { on: boolean }) {
  const refs = useRef<(THREE.SpotLight | null)[]>([])
  const tail = useRef<THREE.PointLight>(null)
  const k = useRef(0)
  const targets = useMemo(() => [-0.7, 0.7].map((x) => {
    const o = new THREE.Object3D()
    o.position.set(x * 1.6, -0.3, 14)
    return o
  }), [])
  useFrame((_, dt) => {
    k.current = THREE.MathUtils.damp(k.current, on ? 1 : 0, 9, dt)
    refs.current.forEach((l) => l && (l.intensity = k.current * 420))
    if (tail.current) tail.current.intensity = k.current * 6
  })
  return (
    <group>
      {[-0.72, 0.72].map((x, i) => (
        <group key={x}>
          <primitive object={targets[i]} />
          <spotLight
            ref={(l) => { refs.current[i] = l }}
            position={[x, 0.68, 2.05]}
            target={targets[i]}
            color="#eaf2ff"
            angle={0.42}
            penumbra={0.55}
            distance={40}
            decay={1.6}
            castShadow={i === 0}
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0005}
          />
        </group>
      ))}
      <pointLight ref={tail} position={[0, 0.8, -2.55]} color="#ff1020" distance={4} decay={2} />
    </group>
  )
}

useGLTF.preload(CAR_URL)
