import { useState } from 'react'
import { api } from '../utils/api'

export default function BomAttentionPanel({ data, open, onClose, onOverride }) {
  const [saving, setSaving] = useState({})
  const [done, setDone] = useState({})

  const markAs = async (partNum, type) => {
    setSaving(prev => ({ ...prev, [partNum]: type }))
    try {
      await api.upsertOverride(partNum, type)
      await api.processData()
      setDone(prev => ({ ...prev, [partNum]: type }))
      if (onOverride) onOverride()
    } catch (e) {
      alert(`Failed to save override: ${e.message}`)
    } finally {
      setSaving(prev => ({ ...prev, [partNum]: null }))
    }
  }

  if (!data) return null

  const visible = data.filter(r => !done[r.PartNum])

  return (
    <>
      <div className={`overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`slideout ${open ? 'open' : ''}`}>
        <div className="so-header">
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>
              Parts Needing BOM Attention
              <span className="badge b-orange" style={{ marginLeft: '10px' }}>
                {visible.length} parts
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.6 }}>
              Open orders exist but no BOM is loaded in Epicor and no purchase history found.
              These need a BOM loaded or confirmed as a new purchased part.
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕ Close</button>
        </div>

        <div className="so-body">
          {visible.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">✅</div>
              <div className="empty-title">No parts need attention</div>
            </div>
          ) : (
            visible.map((r, i) => (
              <div key={i} className="attn-row">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                      {r.PartNum}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                      {r.Description || '—'}
                    </div>
                    <div className="attn-chips">
                      <span className="attn-chip">{r.OpenOrders} open order{r.OpenOrders !== 1 ? 's' : ''}</span>
                      <span className="attn-chip">{r.TotalOpenQty?.toLocaleString()} remaining</span>
                      <span className="attn-chip">Earliest due: {r.EarliestDue || '—'}</span>
                      {r.Customers?.slice(0, 2).map((c, ci) => (
                        <span key={ci} className="attn-chip">{c}</span>
                      ))}
                      {r.Customers?.length > 2 && (
                        <span className="attn-chip">+{r.Customers.length - 2} more</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
                    <button
                      onClick={() => markAs(r.PartNum, 'purchased')}
                      disabled={!!saving[r.PartNum]}
                      style={{
                        background: 'var(--green-bg)', color: 'var(--green)',
                        border: '1px solid var(--green-b)', borderRadius: '4px',
                        fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                        cursor: 'pointer', fontFamily: 'var(--sans)', whiteSpace: 'nowrap'
                      }}
                    >
                      {saving[r.PartNum] === 'purchased' ? '⏳ Saving...' : '✓ Mark as Purchased'}
                    </button>
                    <button
                      onClick={() => markAs(r.PartNum, 'hidden')}
                      disabled={!!saving[r.PartNum]}
                      style={{
                        background: 'var(--surface2)', color: 'var(--text3)',
                        border: '1px solid var(--border)', borderRadius: '4px',
                        fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                        cursor: 'pointer', fontFamily: 'var(--sans)', whiteSpace: 'nowrap'
                      }}
                    >
                      {saving[r.PartNum] === 'hidden' ? '⏳ Saving...' : '— Hide'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}