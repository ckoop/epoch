import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'epoch_simple_timer'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* Speicher voll/gesperrt — Persistenz einfach überspringen */ }
}

// Rote Variante des Favicon-Kreis-Icons (gleiche Form wie public/favicon.svg, nur in Rot).
const RED_FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="7" fill="#0a0a0a"/>
    <circle cx="16" cy="17.5" r="10" fill="none" stroke="#ff4444" stroke-width="2.4"/>
    <path d="M16 11.5v6l3.3 3.3" fill="none" stroke="#ff4444" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 4h8M16 4v3" fill="none" stroke="#ff4444" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`
)

export function useSimpleTimer() {
  const [state, setState] = useState(() => loadState() || { targetSeconds: 0, running: false, startedAt: null, finished: false })
  const [now, setNow] = useState(Date.now())
  const raf = useRef(null)
  const originalFavicon = useRef(null)
  const originalTitle = useRef(null)

  useEffect(() => { saveState(state) }, [state])

  // Ticker, solange der Timer läuft
  useEffect(() => {
    if (!state.running) return
    const tick = () => { setNow(Date.now()); raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [state.running])

  const elapsedMs = state.startedAt ? Math.max(0, now - state.startedAt) : 0
  const isCountdown = state.targetSeconds > 0
  const remainingMs = isCountdown ? Math.max(0, state.targetSeconds * 1000 - elapsedMs) : 0

  // Countdown-Ende erkennen und einfrieren
  useEffect(() => {
    if (state.running && isCountdown && remainingMs <= 0) {
      setState(s => ({ ...s, running: false, finished: true }))
    }
  }, [state.running, isCountdown, remainingMs])

  // Favicon/Titel bei "Fertig" rot färben, beim Verlassen zurücksetzen
  useEffect(() => {
    const link = document.querySelector('link[rel="icon"]')
    if (state.finished) {
      if (link && originalFavicon.current === null) originalFavicon.current = link.href
      if (originalTitle.current === null) originalTitle.current = document.title
      if (link) link.href = RED_FAVICON
      document.title = '🔴 Fertig — Epoch'
    } else {
      if (link && originalFavicon.current !== null) { link.href = originalFavicon.current; originalFavicon.current = null }
      if (originalTitle.current !== null) { document.title = originalTitle.current; originalTitle.current = null }
    }
  }, [state.finished])

  const setTargetSeconds = useCallback((seconds) => {
    setState(s => (s.running || s.finished) ? s : { ...s, targetSeconds: Math.max(0, seconds) })
  }, [])

  const start = useCallback(() => {
    setState(s => (s.running || s.finished) ? s : { ...s, running: true, startedAt: Date.now() })
  }, [])

  const reset = useCallback(() => {
    setState(s => ({ ...s, running: false, startedAt: null, finished: false }))
  }, [])

  return {
    targetSeconds: state.targetSeconds,
    setTargetSeconds,
    running: state.running,
    finished: state.finished,
    isCountdown,
    elapsedMs,
    remainingMs,
    start,
    reset,
  }
}
