# Bugatti Chiron Pur Sport — Night Showcase

Interactive WebGL showcase of a Bugatti Chiron Pur Sport on a wet city street at night, built with React Three Fiber.

Live: https://chris-wozniczek.github.io/chiron-pur-sport/

## Controls

- Drag to orbit 360°, scroll to zoom, or use the 360° spin button
- Open / close doors, lights on / off, paint selection, camera presets
- Click the rear deck (or "View engine") to raise the engine cover and reveal the W16 bay

## Development

```sh
npm ci
npm run dev    # http://localhost:5173
npm run build
npm run lint
```

Pushes to `main` deploy to GitHub Pages via `.github/workflows/pages.yml`.

## Credits

- Vehicle model: "2021 Bugatti Chiron Pur Sport" by Ddiaz Design (Sketchfab), CC BY-NC-SA 4.0 — modified (materials, door/engine-cover segmentation, procedural engine bay)
- City assets, textures and HDRI: Poly Haven, CC0

Fan-made, non-commercial project. Not affiliated with Bugatti.
