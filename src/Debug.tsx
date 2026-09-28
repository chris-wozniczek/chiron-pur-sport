import { Canvas } from '@react-three/fiber'
import { OrthographicCamera, useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { bakeCar, partition } from './scene/carParts'
import { classifyBody } from './scene/regions'

const params = new URLSearchParams(location.search)
const only = params.get('mat')
const view = params.get('view') ?? 'side'

function DebugCar() {
  const { scene } = useGLTF('/models/car/chiron_pur_sport.glb')
  const bake = useMemo(() => bakeCar(scene), [scene])
  const names = [...bake.byMaterial.keys()]
  console.log('BOX', JSON.stringify(bake.box), names)
  return (
    <group>
      {names.map((name, i) => {
        if (only && !name.includes(only)) return null
        const { geometry } = bake.byMaterial.get(name)!
        const color = new THREE.Color().setHSL(i / names.length, 0.7, 0.5)
        const parts = partition(geometry, classifyBody)
        void color
        return [...parts].map(([k, g]) => (
          <mesh key={name + k} geometry={g}>
            {k === 'body' ? <meshNormalMaterial side={THREE.DoubleSide} /> : <meshBasicMaterial color={k === 'cover' ? 'yellow' : k === 'doorL' ? 'red' : 'orange'} side={THREE.DoubleSide} />}
          </mesh>
        ))
      })}
      <gridHelper args={[10, 20]} rotation={view === 'side' ? [Math.PI / 2, 0, Math.PI / 2] : [0, 0, 0]} position={view === 'side' ? [2.5, 0, 0] : [0, 3, 0]} />
      <axesHelper args={[3]} />
      {void names}
    </group>
  )
}

export default function Debug() {
  const pos: [number, number, number] = view === 'side' ? [10, 0.6, 0] : view === 'top' ? [0, 10, 0] : view === 'back' ? [0, 0.6, -10] : [0, 0.6, 10]
  return (
    <Canvas style={{ width: '100vw', height: '100vh', background: '#222' }}>
      <OrthographicCamera makeDefault position={pos} zoom={170} up={view === 'top' ? [1, 0, 0] : [0, 1, 0]} onUpdate={(c) => c.lookAt(0, 0.6, 0)} />
      <DebugCar />
    </Canvas>
  )
}
