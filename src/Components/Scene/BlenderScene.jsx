import { Component, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bounds, Environment, Lightformer, OrbitControls, useAnimations, useGLTF } from '@react-three/drei'
import { AgXToneMapping, LoopOnce, MathUtils, Quaternion, Vector3 } from 'three'
import './BlenderScene.css'
import { usePageHold } from '../Layout/PageLoader'

// Exported from Blender (File > Export > glTF 2.0, .glb). See models/README.md.
export const MODEL_URL = '/models/scene/scene.gltf'
// Blender world HDRI (.hdr or .exr). Set to null to fall back to the built-in studio light.
export const HDRI_URL = '/hdri/sky.exr'

// Stand-in for Blender's Sky Texture sun (Nishita). Values copied from the Blender world settings.
const SUN_ELEVATION = 49.7 // degrees
const SUN_ROTATION = -106.3 // degrees
const SUN = { position: sunPosition(SUN_ELEVATION, SUN_ROTATION, 60), intensity: 4.5, color: '#FFF4E5' }
// How much the HDRI lights the scene. Lower = darker shadows (the sun does the rest).
const HDRI_LIGHT = 0.35

/** Blender sky sun angles -> three.js position (Blender Z-up becomes three.js Y-up). */
function sunPosition(elevationDeg, rotationDeg, distance) {
  const e = MathUtils.degToRad(elevationDeg)
  const r = MathUtils.degToRad(rotationDeg)
  // Blender: (cos e * sin r, cos e * cos r, sin e)  ->  three.js: (x, z, -y)
  const bx = Math.cos(e) * Math.sin(r)
  const by = Math.cos(e) * Math.cos(r)
  const bz = Math.sin(e)
  return [bx * distance, bz * distance, -by * distance]
}

// Blender timeline frame rate (Output Properties > Frame Rate).
const FPS = 24

// Which Blender frame the scene shows when each page section reaches the top of the screen.
// Between two sections the frame moves linearly; past the last one it holds.
//   0-48    camera tilts down from the sky to the building  (Start -> About)
//   48-72   hold: About text sits on the closed door        (About)
//   72-93   door opens, 108-144 containers slide out        (Categories -> Projects)
const SCROLL_KEYFRAMES = [
  { section: 'level-00', frame: 0 },
  { section: 'level-01', frame: 48 },
  { section: 'level-02', frame: 72 },
  { section: 'level-03', frame: 144 },
]

// Inside the loading bay, sky light (the HDRI) is cut down so the interior reads dark, like
// Cycles' bounce/occlusion. Box in world units (three.js Y-up); fade softens the door opening.
const INTERIOR = {
  min: [-9, -1, -30],
  max: [9, 9.5, -4.3],
  fade: 2.5, // metres of ramp from the door opening inward
  skyLight: 0.2, // fraction of HDRI light left deep inside (0 = black, 1 = no change)
}

// Blender's area light "InteriorLight". glTF can't carry area lights, so only its position,
// rotation and scale export; colour and strength are set here.
const INTERIOR_LIGHT = { color: '#FF6A3D', intensity: 250 }

/** Patches a glTF material so ambient/sky light fades out inside the INTERIOR box. */
function darkenInterior(material) {
  if (material.userData.interiorPatched) return
  material.userData.interiorPatched = true
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uInteriorMin = { value: new Vector3(...INTERIOR.min) }
    shader.uniforms.uInteriorMax = { value: new Vector3(...INTERIOR.max) }
    shader.uniforms.uInteriorFade = { value: INTERIOR.fade }
    shader.uniforms.uInteriorSky = { value: INTERIOR.skyLight }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInteriorPos;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvInteriorPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vInteriorPos;
uniform vec3 uInteriorMin;
uniform vec3 uInteriorMax;
uniform float uInteriorFade;
uniform float uInteriorSky;`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
{
  vec3 d = min(vInteriorPos - uInteriorMin, uInteriorMax - vInteriorPos);
  float inside = smoothstep(0.0, 0.3, min(d.x, d.y)) * smoothstep(0.0, uInteriorFade, d.z);
  float sky = mix(1.0, uInteriorSky, inside);
  reflectedLight.indirectDiffuse *= sky;
  reflectedLight.indirectSpecular *= sky;
}`
      )
  }
  material.customProgramCacheKey = () => 'interior-darkened'
  material.needsUpdate = true
}

/**
 * Stands in for Blender's "InteriorLight" area light. A shadow-casting spotlight is used instead of
 * a RectAreaLight because area lights can't cast shadows in three.js and would leak through the
 * walls onto the facade. The optimizer drops empty nodes, so the light's transform is stored in
 * the scene extras (scene.userData.markers).
 */
function InteriorLight({ scene }) {
  const marker = scene.userData.markers?.InteriorLight
  const light = useRef()

  useLayoutEffect(() => {
    if (!marker || !light.current) return
    const pos = new Vector3(...marker.translation)
    const quat = new Quaternion(...marker.rotation)
    // Blender lights shine down their local -Z; the exporter keeps that axis for light nodes.
    const dir = new Vector3(0, 0, -1).applyQuaternion(quat)
    light.current.position.copy(pos)
    light.current.target.position.copy(pos.clone().addScaledVector(dir, 10))
    light.current.target.updateMatrixWorld()
  }, [marker])

  if (!marker) return null
  return (
    <spotLight
      ref={light}
      color={INTERIOR_LIGHT.color}
      intensity={INTERIOR_LIGHT.intensity}
      angle={Math.PI / 2.6}
      penumbra={1}
      decay={2}
      distance={40}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0005}
      shadow-normalBias={0.03}
    />
  )
}

/** Maps the current scroll position onto the Blender timeline, in frames. */
function readScrollFrame() {
  const y = window.scrollY
  const stops = SCROLL_KEYFRAMES.map(({ section, frame }) => {
    const el = document.getElementById(section)
    return { y: el ? el.getBoundingClientRect().top + y : 0, frame }
  })
  if (y <= stops[0].y) return stops[0].frame
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]
    const b = stops[i]
    if (y <= b.y) return MathUtils.mapLinear(y, a.y, b.y, a.frame, b.frame)
  }
  return stops[stops.length - 1].frame
}

/** Makes the camera exported from Blender the one the canvas renders through. */
function useBlenderCamera(cameras) {
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const defaultCamera = useThree((s) => s.camera)
  const camera = cameras[0]

  useLayoutEffect(() => {
    if (!camera) {
      console.warn('[BlenderScene] No camera in the .glb. Turn on Include > Cameras when exporting.')
      return
    }
    const previous = defaultCamera
    set({ camera })
    return () => set({ camera: previous })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, set])

  // R3F only resizes the camera it created, so keep the Blender one in sync with the canvas.
  useLayoutEffect(() => {
    if (!camera?.isPerspectiveCamera) return
    camera.aspect = size.width / size.height
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
}

function Scene() {
  const { scene, animations, cameras } = useGLTF(MODEL_URL)
  const { actions, mixer } = useAnimations(animations, scene)
  useBlenderCamera(cameras)

  // Every clip shares one timeline (absolute Blender frames), so camera, door and containers stay in sync.
  const frame = useRef(readScrollFrame())

  const gl = useThree((s) => s.gl)

  // Blender's shadow settings don't export, so turn shadows on for every mesh here.
  // Max anisotropic filtering keeps ground and wall textures sharp at grazing angles.
  useEffect(() => {
    const anisotropy = gl.capabilities.getMaxAnisotropy()
    scene.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      const materials = Array.isArray(o.material) ? o.material : [o.material]
      materials.forEach((m) => {
        darkenInterior(m)
        Object.values(m).forEach((v) => {
          if (v?.isTexture && v.anisotropy !== anisotropy) {
            v.anisotropy = anisotropy
            v.needsUpdate = true
          }
        })
      })
    })
  }, [scene, gl])

  useEffect(() => {
    Object.values(actions).forEach((action) => {
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      action.paused = true // time is set from scroll, never advanced by the clock
    })
    return () => mixer.stopAllAction()
  }, [actions, mixer])

  useFrame((_, dt) => {
    // Ease toward the scroll position so wheel steps don't make the camera jump.
    frame.current = MathUtils.damp(frame.current, readScrollFrame(), 6, dt)
    const t = frame.current / FPS
    Object.values(actions).forEach((action) => {
      // Stop just short of the end so a LoopOnce clip never reports itself finished.
      action.time = Math.min(t, action.getClip().duration - 1e-4)
    })
    mixer.update(0)
  })

  // No camera in the export yet: frame the whole scene and allow orbiting so it can still be inspected.
  if (!cameras[0]) {
    return (
      <>
        <Bounds fit clip margin={0.9}>
          <primitive object={scene} />
        </Bounds>
        <OrbitControls makeDefault />
      </>
    )
  }

  return (
    <>
      <primitive object={scene} />
      <InteriorLight scene={scene} />
    </>
  )
}

/** Lets the preloader go once the scene has drawn a couple of frames (shaders compiled, no first-frame hitch). */
function SceneReady({ onReady }) {
  const frames = useRef(0)
  useFrame(() => {
    frames.current += 1
    if (frames.current === 3) onReady()
  })
  return null
}

/** Shows a hint instead of a blank page when the .glb is missing or fails to load. */
class SceneErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch() {
    this.props.onError?.() // don't leave the preloader up forever
  }
  render() {
    if (this.state.error) {
      return (
        <div className="scene-error">
          Couldn't load <code>{MODEL_URL}</code>. Export your Blender scene there as a .glb.
        </div>
      )
    }
    return this.props.children
  }
}

export default function BlenderScene() {
  // Keep the page preloader up until the model, textures and HDRI are loaded and drawn.
  const loaded = usePageHold()
  return (
    <div className="scene-canvas" aria-hidden="true">
      <SceneErrorBoundary onError={loaded}>
        <Canvas
          dpr={[1, 1.75]}
          // AgX is Blender 4's default view transform, so colours match the viewport render.
          gl={{ antialias: true, toneMapping: AgXToneMapping }}
          // Only used when the .glb has no camera: a raised three-quarter view for inspecting the scene.
          camera={{ position: [40, 35, 60], fov: 40, near: 0.1, far: 1000 }}
          shadows="percentage"
        >
          <color attach="background" args={['#212121']} />
          <directionalLight
            position={SUN.position}
            intensity={SUN.intensity}
            color={SUN.color}
            castShadow
            shadow-mapSize={[4096, 4096]}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
          >
            <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40, 1, 150]} />
          </directionalLight>
          {HDRI_URL ? (
            // Blender world HDRI: lights the scene and shows as the sky.
            <Environment files={HDRI_URL} background backgroundIntensity={1.5} environmentIntensity={HDRI_LIGHT} />
          ) : (
            // Built-in reflections so metal (steel, doors) isn't pitch black. No network fetch.
            <Environment resolution={256} environmentIntensity={0.6}>
              <Lightformer form="rect" intensity={2} color="#C6C9C0" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
              <Lightformer form="rect" intensity={1} color="#ABC9AF" position={[-8, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
              <Lightformer form="rect" intensity={1} color="#FF7348" position={[8, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
            </Environment>
          )}
          <Suspense fallback={null}>
            <Scene />
            <SceneReady onReady={loaded} />
          </Suspense>
        </Canvas>
      </SceneErrorBoundary>
    </div>
  )
}

useGLTF.preload(MODEL_URL)
