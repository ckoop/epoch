import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTimer, fmtDuration } from './hooks/useTimer'
import { POMODORO_PHASE_LABELS } from './hooks/usePomodoro'

export const PIP_SUPPORTED = typeof window !== 'undefined' && 'documentPictureInPicture' in window

// Die PiP-API ist an einen Secure Context gebunden (https:// oder localhost) — auf einer
// unverschlüsselten http-Verbindung existiert `documentPictureInPicture` schlicht nicht,
// selbst in einem Browser, der die API grundsätzlich unterstützt. Das von einer generell
// fehlenden Browser-Unterstützung (Firefox/Safari) unterscheiden, damit der Hinweis in der
// UI nur dort erscheint, wo https wirklich der Grund ist.
export const PIP_NEEDS_HTTPS = typeof window !== 'undefined' && !PIP_SUPPORTED && !window.isSecureContext

// Übernimmt alle Stylesheets (Google Fonts + Bundle-CSS) der Hauptseite ins PiP-Fenster,
// damit dort dieselben CSS-Variablen/Klassen (--accent, .tag, .pulse, ...) verfügbar sind.
function copyStyles(pipDoc) {
  for (const sheet of document.styleSheets) {
    const node = sheet.ownerNode
    if (!node) continue
    if (node.tagName === 'LINK') {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = node.href
      pipDoc.head.appendChild(link)
    } else if (node.tagName === 'STYLE') {
      const style = document.createElement('style')
      style.textContent = node.textContent
      pipDoc.head.appendChild(style)
    }
  }
}

export function usePipWidget() {
  const [pipWindow, setPipWindow] = useState(null)

  const open = useCallback(async () => {
    if (!PIP_SUPPORTED || pipWindow) return
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width: 280, height: 150 })
      pip.document.title = 'Epoch'
      pip.document.body.style.margin = '0'
      pip.document.body.style.background = '#0a0a0a'
      copyStyles(pip.document)
      pip.addEventListener('pagehide', () => setPipWindow(null), { once: true })
      setPipWindow(pip)
    } catch { /* Nutzer hat das PiP-Fenster nicht erlaubt oder Browser unterstützt es nicht */ }
  }, [pipWindow])

  const close = useCallback(() => { pipWindow?.close() }, [pipWindow])
  const toggle = useCallback(() => { pipWindow ? close() : open() }, [pipWindow, open, close])

  // Fenster schließen, wenn die Komponente, die den Hook hält, verschwindet
  useEffect(() => () => { pipWindow?.close() }, [pipWindow])

  return { supported: PIP_SUPPORTED, needsHttps: PIP_NEEDS_HTTPS, pipWindow, open, close, toggle }
}

export default function FloatingWidget({ pipWindow, activeTimer, pomodoro, simpleTimer }) {
  if (!pipWindow) return null
  return createPortal(<WidgetContent activeTimer={activeTimer} pomodoro={pomodoro} simpleTimer={simpleTimer} />, pipWindow.document.body)
}

function WidgetContent({ activeTimer, pomodoro, simpleTimer }) {
  const pomodoroActive = !!pomodoro?.state?.phase
  const simpleTimerActive = !!simpleTimer && (simpleTimer.running || simpleTimer.finished)
  const isStacked = (pomodoroActive || !!activeTimer) && simpleTimerActive

  const main = pomodoroActive
    ? <PomodoroWidget pomodoro={pomodoro} compact={isStacked} />
    : activeTimer
    ? <TimerWidget activeTimer={activeTimer} compact={isStacked} />
    : null

  if (!main && !simpleTimerActive) {
    return <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>Kein Timer aktiv</div>
  }

  return (
    <div style={{ ...wrap, gap: 10, background: (!main && simpleTimer?.finished) ? 'var(--red-dim)' : undefined }}>
      {main}
      {isStacked && <div style={{ borderTop: '1px solid var(--border)' }} />}
      {simpleTimerActive && <FreeTimerWidget simpleTimer={simpleTimer} compact={isStacked} />}
    </div>
  )
}

function TimerWidget({ activeTimer, compact }) {
  const elapsed = useTimer(activeTimer.start_time, activeTimer.paused_at, activeTimer.paused_seconds)
  const isPaused = !!activeTimer.paused_at
  const color = isPaused ? 'var(--amber)' : 'var(--accent)'
  return (
    <div>
      <div style={row}>
        {isPaused ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} /> : <span className="pulse" />}
        <span className="mono" style={{ ...label, color }}>{isPaused ? 'Pausiert' : 'Läuft'}</span>
        <span className="tag tag-g" style={{ marginLeft: 'auto' }}>{activeTimer.project}</span>
      </div>
      <div className="mono" style={{ ...time(compact), color }}>{fmtDuration(elapsed)}</div>
      {activeTimer.description && <div style={desc}>{activeTimer.description}</div>}
    </div>
  )
}

function PomodoroWidget({ pomodoro, compact }) {
  const { state, settings, remainingMs } = pomodoro
  const phase = state.phase
  const phaseLabel = POMODORO_PHASE_LABELS[phase] || phase
  const isBreak = phase === 'short_break' || phase === 'long_break'
  const color = isBreak ? 'var(--amber)' : 'var(--accent)'
  const cyclesTotal  = settings?.cycles_before_long_break || 4
  const cyclesFilled = state.cycles_completed % cyclesTotal

  return (
    <div>
      <div style={row}>
        {state.awaiting_confirmation ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} /> : <span className="pulse" />}
        <span className="mono" style={{ ...label, color }}>🍅 {phaseLabel}</span>
        {state.project && <span className="tag tag-g" style={{ marginLeft: 'auto' }}>{state.project}</span>}
      </div>
      {state.awaiting_confirmation ? (
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>{phaseLabel} bereit — weiter?</div>
      ) : (
        <>
          <div className="mono" style={{ ...time(compact), color }}>{fmtDuration(remainingMs)}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
            {Array.from({ length: cyclesTotal }).map((_, i) => (
              <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < cyclesFilled ? 'var(--accent)' : 'var(--border2)' }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FreeTimerWidget({ simpleTimer, compact }) {
  const { isCountdown, remainingMs, elapsedMs, finished } = simpleTimer
  const color = finished ? 'var(--red)' : 'var(--text)'
  return (
    <div>
      <div style={row}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: finished ? 'var(--red)' : 'var(--text2)', flexShrink: 0 }} />
        <span className="mono" style={{ ...label, color }}>{finished ? 'Fertig' : 'Freier Timer'}</span>
      </div>
      <div className="mono" style={{ ...time(compact), color }}>{fmtDuration(isCountdown ? remainingMs : elapsedMs)}</div>
    </div>
  )
}

const wrap  = { fontFamily: 'var(--sans)', color: 'var(--text)', padding: '14px 16px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }
const row   = { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }
const label = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em' }
const time  = (compact) => ({ fontSize: compact ? 22 : 34, fontWeight: 300, letterSpacing: '-.02em', lineHeight: 1 })
const desc  = { fontSize: 11, color: 'var(--text2)', marginTop: 4 }
