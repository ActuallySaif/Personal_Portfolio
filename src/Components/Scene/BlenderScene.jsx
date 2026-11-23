import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bounds, Environment, Lightformer, OrbitControls, useAnimations, useGLTF, useProgress } from '@react-three/drei'
import { AgXToneMapping, LoopOnce, MathUtils } from 'three'
import './BlenderScene.css'

// Exported from Blender (File > Export > glTF 2.0, .glb). See models/README.md.
export const MODEL_URL = '/models/scene.glb'
// Blender world HDRI (.hdr or .exr). Set to null to fall back to the built-in studio light.
export const HDRI_URL = '/hdri/sky.exr'

// Stand-in for Blender's Sky Texture sun. Tweak to match the sun elevation/rotation there.
const SUN = { position: [30, 40, 25], intensity: 3, color: '#FFF1E0' }

/** 0 at the top of the page, 1 at the bottom. */
function readScrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  return max > 0 ? MathUtils.clamp(window.scrollY / max, 0, 1) : 0
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

  // Every clip shares one timeline, so later door/container animations scrub in sync with the camera.
  const duration = useMemo(() => Math.max(0, ...animations.map((c) => c.duration)), [animations])
  const progress = useRef(readScrollProgress())

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
    progress.current = MathUtils.damp(progress.current, readScrollProgress(), 6, dt)
    const t = progress.current * duration
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

  return <primitive object={scene} />
}

/** Plain DOM overlay (outside the canvas) so it can unmount safely when loading finishes. */
function LoadingLabel() {
  const { active, progress } = useProgress()
  if (!active) return null
  return <div className="scene-label">Loading scene {progress.toFixed(0)}%</div>
}

/** Shows a hint instead of a blank page when the .glb is missing or fails to load. */
class SceneErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
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
  return (
    <div className="scene-canvas" aria-hidden="true">
      <SceneErrorBoundary>
        <Canvas
          dpr={[1, 1.75]}
          // AgX is Blender 4's default view transform, so colours match the viewport render.
          gl={{ antialias: true, toneMapping: AgXToneMapping }}
          // Only used when the .glb has no camera: a raised three-quarter view for inspecting the scene.
          camera={{ position: [40, 35, 60], fov: 40, near: 0.1, far: 1000 }}
          shadows="percentage"
        >
          <color attach="background" args={['#212121']} />
          {/* Soft fill in case the export has no lights. Exported Blender lights add on top. */}
          <hemisphereLight args={['#C6C9C0', '#212121', 0.6]} />
          <directionalLight
            position={SUN.position}
            intensity={SUN.intensity}
            color={SUN.color}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
          >
            <orthographicCamera attach="shadow-camera" args={[-50, 50, 50, -50, 1, 150]} />
          </directionalLight>
          {HDRI_URL ? (
            // Blender world HDRI: lights the scene and shows as the sky.
            <Environment files={HDRI_URL} background />
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
          </Suspense>
        </Canvas>
        <LoadingLabel />
      </SceneErrorBoundary>
    </div>
  )
}

useGLTF.preload(MODEL_URL)
