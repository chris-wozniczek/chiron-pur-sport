import * as THREE from 'three'
import { MeshReflectorMaterial, SpotLight, useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { mulberry } from './bake'

const ENV = `${import.meta.env.BASE_URL}models/env/`
const TEX = `${import.meta.env.BASE_URL}textures/`

function usePBR(name: string, rx: number, ry: number) {
  const t = useTexture({ map: `${TEX}${name}/diff.webp`, normalMap: `${TEX}${name}/nor.webp`, roughnessMap: `${TEX}${name}/rough.webp`, aoMap: `${TEX}${name}/arm.webp` })
  useLayoutEffect(() => {
    for (const [k, tex] of Object.entries(t)) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(rx, ry)
      tex.anisotropy = 16
      tex.colorSpace = k === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      tex.needsUpdate = true
    }
  }, [t, rx, ry])
  return t
}

function useModel(name: string) {
  const { scene } = useGLTF(ENV + name + '.glb')
  useLayoutEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial
        m.castShadow = !mat.transparent
        m.receiveShadow = true
      }
    })
  }, [scene])
  return scene
}

function Prop({ name, position, rotation = 0, scale = 1, pick }: { name: string; position: [number, number, number]; rotation?: number; scale?: number; pick?: number }) {
  const scene = useModel(name)
  const obj = useMemo(() => {
    const c = scene.clone(true)
    if (pick !== undefined && c.children.length > 1) c.children.forEach((ch, i) => (ch.visible = i === pick % c.children.length))
    return c
  }, [scene, pick])
  return <primitive object={obj} position={position} rotation={[0, rotation, 0]} scale={scale} />
}

export const ROAD_HALF = 5
export const WALK = 9
const LEN = 110

function Road() {
  const t = usePBR('road_damaged', 3, 33)
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[ROAD_HALF * 2, LEN, 1, 1]} />
      <MeshReflectorMaterial
        map={t.map}
        normalMap={t.normalMap}
        normalScale={new THREE.Vector2(0.6, 0.6)}
        roughnessMap={t.roughnessMap}
        roughness={0.55}
        metalness={0.2}
        color="#6d6a66"
        blur={[400, 120]}
        resolution={1024}
        mixBlur={1.2}
        mixStrength={9}
        mixContrast={1.1}
        depthScale={0.6}
        minDepthThreshold={0.2}
        maxDepthThreshold={1.6}
        mirror={0}
        envMapIntensity={1.5}
      />
    </mesh>
  )
}

function Markings() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 1024
    const g = c.getContext('2d')!
    const r = mulberry(3)
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 64, 1024)
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`
      const s = 2 + r() * 10
      g.fillRect(r() * 64, r() * 1024, s, s * (0.5 + r()))
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 8)
    return t
  }, [])
  const line = (x: number, w: number, color: string, dashed: boolean) => {
    const segs = dashed ? Array.from({ length: 18 }, (_, i) => -LEN / 2 + 3 + i * 6) : [0]
    return segs.map((z) => (
      <mesh key={x + ':' + z} rotation-x={-Math.PI / 2} position={[x, 0.004, dashed ? z : 0]} receiveShadow>
        <planeGeometry args={[w, dashed ? 3 : LEN]} />
        <meshStandardMaterial color={color} alphaMap={tex} transparent opacity={0.75} roughness={0.5} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    ))
  }
  return (
    <group>
      {line(-0.09, 0.1, '#b8912e', false)}
      {line(0.09, 0.1, '#b8912e', false)}
      {line(-4.6, 0.12, '#bdbdb4', false)}
      {line(4.6, 0.12, '#bdbdb4', false)}
    </group>
  )
}

function Sidewalks() {
  const top = usePBR('concrete_pavement', 2, 55)
  const curb = usePBR('concrete_wall_008', 30, 0.2)
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (ROAD_HALF + WALK) / 2, 0.075, 0]} receiveShadow castShadow>
            <boxGeometry args={[WALK - ROAD_HALF, 0.15, LEN]} />
            <meshStandardMaterial attach="material-0" {...curb} />
            <meshStandardMaterial attach="material-1" {...curb} />
            <meshStandardMaterial attach="material-2" {...top} roughness={0.9} envMapIntensity={0.5} />
            <meshStandardMaterial attach="material-3" {...curb} />
            <meshStandardMaterial attach="material-4" {...curb} />
            <meshStandardMaterial attach="material-5" {...curb} />
          </mesh>
          <mesh position={[s * ROAD_HALF, 0.0, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.6, LEN]} />
            <meshStandardMaterial color="#050505" transparent opacity={0.6} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

interface LampDef {
  x: number
  z: number
  color: string
  shadow: boolean
  flicker?: boolean
  intensity: number
}

const LAMPS: LampDef[] = [
  { x: 5.55, z: -4.5, color: '#ffb36b', shadow: true, intensity: 260 },
  { x: -5.55, z: 3.5, color: '#ffc58a', shadow: true, intensity: 230 },
  { x: 5.55, z: 11.5, color: '#ffa555', shadow: true, intensity: 200, flicker: true },
  { x: -5.55, z: -12.5, color: '#ffae62', shadow: false, intensity: 200 },
  { x: 5.55, z: -20.5, color: '#ffb36b', shadow: false, intensity: 200 },
  { x: -5.55, z: 19.5, color: '#ffae62', shadow: false, intensity: 200 },
  { x: -5.55, z: -28.5, color: '#ffae62', shadow: false, intensity: 190 },
  { x: 5.55, z: 27.5, color: '#ffb36b', shadow: false, intensity: 180 },
  { x: 5.55, z: -36.5, color: '#ffb36b', shadow: false, intensity: 180 },
  { x: -5.55, z: 35.5, color: '#ffae62', shadow: false, intensity: 180 },
]
const LAMP_SCALE = 1.45
const LAMP_HEAD = 3.55 * LAMP_SCALE

function Lamp({ def }: { def: LampDef }) {
  const scene = useModel('street_lamp_01')
  const light = useRef<THREE.SpotLight>(null)
  const obj = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat.name.includes('bulb') || mat.name.includes('glass')) {
        const e = mat.clone()
        e.emissive = new THREE.Color(def.color)
        e.emissiveIntensity = mat.name.includes('bulb') ? 40 : 3
        m.material = e
        m.castShadow = false
      }
    })
    return c
  }, [scene, def.color])
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(def.x * 0.55, 0, def.z)
    return o
  }, [def.x, def.z])
  const seed = useMemo(() => Math.random() * 100, [])
  useFrame(({ clock }) => {
    if (!def.flicker || !light.current) return
    const t = clock.elapsedTime + seed
    const on = Math.sin(t * 13) + Math.sin(t * 7.3) + Math.sin(t * 2.1) > -1.2 || Math.floor(t * 3) % 11 !== 0
    const k = on ? 0.9 + 0.1 * Math.sin(t * 90) : 0.05
    light.current.intensity = def.intensity * k
    obj.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && (m.material as THREE.MeshStandardMaterial).emissiveIntensity > 1) (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 40 * k
    })
  })
  return (
    <group>
      <primitive object={obj} position={[def.x, 0.15, def.z]} scale={LAMP_SCALE} rotation={[0, def.x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} />
      <primitive object={target} />
      <SpotLight
        ref={light}
        position={[def.x, LAMP_HEAD, def.z]}
        target={target}
        color={def.color}
        intensity={def.intensity}
        angle={1.05}
        penumbra={0.85}
        distance={24}
        decay={2}
        castShadow={def.shadow}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        volumetric
        attenuation={6}
        anglePower={4}
        opacity={0.22}
        radiusTop={0.12}
        radiusBottom={4.5}
      />
      <pointLight position={[def.x, LAMP_HEAD + 0.1, def.z]} color={def.color} intensity={def.intensity * 0.05} distance={10} decay={2} />
    </group>
  )
}

function neonTexture(text: string, color: string, sub?: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 1024, 256)
  g.font = '700 150px "Brush Script MT", "Segoe Script", cursive'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = color
  for (const [blur, alpha] of [[40, 0.6], [18, 0.9], [4, 1]] as const) {
    g.shadowBlur = blur
    g.globalAlpha = alpha
    g.strokeStyle = color
    g.lineWidth = 10
    g.strokeText(text, 512, sub ? 105 : 128)
  }
  g.shadowBlur = 0
  g.globalAlpha = 1
  g.strokeStyle = '#fff'
  g.lineWidth = 3
  g.strokeText(text, 512, sub ? 105 : 128)
  if (sub) {
    g.font = '700 54px "Arial Black", sans-serif'
    g.shadowColor = color
    g.shadowBlur = 16
    g.fillStyle = color
    g.fillText(sub, 512, 212)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Neon({ text, sub, color, position, side, width = 3.2 }: { text: string; sub?: string; color: string; position: [number, number, number]; side: 1 | -1; width?: number }) {
  const tex = useMemo(() => neonTexture(text, color, sub), [text, color, sub])
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const seed = useMemo(() => Math.random() * 10, [])
  useFrame(({ clock }) => {
    if (!mat.current) return
    const t = clock.elapsedTime + seed
    const glitch = Math.sin(t * 0.7) > 0.97 && Math.sin(t * 40) > 0
    mat.current.color.setScalar(glitch ? 0.4 : 4.5)
  })
  const ry = side === -1 ? Math.PI / 2 : -Math.PI / 2
  return (
    <group position={position} rotation={[0, ry, 0]}>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[width, width / 4]} />
        <meshBasicMaterial ref={mat} map={tex} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[width * 0.92, width / 4.6, 0.04]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
      </mesh>
      <pointLight position={[0, -0.2, 0.9]} color={color} intensity={22} distance={9} decay={2} />
    </group>
  )
}

function Steam({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(255,255,255,0.55)')
    grd.addColorStop(0.5, 'rgba(255,255,255,0.18)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
  const N = 22
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ o: i / N, r: Math.random() })), [])
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.children.forEach((s, i) => {
      const p = (clock.elapsedTime * 0.12 + seeds[i].o) % 1
      s.position.set(Math.sin(p * 6 + seeds[i].r * 6) * 0.3 * p + p * 0.8, p * 4.5, Math.cos(p * 5 + seeds[i].r * 9) * 0.3 * p)
      const sc = 0.6 + p * 3.2
      s.scale.set(sc, sc, sc)
      ;((s as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI) * 0.16
    })
  })
  return (
    <group ref={group} position={position}>
      {seeds.map((_, i) => (
        <sprite key={i}>
          <spriteMaterial map={tex} transparent depthWrite={false} color="#9aa0aa" opacity={0.1} />
        </sprite>
      ))}
    </group>
  )
}

function Wires() {
  const geo = useMemo(() => {
    const r = mulberry(11)
    const tubes: THREE.BufferGeometry[] = []
    for (let i = 0; i < 9; i++) {
      const z0 = -40 + i * 10 + r() * 4
      const z1 = z0 + (r() - 0.5) * 8
      const y0 = 9 + r() * 5
      const y1 = 9 + r() * 5
      const sag = 1 + r() * 1.5
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 24; k++) {
        const t = k / 24
        pts.push(new THREE.Vector3(-8.9 + 17.8 * t, y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t))
      }
      tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.012, 4))
    }
    return tubes
  }, [])
  return (
    <group>
      {geo.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#050505" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Skyline() {
  const mesh = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 512
    const g = c.getContext('2d')!
    g.fillStyle = '#000'
    g.fillRect(0, 0, 256, 512)
    const r = mulberry(5)
    for (let y = 4; y < 512; y += 8) {
      for (let x = 4; x < 256; x += 8) {
        if (r() < 0.22) {
          const w = r()
          g.fillStyle = w < 0.6 ? `rgba(255,${170 + r() * 60},${90 + r() * 60},${0.4 + r() * 0.6})` : `rgba(${150 + r() * 60},${200 + r() * 40},255,${0.3 + r() * 0.6})`
          g.fillRect(x, y, 5, 5)
        }
      }
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    const mat = new THREE.MeshStandardMaterial({ color: '#07080b', roughness: 0.3, metalness: 0.7, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 1.6 })
    mat.onBeforeCompile = () => {}
    const r2 = mulberry(9)
    const boxes: THREE.Matrix4[] = []
    for (let i = 0; i < 70; i++) {
      const side = r2() < 0.5 ? -1 : 1
      const x = side * (26 + r2() * 60)
      const z = -120 + r2() * 240
      const w = 12 + r2() * 20
      const h = 35 + r2() * r2() * 170
      boxes.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, 12 + r2() * 20)))
    }
    for (let i = 0; i < 16; i++) {
      const z = (i % 2 ? 1 : -1) * (70 + r2() * 60)
      const w = 14 + r2() * 20
      const h = 40 + r2() * 160
      boxes.push(new THREE.Matrix4().compose(new THREE.Vector3(-60 + r2() * 120, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w)))
    }
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const inst = new THREE.InstancedMesh(geo, mat, boxes.length)
    boxes.forEach((m, i) => inst.setMatrixAt(i, m))
    geo.attributes.uv.array.forEach(() => {})
    mat.emissiveMap!.repeat.set(2, 6)
    return inst
  }, [])
  return <primitive object={mesh} />
}

function EndBlocks() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 12, s * 62]}>
          <boxGeometry args={[40, 24, 4]} />
          <meshStandardMaterial color="#0a0a0c" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

export function Street() {
  const shutters = useMemo(
    () => [
      { z: -9, side: -1 as const, g: 1 },
      { z: 6, side: 1 as const, g: 1 },
      { z: -15, side: 1 as const, g: 0 },
      { z: 15, side: -1 as const, g: 1 },
      { z: 24, side: 1 as const, g: 1 },
      { z: -27, side: -1 as const, g: 0 },
    ],
    [],
  )
  return (
    <group>
      <Road />
      <Markings />
      <Sidewalks />
      {LAMPS.map((d, i) => (
        <Lamp key={i} def={d} />
      ))}
      {shutters.map((s, i) => (
        <Prop key={i} name="rollershutter_door" position={[s.side * 8.84, 0.15, s.z + (s.side === -1 ? 1.5 : -1.5)]} rotation={s.side === -1 ? Math.PI / 2 : -Math.PI / 2} pick={s.g} />
      ))}
      <Prop name="rollershutter_window_01" position={[8.84, 0.95, -1.5]} rotation={-Math.PI / 2} pick={1} />
      <Prop name="rollershutter_window_01" position={[-8.84, 0.95, -3]} rotation={Math.PI / 2} pick={1} />
      <Neon text="Liquor" sub="BEER • WINE • LOTTO" color="#ff2a3d" position={[8.7, 3.25, 0.5]} side={1} />
      <Neon text="Open 24h" color="#2fd0ff" position={[-8.7, 3.0, -1.0]} side={-1} width={2.6} />
      <Neon text="Pawn" sub="GOLD • CASH • CHECKS" color="#ffcc33" position={[-8.7, 3.25, 13]} side={-1} />
      <Neon text="Motel" sub="VACANCY" color="#ff3fd0" position={[8.7, 3.4, 19]} side={1} width={2.8} />
      <Prop name="metal_trash_can" position={[7.6, 0.15, -7.6]} rotation={-1.4} pick={0} />
      <Prop name="metal_trash_can" position={[-7.9, 0.15, 7.2]} rotation={1.3} pick={0} />
      <Prop name="trashbag" position={[7.0, 0.15, -6.3]} rotation={0.6} />
      <Prop name="trashbag" position={[7.4, 0.15, -5.7]} rotation={2.1} scale={0.9} />
      <Prop name="trashbag" position={[8.1, 0.15, -6.0]} rotation={4} scale={1.1} />
      <Prop name="trashbag" position={[-7.3, 0.15, 8.6]} rotation={1} />
      <Prop name="trashbag" position={[-8.2, 0.15, 5.6]} rotation={3} />
      <Prop name="cardboard_box_01" position={[-6.8, 0.15, 9.3]} rotation={0.4} />
      <Prop name="cardboard_box_01" position={[-6.6, 0.49, 9.25]} rotation={0.9} scale={0.85} />
      <Prop name="plastic_crate_01" position={[8.3, 0.15, 3.4]} rotation={0.2} />
      <Prop name="plastic_crate_01" position={[8.3, 0.41, 3.4]} rotation={0.5} />
      <Prop name="old_tyre" position={[6.6, 0.45, -9.2]} rotation={1.2} />
      <Prop name="old_tyre" position={[-6.3, 0.23, -6.4]} rotation={0} scale={1} />
      <Prop name="fire_hydrant" position={[5.6, 0.15, 2.6]} rotation={-Math.PI / 2} pick={0} />
      <Prop name="fire_hydrant" position={[-5.6, 0.15, -17]} rotation={Math.PI / 2} pick={0} />
      <Prop name="utility_box_01" position={[-8.6, 0.15, 1.0]} rotation={Math.PI / 2} />
      <Prop name="power_box_01" position={[8.92, 1.7, -3.6]} rotation={-Math.PI / 2} pick={0} />
      <Prop name="concrete_road_barrier" position={[-4.3, 0, -19]} rotation={0.2} />
      <Prop name="concrete_road_barrier" position={[3.8, 0, 21]} rotation={-0.3} />
      <Prop name="water_manhole_cover" position={[-1.9, 0.0, -6.5]} pick={0} />
      <Prop name="water_manhole_cover" position={[1.6, 0.0, 14]} pick={0} />
      <Prop name="street_rat" position={[6.4, 0.15, -8.1]} rotation={2.2} scale={1} />
      <Prop name="security_light" position={[-8.85, 3.7, 7]} rotation={Math.PI / 2} pick={0} />
      <Prop name="exterior_aircon_unit" position={[8.8, 5.2, -9]} rotation={-Math.PI / 2} pick={0} />
      <Prop name="exterior_aircon_unit" position={[-8.8, 8.3, 4]} rotation={Math.PI / 2} pick={0} />
      <Prop name="exterior_aircon_unit" position={[8.8, 11.2, 12]} rotation={-Math.PI / 2} pick={0} />
      <Prop name="modular_fire_escape" position={[-8.25, 6.7, -6]} rotation={Math.PI / 2} />
      <Prop name="modular_fire_escape" position={[8.25, 6.7, 9]} rotation={-Math.PI / 2} />
      <Steam position={[-1.9, 0.05, -6.5]} />
      <Wires />
      <Skyline />
      <EndBlocks />
    </group>
  )
}

;['street_lamp_01', 'rollershutter_door', 'rollershutter_window_01', 'metal_trash_can', 'trashbag', 'cardboard_box_01', 'plastic_crate_01', 'old_tyre', 'fire_hydrant', 'utility_box_01', 'power_box_01', 'concrete_road_barrier', 'water_manhole_cover', 'street_rat', 'security_light', 'exterior_aircon_unit', 'modular_fire_escape'].forEach((n) => useGLTF.preload(ENV + n + '.glb'))
