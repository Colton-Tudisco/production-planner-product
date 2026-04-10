export default function BomAttentionPanel({ data, open, onClose }) {
  if (!data) return null

  return (
    <>
      <div className={`overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`slideout ${open ? 'open' : ''}`}>
        <div className="so-header">
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>
              Parts Needing BOM Attention
              <span className="badge b-orange" style={{ marginLeft: '10px' }}>
                {data.length} parts
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
          {data.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">✅</div>
              <div className="empty-title">No parts need attention</div>
            </div>
          ) : (
            data.map((r, i) => (
              <div key={i} className="attn-row">
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
            ))
          )}
        </div>
      </div>
    </>
  )
}