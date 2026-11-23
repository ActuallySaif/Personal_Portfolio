// Fixes Blender glTF exports before they are optimized for the web. Run via `npm run optimize:model`.
//
// 1. Bump maps: Blender's Bump node exports its greyscale height image as a glTF normal map, which
//    shades flat and wrong. Any greyscale normal map is converted into a real (tangent-space) one.
// 2. Light markers: glTF can't store area lights, and the optimizer drops empty nodes, so the
//    transform of every empty "*Light*" node (e.g. InteriorLight) is saved in the scene extras.
//
// Usage: node scripts/prepare-model.mjs <in.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'

const BUMP_STRENGTH = 3 // higher = deeper looking bumps

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: node scripts/prepare-model.mjs <in.glb> <out.glb>')
  process.exit(1)
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(input)
const root = doc.getRoot()

// 1. Greyscale "normal maps" -> real normal maps (Sobel filter on the height image).
const converted = new Map()
for (const material of root.listMaterials()) {
  const texture = material.getNormalTexture()
  if (!texture) continue
  if (converted.has(texture)) {
    material.setNormalTexture(converted.get(texture))
    continue
  }
  const stats = await sharp(Buffer.from(texture.getImage())).stats()
  const [r, , b] = stats.channels
  if (Math.abs(r.mean - b.mean) >= 20) continue // already a real normal map (bluish)

  const { data, info } = await sharp(Buffer.from(texture.getImage()))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const h = (x, y) => data[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))] / 255
  const out = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - (h(x - 1, y - 1) + 2 * h(x - 1, y) + h(x - 1, y + 1))
      const dy = h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - (h(x - 1, y - 1) + 2 * h(x, y - 1) + h(x + 1, y - 1))
      let nx = -dx * BUMP_STRENGTH
      let ny = dy * BUMP_STRENGTH
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const i = (y * W + x) * 3
      out[i] = (nx * 0.5 + 0.5) * 255
      out[i + 1] = (ny * 0.5 + 0.5) * 255
      out[i + 2] = (nz * 0.5 + 0.5) * 255
    }
  }
  const png = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer()
  const normal = doc
    .createTexture(`${texture.getName()}_Normal`)
    .setImage(new Uint8Array(png))
    .setMimeType('image/png')
  converted.set(texture, normal)
  material.setNormalTexture(normal)
  console.log(`bump -> normal map: ${material.getName()}`)
}

// 2. Keep empty light-marker transforms in the scene extras (read by BlenderScene.jsx).
const markers = {}
for (const node of root.listNodes()) {
  if (/Light/.test(node.getName()) && !node.getMesh() && !node.getCamera()) {
    markers[node.getName()] = {
      translation: node.getWorldTranslation(),
      rotation: node.getWorldRotation(),
      scale: node.getWorldScale(),
    }
  }
}
for (const scene of root.listScenes()) scene.setExtras({ ...scene.getExtras(), markers })
if (Object.keys(markers).length) console.log(`light markers: ${Object.keys(markers).join(', ')}`)

if (!root.listCameras().length) console.warn('WARNING: no camera in the export (Include > Cameras).')
if (!root.listAnimations().length) console.warn('WARNING: no animations in the export (Animation section).')

await io.write(output, doc)
