import { useState } from 'react'
import { PAINTS, type CarState } from '../scene/Car'

interface Props {
  state: CarState
  setState: (f: (s: CarState) => CarState) => void
  autoRotate: boolean
  setAutoRotate: (v: boolean) => void
  onEngine: () => void
  onView: (v: string) => void
}

export function Hud({ state, setState, autoRotate, setAutoRotate, onEngine, onView }: Props) {
  const [credits, setCredits] = useState(false)
  const toggle = (k: 'doors' | 'lights') => setState((s) => ({ ...s, [k]: !s[k] }))
  return (
    <div className="hud">
      <header className="title">
        <div className="brand">BUGATTI</div>
        <h1>Chiron Pur Sport</h1>
        <div className="specs">
          <span><b>1500</b> PS</span>
          <span><b>1600</b> Nm</span>
          <span><b>8.0 L</b> W16 Quad-Turbo</span>
          <span><b>350</b> km/h</span>
        </div>
      </header>

      <div className="views">
        {['hero', 'side', 'front'].map((v) => (
          <button key={v} onClick={() => onView(v)}>{v === 'hero' ? '3/4' : v}</button>
        ))}
        <button className={autoRotate ? 'on' : ''} onClick={() => setAutoRotate(!autoRotate)}>360° spin</button>
      </div>

      <nav className="controls">
        <button className={state.doors ? 'on' : ''} onClick={() => toggle('doors')}>
          <Icon d="M5 21V4l9-2v19M14 5h5v16M11 12h.01" />
          <span>{state.doors ? 'Close doors' : 'Open doors'}</span>
        </button>
        <button className={state.lights ? 'on' : ''} onClick={() => toggle('lights')}>
          <Icon d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z" />
          <span>{state.lights ? 'Lights off' : 'Lights on'}</span>
        </button>
        <button className={state.engine ? 'on' : ''} onClick={onEngine}>
          <Icon d="M4 10h2V8h4V6h4v2h3l2 3h1v4h-1l-2 3h-3v-2H9v2H6v-3H4z" />
          <span>{state.engine ? 'Exit engine' : 'View engine'}</span>
        </button>
        <div className="sep" />
        <div className="paints">
          {PAINTS.map((p) => (
            <button key={p.name} title={p.name} className={`swatch ${state.paint.name === p.name ? 'on' : ''}`} style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${p.color} 45%, #000 110%)` }} onClick={() => setState((s) => ({ ...s, paint: p }))} />
          ))}
          <div className="paint-name">{state.paint.name}</div>
        </div>
      </nav>

      <div className="hint">Drag to orbit · Scroll to zoom · Click the rear deck to reveal the W16</div>
      <button className="credits-btn" onClick={() => setCredits(true)}>Credits</button>
      {credits && (
        <div className="credits" onClick={() => setCredits(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h2>Credits</h2>
            <p>
              Vehicle model: “2021 Bugatti Chiron Pur Sport” by <a href="https://sketchfab.com/ddiaz-design" target="_blank" rel="noreferrer">Ddiaz Design</a> —{' '}
              <a href="https://sketchfab.com/3d-models/2021-bugatti-chiron-pur-sport-f791c209b88249e9856a552672b64fea" target="_blank" rel="noreferrer">Sketchfab</a>, licensed{' '}
              <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>. Modified: materials, door/engine-cover segmentation, procedural engine bay.
            </p>
            <p>
              City assets, textures and HDRI from <a href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a> (CC0).
            </p>
            <p className="small">Fan-made, non-commercial showcase. Bugatti and Chiron are trademarks of Bugatti Automobiles S.A.S.</p>
            <button onClick={() => setCredits(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
