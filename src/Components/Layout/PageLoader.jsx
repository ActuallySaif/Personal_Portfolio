import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import Preloader from '../../Pages/Preloader'

// The preloader stays up at least this long, so it never just flashes.
const MIN_SHOW_MS = 1200
// Must match the opacity transition on .Preloader.is-overlay in Preloader.css.
const FADE_MS = 600
// Give up waiting on a page that never says it's ready (e.g. a stalled download).
const MAX_WAIT_MS = 20000

const HoldContext = createContext(() => () => {})

/**
 * Shows the Preloader over every page: on first load and on each route change.
 * It fades out once MIN_SHOW_MS has passed and no page is holding it (see usePageHold).
 */
export default function PageLoader({ children }) {
  const { pathname } = useLocation()
  const holds = useRef(new Set())
  const [pending, setPending] = useState(0)
  const [minDone, setMinDone] = useState(false)
  const [phase, setPhase] = useState('shown') // shown -> hiding -> gone

  const hold = useCallback(() => {
    const id = {}
    holds.current.add(id)
    setPending(holds.current.size)
    return () => {
      if (!holds.current.delete(id)) return
      setPending(holds.current.size)
    }
  }, [])

  // New page: bring the preloader back and restart the minimum timer.
  useLayoutEffect(() => {
    setPhase('shown')
    setMinDone(false)
    window.scrollTo(0, 0)
    const min = setTimeout(() => setMinDone(true), MIN_SHOW_MS)
    const max = setTimeout(() => {
      holds.current.clear()
      setPending(0)
    }, MAX_WAIT_MS)
    return () => {
      clearTimeout(min)
      clearTimeout(max)
    }
  }, [pathname])

  useEffect(() => {
    if (phase === 'shown' && minDone && pending === 0) setPhase('hiding')
  }, [phase, minDone, pending])

  useEffect(() => {
    if (phase !== 'hiding') return
    const t = setTimeout(() => setPhase('gone'), FADE_MS)
    return () => clearTimeout(t)
  }, [phase])

  // No scrolling the page underneath while the preloader is up.
  useEffect(() => {
    if (phase === 'gone') return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
    }
  }, [phase])

  return (
    <HoldContext.Provider value={hold}>
      {children}
      {phase !== 'gone' && <Preloader overlay hiding={phase === 'hiding'} />}
    </HoldContext.Provider>
  )
}

/**
 * Call in a page or component that needs time to load (3D scenes, big images, data).
 * The preloader stays up until you call the returned `done()`, or the component unmounts.
 * Pages that don't use this just get the minimum preloader time.
 */
export function usePageHold() {
  const hold = useContext(HoldContext)
  const release = useRef(null)
  useLayoutEffect(() => {
    release.current = hold()
    return release.current
  }, [hold])
  return useCallback(() => release.current?.(), [])
}
