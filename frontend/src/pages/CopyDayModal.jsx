import { useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/de'
import { api } from '../api'

dayjs.locale('de')

export function CopyDayModal({ sourceDate, entryCount, onClose, onCopied }) {
  const today = dayjs().format('YYYY-MM-DD')
  const [targetDate, setTargetDate] = useState(sourceDate === today ? dayjs().add(1, 'day').format('YYYY-MM-DD') : today)
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)

  const handleCopy = async () => {
    setError(null); setLoading(true)
    try {
      await api.copyDay(sourceDate, targetDate)
      onCopied()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Tag kopieren</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
          {entryCount} {entryCount === 1 ? 'Eintrag' : 'Einträge'} von {dayjs(sourceDate).format('ddd, D. MMM YYYY')} auf einen anderen Tag übertragen.
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div className="label" style={{ marginBottom: 5 }}>Ziel-Datum</div>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Abbrechen</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCopy} disabled={loading}>
              {loading ? '…' : '✓ Kopieren'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
