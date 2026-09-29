import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { CameraControls, Environment, useProgress } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Car, PAINTS, type CarState } from './scene/Car'
import { Buildings } from './scene/City'
import { Street } from './scene/Street'
import { Hud } from './ui/Hud'
import './ui/hud.css'

const CAR_POS: [number, number, number] = [0.9, 0, 0]
const CAR_ROT = 0.22

type View = 'hero' | 'engine' | 'side' | 'front'
const VIEWS: Record<View, [number, number, number, number, number, number]> = {
  hero: [-5.2, 1.25, 5.4, 0, 0.6, 0],
  side: [-7.2, 1.0, 0.2, 0, 0.6, 0],
  front: [1.2, 0.9, 6.8, 0, 0.6, 0.4],
  engine: [0, 2.9, -3.6, 0, 0.65, -1.45],
}

function toWorld(v: [number, number, number]) {
  const p = new THREE.Vector3(...v).applyAxisAngle(new THREE.Vector3(0, 1, 0), CAR_ROT)
  return p.add(new THREE.Vector3(...CAR_POS))
}

function Loader() {
  const { progress, active } = useProgress()
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setHidden(true), 900)
      return () => clearTimeout(t)
    }
  }, [active, progress])
  if (hidden) return null
  return (
    <div className={`loader ${!active && progress >= 100 ? 'done' : ''}`}>
      <div className="loader-brand">BUGATTI</div>
      <div className="loader-model">CHIRON PUR SPORT</div>
      <div className="loader-bar"><span style={{ width: `${progress}%` }} /></div>
      <div className="loader-pct">{Math.round(progress)}%</div>
    </div>
  )
}

const params = new URLSearchParams(location.search)
const initialView = (params.get('view') as View | null) ?? (params.has('engine') ? 'engine' : 'hero')

export default function App() {
  const [state, setState] = useState<CarState>({
    doors: params.has('doors'),
    lights: params.get('lights') !== '0',
    engine: params.has('engine'),
    paint: PAINTS[Number(params.get('paint') ?? 0)] ?? PAINTS[0],
  })
  const [autoRotate, setAutoRotate] = useState(false)
  const controls = useRef<CameraControls>(null)

  const goto = useCallback((v: View, smooth = true) => {
    const [px, py, pz, tx, ty, tz] = VIEWS[v]
    const p = toWorld([px, py, pz])
    const t = toWorld([tx, ty, tz])
    const c = controls.current
    if (!c) return
    c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, smooth)
  }, [])

  const engineOn = state.engine
  const toggleEngine = useCallback(() => {
    goto(engineOn ? 'hero' : 'engine')
    setState((s) => ({ ...s, engine: !engineOn }))
  }, [goto, engineOn])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = (t - last) / 1000
      last = t
      if (autoRotate && controls.current) controls.current.azimuthAngle += dt * 0.18
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [autoRotate])

  return (
    <>
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 32, near: 0.1, far: 400, position: toWorld([VIEWS.hero[0], VIEWS.hero[1], VIEWS.hero[2]]).toArray() }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.NoToneMapping
          scene.fog = new THREE.FogExp2('#06070b', 0.028)
          scene.background = new THREE.Color('#040509')
        }}
      >
        <Suspense fallback={null}>
          <Environment files={`${import.meta.env.BASE_URL}hdri/modern_buildings_night_2k.hdr`} environmentIntensity={0.14} />
          <ambientLight intensity={0.03} color="#8fa3ff" />
          <hemisphereLight args={['#1c2440', '#060504', 0.06]} />
          <Street />
          <Buildings />
          <group position={CAR_POS} rotation-y={CAR_ROT}>
            <Car state={state} onEngineClick={toggleEngine} />
          </group>
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} quality="high" halfRes />
            <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.85} luminanceSmoothing={0.2} radius={0.72} />
            <ToneMapping mode={ToneMappingMode.AGX} />
            <Vignette offset={0.28} darkness={0.72} />
            <Noise opacity={0.045} premultiply />
            <SMAA />
          </EffectComposer>
        </Suspense>
        <CameraControls
          ref={controls}
          makeDefault
          minDistance={2.2}
          maxDistance={16}
          maxPolarAngle={Math.PI / 2 - 0.04}
          smoothTime={0.6}
          onStart={() => setAutoRotate(false)}
        />
        <InitialTarget onReady={() => goto(initialView in VIEWS ? initialView : 'hero', false)} />
      </Canvas>
      <Hud
        state={state}
        setState={setState}
        autoRotate={autoRotate}
        setAutoRotate={setAutoRotate}
        onEngine={toggleEngine}
        onView={(v) => goto(v as View)}
      />
      <Loader />
    </>
  )
}

function InitialTarget({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const t = setTimeout(onReady, 0)
    return () => clearTimeout(t)
  }, [onReady])
  return null
}
