import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, BufferGeometry, CanvasTexture, EdgesGeometry, Float32BufferAttribute, MathUtils, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import { MODEL_URL } from '../Scene/BlenderScene'

const ORANGE = '#FF7348'
const SAGE = '#ABC9AF'
const SLATE = '#C6C9C0'
const CHARCOAL = '#212121'

// Wireframe: only edges sharper than this many degrees are drawn (lower = denser ribs).
const EDGE_ANGLE = 25
// Cards orbit this many times the container's length out from its centre.
const ORBIT_RADIUS = 0.95
// Seconds for one full orbit. Hovering a card slows the orbit to a stop.
const ORBIT_SECONDS = 60
// Orbit plane tilt (radians) so cards pass in front of and behind the container.
const ORBIT_TILT = 0.18
// Card width relative to the container length; cards are 16:10.
const CARD_SIZE = 0.38
// Camera pulls back out of the container to this distance (in container lengths) when the page opens.
const VIEW_DISTANCE = 2.4
const INTRO_SECONDS = 1.8

const parentQuat = new Quaternion()
// The card text uses the site fonts, which only load once something asks for them.
const fontsReady = () =>
  Promise.all([document.fonts.load('60px Primary'), document.fonts.load('18px Secondary')]).catch(() => {})

/** The category's container from the Blender scene, as an orange edge wireframe. */
function useContainerWireframe(nodeName) {
  const { scene } = useGLTF(MODEL_URL)
  return useMemo(() => {
    const node = scene.getObjectByName(nodeName)
    const mesh = node && (node.isMesh ? node : node.children.find((c) => c.isMesh))
    if (!mesh) return null
    const edges = new EdgesGeometry(mesh.geometry, EDGE_ANGLE)
    // Bake the container's scale (from Blender) into the lines, then centre them on the origin.
    const scale = new Vector3(1, 1, 1).multiply(node.scale).multiply(mesh === node ? new Vector3(1, 1, 1) : mesh.scale)
    edges.scale(scale.x, scale.y, scale.z)
    edges.computeBoundingBox()
    const box = edges.boundingBox
    edges.translate(...box.getCenter(new Vector3()).negate().toArray())
    const size = new Box3().setFromBufferAttribute(edges.attributes.position).getSize(new Vector3())
    return { edges, ribs: corrugation(size), length: Math.max(size.x, size.y, size.z) }
  }, [scene, nodeName])
}

/**
 * The container's corrugated walls are only in its textures, so the real mesh is a plain box.
 * These faint rib lines on the long sides and roof make the wireframe read as a shipping container.
 */
function corrugation(size) {
  const [hx, hy, hz] = [size.x / 2, size.y / 2, size.z / 2]
  const ribs = Math.round(size.z / (size.y * 0.16))
  const points = []
  for (let i = 1; i < ribs; i++) {
    const z = -hz + (i / ribs) * size.z
    points.push(-hx, -hy, z, -hx, hy, z) // left wall
    points.push(hx, -hy, z, hx, hy, z) // right wall
    points.push(-hx, hy, z, hx, hy, z) // roof
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  return geometry
}

/** Draws a project card: thumbnail (or placeholder art), title and category, framed in orange. */
function drawCard(canvas, project, categoryLabel, image) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const pad = 18
  const imgH = h - 140
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = CHARCOAL
  ctx.fillRect(0, 0, w, h)

  if (image) {
    // object-fit: cover
    const s = Math.max((w - pad * 2) / image.width, imgH / image.height)
    const iw = image.width * s
    const ih = image.height * s
    ctx.save()
    ctx.beginPath()
    ctx.rect(pad, pad, w - pad * 2, imgH - pad)
    ctx.clip()
    ctx.drawImage(image, pad + (w - pad * 2 - iw) / 2, pad + (imgH - pad - ih) / 2, iw, ih)
    ctx.restore()
  } else {
    // Placeholder: hazard stripes and a label, until the project has a thumbnail.
    ctx.save()
    ctx.beginPath()
    ctx.rect(pad, pad, w - pad * 2, imgH - pad)
    ctx.clip()
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(171, 201, 175, 0.12)'
    ctx.lineWidth = 14
    for (let x = -h; x < w + h; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, pad)
      ctx.lineTo(x + imgH, imgH)
      ctx.stroke()
    }
    ctx.fillStyle = SAGE
    ctx.font = '500 24px Secondary, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('NO THUMBNAIL YET', w / 2, pad + (imgH - pad) / 2 + 7)
    ctx.restore()
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = SAGE
  ctx.font = '400 22px Secondary, monospace'
  ctx.fillText(categoryLabel.toUpperCase(), pad, imgH + 38)
  ctx.fillStyle = SLATE
  ctx.font = '400 76px Primary, sans-serif'
  let title = project.title
  while (ctx.measureText(title).width > w - pad * 2 && title.length > 4) title = title.slice(0, -2)
  if (title !== project.title) title = title.trimEnd() + '…'
  ctx.fillText(title, pad, imgH + 112)

  ctx.strokeStyle = ORANGE
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, w - 4, h - 4)
}

function ProjectCard({ project, categoryLabel, width, onHover, onOpen }) {
  const [texture, canvas] = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 400
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    return [t, c]
  }, [])
  const mesh = useRef()
  const hover = useRef(0)
  const [isHovered, setHovered] = useState(false)

  useEffect(() => {
    let cancelled = false
    const draw = (image) => {
      if (cancelled) return
      drawCard(canvas, project, categoryLabel, image)
      texture.needsUpdate = true
    }
    // Wait for the site fonts so the card text uses them.
    fontsReady().then(() => draw(null))
    if (project.thumbnail) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => fontsReady().then(() => draw(img))
      img.src = project.thumbnail
    }
    return () => {
      cancelled = true
    }
  }, [project, categoryLabel, canvas, texture])

  useEffect(() => () => texture.dispose(), [texture])

  useFrame(({ camera }, dt) => {
    if (!mesh.current) return
    // Always face the viewer, whatever the orbit's rotation is.
    mesh.current.parent.getWorldQuaternion(parentQuat)
    mesh.current.quaternion.copy(parentQuat.invert().multiply(camera.quaternion))
    hover.current = MathUtils.damp(hover.current, isHovered ? 1 : 0, 12, dt)
    mesh.current.scale.setScalar(1 + hover.current * 0.15)
  })

  return (
    <mesh
      ref={mesh}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover(project)
      }}
      onPointerOut={() => {
        setHovered(false)
        onHover(null)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(project)
      }}
    >
      <planeGeometry args={[width, width / 1.6]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  )
}

function Void({ category, projects, onOpen, onReady, onHover }) {
  const wire = useContainerWireframe(category.node)
  const container = useRef()
  const orbit = useRef()
  const lines = useRef()
  const angle = useRef(0)
  const speed = useRef(1)
  const hovered = useRef(null)
  const intro = useRef(0)
  const camera = useThree((s) => s.camera)
  const controls = useRef()

  const length = wire?.length ?? 6
  const radius = length * ORBIT_RADIUS
  const distance = length * VIEW_DISTANCE

  // Start inside the container (where the homepage camera flight ended), looking at its far end.
  useLayoutEffect(() => {
    camera.position.set(0, length * 0.02, length * 0.2)
    camera.lookAt(0, 0, -length)
  }, [camera, length])

  useEffect(() => {
    if (wire) onReady?.()
  }, [wire, onReady])

  useFrame((_, dt) => {
    // Pull back out of the container into the void, rising slightly to look down on the orbit.
    if (intro.current < 1) {
      intro.current = Math.min(intro.current + dt / INTRO_SECONDS, 1)
      const e = 1 - Math.pow(1 - intro.current, 3)
      camera.position.set(
        MathUtils.lerp(0, distance * 0.35, e),
        MathUtils.lerp(length * 0.02, distance * 0.28, e),
        MathUtils.lerp(length * 0.2, distance * 0.88, e)
      )
      camera.lookAt(0, 0, 0)
      if (lines.current) lines.current.material.opacity = MathUtils.lerp(0.25, 1, e)
      if (controls.current) controls.current.enabled = intro.current === 1
    }

    speed.current = MathUtils.damp(speed.current, hovered.current ? 0 : 1, 4, dt)
    angle.current += (dt / ORBIT_SECONDS) * Math.PI * 2 * speed.current
    if (orbit.current) orbit.current.rotation.y = angle.current
    if (container.current) container.current.rotation.y += dt * 0.05 * speed.current
  })

  const cardWidth = length * CARD_SIZE

  return (
    <>
      <OrbitControls
        ref={controls}
        enabled={false}
        enablePan={false}
        enableZoom={false}
        enableDamping
        rotateSpeed={0.5}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.75}
      />
      {/* Lifted a little so the category title (bottom left) has room under the orbit */}
      <group position-y={length * 0.12}>
      <group ref={container}>
        {wire && (
          <lineSegments ref={lines} geometry={wire.edges}>
            <lineBasicMaterial color={ORANGE} transparent opacity={0.25} toneMapped={false} />
          </lineSegments>
        )}
        {wire && (
          <lineSegments geometry={wire.ribs}>
            <lineBasicMaterial color={ORANGE} transparent opacity={0.16} toneMapped={false} />
          </lineSegments>
        )}
      </group>
      <group rotation-x={ORBIT_TILT}>
        <group ref={orbit}>
          {projects.map((project, i) => {
            const a = (i / projects.length) * Math.PI * 2
            return (
              <group key={project.id} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}>
                <ProjectCard
                  project={project}
                  categoryLabel={category.label}
                  width={cardWidth}
                  onHover={(p) => {
                    hovered.current = p
                    document.body.style.cursor = p ? 'pointer' : ''
                    onHover?.(p)
                  }}
                  onOpen={onOpen}
                />
              </group>
            )
          })}
        </group>
      </group>
      </group>
    </>
  )
}

/** Black void with the category's container as a wireframe and its projects orbiting around it. */
export default function CategoryVoid({ category, projects, onOpen, onReady, onHover }) {
  useEffect(() => () => (document.body.style.cursor = ''), [])
  return (
    <Canvas className="void-canvas" dpr={[1, 2]} camera={{ fov: 45, near: 0.05, far: 500 }}>
      <color attach="background" args={['#000000']} />
      <Suspense fallback={null}>
        <Void category={category} projects={projects} onOpen={onOpen} onReady={onReady} onHover={onHover} />
      </Suspense>
    </Canvas>
  )
}
