import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'

const BAY = { x: 0.5, z0: -1.95, z1: -0.97, y0: 0.42, y1: 1.0 }

function labelTexture(lines: [string, number, string][], w = 1024, h = 256, bg = '#15161a') {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2)
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const [text, y, font] of lines) {
    g.font = font
    g.fillStyle = '#d9dde3'
    g.shadowColor = 'rgba(0,0,0,0.8)'
    g.shadowBlur = 6
    g.fillText(text, w / 2, y)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function carbonTexture() {
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  const cell = 16
  for (let y = 0; y < s; y += cell) {
    for (let x = 0; x < s; x += cell) {
      const odd = ((x + y) / cell) % 2 === 0
      const grd = odd ? g.createLinearGradient(x, y, x + cell, y) : g.createLinearGradient(x, y, x, y + cell)
      grd.addColorStop(0, '#0c0d10')
      grd.addColorStop(0.5, '#2a2d33')
      grd.addColorStop(1, '#0c0d10')
      g.fillStyle = grd
      g.fillRect(x, y, cell, cell)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function foilNormal() {
  const s = 256
  const data = new Uint8Array(s * s * 4)
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4
      const n = Math.sin(x * 0.4 + Math.sin(y * 0.13) * 3) * 0.5 + (Math.random() - 0.5) * 0.4
      data[i] = 128 + n * 60
      data[i + 1] = 128 + Math.cos(y * 0.37 + x * 0.05) * 30
      data[i + 2] = 255
      data[i + 3] = 255
    }
  const t = new THREE.DataTexture(data, s, s)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  t.needsUpdate = true
  return t
}

function Pipe({ points, r, mat }: { points: [number, number, number][]; r: number; mat: THREE.Material }) {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 40, r, 14), [points, r])
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />
}

function Turbo({ position, rotation, mats }: { position: [number, number, number]; rotation: [number, number, number]; mats: Mats }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh material={mats.titanium} castShadow>
        <torusGeometry args={[0.055, 0.035, 18, 36, Math.PI * 1.6]} />
      </mesh>
      <mesh material={mats.alu} rotation-x={Math.PI / 2} position={[0, 0, 0.045]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.07, 32]} />
      </mesh>
      <mesh material={mats.dark} rotation-x={Math.PI / 2} position={[0, 0, 0.085]}>
        <cylinderGeometry args={[0.045, 0.045, 0.012, 24]} />
      </mesh>
    </group>
  )
}

interface Mats {
  alu: THREE.MeshPhysicalMaterial
  titanium: THREE.MeshPhysicalMaterial
  dark: THREE.MeshStandardMaterial
  carbon: THREE.MeshPhysicalMaterial
  foil: THREE.MeshPhysicalMaterial
  cam: THREE.MeshPhysicalMaterial
  red: THREE.MeshPhysicalMaterial
  hose: THREE.MeshStandardMaterial
  plate: THREE.MeshPhysicalMaterial
}

export function Engine({ on }: { on: boolean }) {
  const light = useRef<THREE.PointLight>(null)
  const light2 = useRef<THREE.SpotLight>(null)
  const k = useRef(0)
  const mats = useMemo<Mats>(() => {
    const ctex = carbonTexture()
    ctex.repeat.set(6, 6)
    const plate = labelTexture([
      ['BUGATTI', 92, '700 104px "Times New Roman", serif'],
      ['W16  ·  8.0 L  ·  QUAD TURBO  ·  1500 PS', 190, '600 44px Arial, sans-serif'],
    ], 1024, 256, '#0d0e11')
    return {
      alu: new THREE.MeshPhysicalMaterial({ color: '#a9adb3', metalness: 1, roughness: 0.3, clearcoat: 0.3 }),
      titanium: new THREE.MeshPhysicalMaterial({ color: '#8c7a62', metalness: 1, roughness: 0.3, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 700] }),
      dark: new THREE.MeshStandardMaterial({ color: '#0d0e10', metalness: 0.5, roughness: 0.55 }),
      carbon: new THREE.MeshPhysicalMaterial({ map: ctex, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.02 }),
      foil: new THREE.MeshPhysicalMaterial({ color: '#9c7a36', metalness: 1, roughness: 0.5, normalMap: foilNormal(), normalScale: new THREE.Vector2(0.35, 0.35) }),
      cam: new THREE.MeshPhysicalMaterial({ color: '#1b1d22', metalness: 0.7, roughness: 0.45, clearcoat: 0.6 }),
      red: new THREE.MeshPhysicalMaterial({ color: '#8f0d14', metalness: 0.3, roughness: 0.3, clearcoat: 1 }),
      hose: new THREE.MeshStandardMaterial({ color: '#0a0a0b', roughness: 0.7 }),
      plate: new THREE.MeshPhysicalMaterial({ map: plate, metalness: 0.6, roughness: 0.3, clearcoat: 1 }),
    }
  }, [])

  useFrame((_, dt) => {
    k.current = THREE.MathUtils.damp(k.current, on ? 1 : 0, 3, dt)
    if (light.current) light.current.intensity = k.current * 0.9
    if (light2.current) light2.current.intensity = k.current * 4
  })

  const cx = 0
  const cz = (BAY.z0 + BAY.z1) / 2
  const len = BAY.z1 - BAY.z0 - 0.14
  const top = 0.78
  const banks = [-0.3, -0.11, 0.11, 0.3]
  return (
    <group>
      <group>
        <mesh material={mats.foil} position={[0, (BAY.y0 + BAY.y1) / 2, BAY.z1 + 0.005]} rotation-y={Math.PI} receiveShadow>
          <planeGeometry args={[BAY.x * 2, BAY.y1 - BAY.y0]} />
        </mesh>
        <mesh material={mats.foil} position={[0, (BAY.y0 + BAY.y1) / 2, BAY.z0 - 0.005]} receiveShadow>
          <planeGeometry args={[BAY.x * 2, BAY.y1 - BAY.y0]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={mats.foil} position={[s * (BAY.x + 0.005), (BAY.y0 + BAY.y1) / 2, cz]} rotation-y={-s * Math.PI / 2} receiveShadow>
            <planeGeometry args={[BAY.z1 - BAY.z0, BAY.y1 - BAY.y0]} />
          </mesh>
        ))}
        <mesh material={mats.dark} position={[0, BAY.y0, cz]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[BAY.x * 2, BAY.z1 - BAY.z0]} />
        </mesh>
      </group>

      <group position={[cx, 0, cz]}>
        <mesh material={mats.dark} position={[0, 0.56, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.22, len]} />
        </mesh>
        {banks.map((x, i) => (
          <group key={x} position={[x, top - 0.06 - (Math.abs(x) > 0.2 ? 0.05 : 0), 0]} rotation-z={x > 0 ? -0.22 - (i === 3 ? 0.25 : 0) : 0.22 + (i === 0 ? 0.25 : 0)}>
            <mesh material={mats.cam} castShadow receiveShadow>
              <capsuleGeometry args={[0.045, len - 0.1, 8, 20]} />
            </mesh>
            <mesh material={mats.cam} rotation-x={Math.PI / 2} castShadow>
              <capsuleGeometry args={[0.045, len - 0.12, 8, 20]} />
            </mesh>
            {Array.from({ length: 4 }, (_, c) => (
              <mesh key={c} material={mats.red} position={[0, 0.045, -len / 2 + 0.09 + c * ((len - 0.18) / 3)]}>
                <cylinderGeometry args={[0.014, 0.014, 0.03, 16]} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh material={mats.carbon} position={[0, top + 0.035, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.26, 0.05, len * 0.86]} />
        </mesh>
        <mesh material={mats.plate} position={[0, top + 0.061, 0.02]} rotation={[-Math.PI / 2, 0, Math.PI]}>
          <planeGeometry args={[0.24, 0.06]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh material={mats.alu} position={[s * 0.2, top + 0.03, 0]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.05, 0.05, len * 0.9, 32]} />
            </mesh>
            {Array.from({ length: 8 }, (_, r) => {
              const z = -len / 2 + 0.06 + r * ((len - 0.12) / 7)
              return (
                <Pipe
                  key={r}
                  r={0.012}
                  mat={mats.alu}
                  points={[[s * 0.2, top + 0.03, z], [s * 0.3, top + 0.04, z], [s * 0.4, top - 0.05, z], [s * 0.42, 0.6, z]]}
                />
              )
            })}
            <Turbo position={[s * 0.36, 0.62, -len / 2 + 0.05]} rotation={[0, s * 0.3, 0]} mats={mats} />
            <Turbo position={[s * 0.36, 0.62, -len / 2 + 0.24]} rotation={[0, s * 0.3, 0]} mats={mats} />
            <Pipe r={0.03} mat={mats.titanium} points={[[s * 0.42, 0.58, len / 2 - 0.1], [s * 0.45, 0.52, 0], [s * 0.4, 0.52, -len / 2 + 0.1], [s * 0.2, 0.5, -len / 2 - 0.05]]} />
            <Pipe r={0.022} mat={mats.hose} points={[[s * 0.12, top + 0.02, len / 2 - 0.03], [s * 0.3, 0.72, len / 2 + 0.02], [s * 0.44, 0.7, len / 2 - 0.08]]} />
            <mesh material={mats.alu} position={[s * 0.22, 0.95, 0.15]} castShadow>
              <boxGeometry args={[0.18, 0.02, 0.36]} />
            </mesh>
          </group>
        ))}
        <mesh material={mats.red} position={[0.22, 0.965, 0.15]}>
          <boxGeometry args={[0.02, 0.004, 0.2]} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0.3, 1.3, cz - 0.3]} color="#fff2dc" distance={1.8} decay={2} />
      <spotLight ref={light2} position={[0, 2.4, cz - 0.4]} target-position={[0, 0.6, cz]} angle={0.45} penumbra={0.8} color="#ffffff" distance={4} decay={2} />
    </group>
  )
}
