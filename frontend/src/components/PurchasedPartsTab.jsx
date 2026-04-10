import { useState, useMemo } from 'react'

function fn(n) { return Math.round(n).toLocaleString() }

export default function PurchasedPartsTab({ data }) {
  const [filt, setFilt] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let r = data || []
    if (filt === 'stale')  r = r.filter(x => x.Stale)
    else if (filt === 'open')  r = r.filter(x => x.OpenOrders > 0)
    else if (filt === 'noord') r = r.filter(x => x.OpenOrders === 0)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.PartNum.toLowerCase().includes(q) ||
        (x.Description || '').toLowerCase().includes(q) ||
        (x.LastSupplier || '').toLowerCase().includes(q)
      )
    }
    return r
  }, [data, filt, search])

  const stats = useMemo(() => ({
    total:  data?.length || 0,
    open:   data?.filter(r => r.OpenOrders > 0).length || 0,
    stale:  data?.filter(r => r.Stale).length || 0,
    once:   data?.filter(r => r.POCount === 1).length || 0,
    noord:  data?.filter(r => r.OpenOrders === 0).length || 0,
  }), [data])

  if (!data) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>

  return (
    <div>
      <div className="stat-row">
        <div className="stat-card"><div className="stat-label">Confirmed Buy-Parts</div><div className="stat-value">{stats.total}</div><div className="stat-sub">parts with PO history</div></div>
        <div className="stat-card"><div className="stat-label">With Open Orders</div><div className="stat-value sv-blue">{stats.open}</div><div className="stat-sub">active demand</div></div>
        <div className="stat-card"><div className="stat-label">Stale — Need Attention</div><div className="stat-value sv-orange">{stats.stale}</div><div className="stat-sub">orders + not bought 18mo+</div></div>
        <div className="stat-card"><div className="stat-label">Single PO Ever</div><div className="stat-value">{stats.once}</div><div className="stat-sub">only bought once</div></div>
        <div className="stat-card"><div className="stat-label">No Open Orders</div><div className="stat-value sv-muted">{stats.noord}</div><div className="stat-sub">history only, no demand</div></div>
      </div>

      <div className="tw">
        <div className="tw-head">
          <div className="tw-title">Purchased Parts — PO History</div>
          <div className="fr">
            <input
              className="si"
              type="text"
              placeholder="Search part, supplier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {['all','stale','open','noord'].map(f => (
              <button key={f} className={`fb ${filt === f ? 'active' : ''}`} onClick={() => setFilt(f)}>
                {f === 'all' ? 'All' : f === 'stale' ? '⚠ Stale' : f === 'open' ? 'Has Orders' : 'No Orders'}
              </button>
            ))}
          </div>
        </div>

        <div className="pp-grid pp-head">
          <div className="po-cell">Part #</div>
          <div className="po-cell">Description</div>
          <div className="po-cell">Last PO Date</div>
          <div className="po-cell">Days Since</div>
          <div className="po-cell">Last Supplier</div>
          <div className="po-cell" style={{ textAlign: 'right' }}>PO Count</div>
          <div className="po-cell" style={{ textAlign: 'right' }}>Open Qty</div>
          <div className="po-cell">Status</div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">🔍</div><div className="empty-title">No parts match</div></div>
        ) : filtered.map((r, i) => {
          const staleTag = r.Stale
            ? <span className="badge b-orange">⚠ Stale</span>
            : r.OpenOrders > 0
            ? <span className="badge b-green">Active</span>
            : <span className="badge b-muted">No demand</span>

          return (
            <div key={i} className="pp-grid">
              <div className="po-cell mono t2">{r.PartNum}</div>
              <div className="po-cell" style={{ fontSize: '12px' }}>
                <div>{(r.Description || '').substring(0, 42)}</div>
                {r.OpenOrders > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                    {r.OpenOrders} order{r.OpenOrders > 1 ? 's' : ''} · {fn(r.TotalOpenQty)} remaining · due {r.EarliestDue || '—'}
                  </div>
                )}
              </div>
              <div className="po-cell mono t2">{r.LastPODate || '—'}</div>
              <div className="po-cell mono" style={{ fontSize: '12px', color: r.DaysSinceLastPO > 540 ? 'var(--orange)' : 'var(--text2)' }}>
                {r.DaysSinceLastPO != null ? `${r.DaysSinceLastPO}d` : '—'}
              </div>
              <div className="po-cell" style={{ fontSize: '12px', color: 'var(--text2)' }}>
                {(r.LastSupplier || '—').substring(0, 30)}
              </div>
              <div className="po-cell mono" style={{ textAlign: 'right' }}>{r.POCount || 0}</div>
              <div className="po-cell mono" style={{ textAlign: 'right', color: r.OpenOrders > 0 ? 'var(--text)' : 'var(--text3)' }}>
                {r.OpenOrders > 0 ? fn(r.TotalOpenQty) : '—'}
              </div>
              <div className="po-cell">{staleTag}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}