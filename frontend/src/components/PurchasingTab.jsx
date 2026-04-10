import { useState, useMemo } from 'react'

function fd(n) {
  if (!n && n !== 0) return '—'
  return n % 1 === 0 ? Math.round(n).toLocaleString() : n.toFixed(3)
}

export default function PurchasingTab({ rawDemand, invIdx, poIdx, poDates, orders }) {
  const [filt, setFilt] = useState('all')
  const [search, setSearch] = useState('')
  const [openBD, setOpenBD] = useState({})

  const earliestShip = useMemo(() => {
    if (!orders?.length) return new Date()
    return orders.reduce((a, b) => a.days < b.days ? a : b).shipDate
  }, [orders])

  const mats = useMemo(() => {
    if (!rawDemand) return []
    return Object.keys(rawDemand).map(raw => {
      const d = rawDemand[raw].totalNeeded
      const oh = invIdx?.[raw] || 0
      const po = poIdx?.[raw] || 0
      const desc = rawDemand[raw].desc || raw
      const pdd = poDates?.[raw] || []
      const lp = pdd.length ? new Date(Math.max(...pdd)) : null
      const net = Math.max(0, d - oh - po)
      const act = net <= 0 ? 'cov' : po > 0 ? 'short' : 'need'
      return { raw, desc, d, oh, po, net, act, lp, late: lp && lp > earliestShip, orders: rawDemand[raw].orders }
    }).sort((a, b) => ({ need: 0, short: 1, cov: 2 }[a.act] - { need: 0, short: 1, cov: 2 }[b.act]) || b.d - a.d)
  }, [rawDemand, invIdx, poIdx, poDates, earliestShip])

  const filtered = useMemo(() => {
    let r = mats
    if (filt !== 'all') r = r.filter(m => m.act === filt)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(m => m.raw.toLowerCase().includes(q) || (m.desc || '').toLowerCase().includes(q))
    }
    return r
  }, [mats, filt, search])

  const stats = useMemo(() => ({
    need: mats.filter(m => m.act === 'need').length,
    short: mats.filter(m => m.act === 'short').length,
    cov: mats.filter(m => m.act === 'cov').length,
    late: mats.filter(m => m.late).length,
    total: mats.length
  }), [mats])

  if (!rawDemand) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>

  return (
    <div>
      <div className="stat-row">
        <div className="stat-card"><div className="stat-label">Need New PO</div><div className="stat-value sv-red">{stats.need}</div><div className="stat-sub">no coverage at all</div></div>
        <div className="stat-card"><div className="stat-label">PO Short</div><div className="stat-value sv-yellow">{stats.short}</div><div className="stat-sub">PO exists but not enough</div></div>
        <div className="stat-card"><div className="stat-label">Fully Covered</div><div className="stat-value sv-green">{stats.cov}</div><div className="stat-sub">stock + PO sufficient</div></div>
        <div className="stat-card"><div className="stat-label">Late PO Risk</div><div className="stat-value sv-yellow">{stats.late}</div><div className="stat-sub">PO arrives after due date</div></div>
        <div className="stat-card"><div className="stat-label">Raw Materials</div><div className="stat-value">{stats.total}</div><div className="stat-sub">unique materials needed</div></div>
      </div>

      <div className="tw">
        <div className="tw-head">
          <div className="tw-title">Consolidated Material Demand — All Open Orders</div>
          <div className="fr">
            <input className="si" type="text" placeholder="Search material..." value={search} onChange={e => setSearch(e.target.value)} />
            {['all','need','short','cov'].map(f => (
              <button key={f} className={`fb ${filt === f ? 'active' : ''}`} onClick={() => setFilt(f)}>
                {f === 'all' ? 'All' : f === 'need' ? 'Need PO' : f === 'short' ? 'Short' : 'Covered'}
              </button>
            ))}
          </div>
        </div>

        <div className="po-grid po-head">
          <div className="po-cell">Material</div>
          <div className="po-cell">Description</div>
          <div className="po-cell" style={{ textAlign: 'right' }}>Total Need</div>
          <div className="po-cell" style={{ textAlign: 'right' }}>On Hand</div>
          <div className="po-cell" style={{ textAlign: 'right' }}>Open PO</div>
          <div className="po-cell" style={{ textAlign: 'right' }}>Net Short</div>
          <div className="po-cell">PO Due</div>
          <div className="po-cell">Action</div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">Nothing to show for this filter</div></div>
        ) : filtered.map((m, i) => (
          <div key={i}>
            <div className="po-grid" style={{ cursor: 'pointer' }} onClick={() => setOpenBD(prev => ({ ...prev, [i]: !prev[i] }))}>
              <div className="po-cell mono t2">{m.raw}</div>
              <div className="po-cell t2" style={{ fontSize: '12px' }}>{(m.desc || '').substring(0, 40)}</div>
              <div className="po-cell mono" style={{ textAlign: 'right' }}>{fd(m.d)}</div>
              <div className="po-cell mono" style={{ textAlign: 'right', color: m.oh > 0 ? 'var(--text)' : 'var(--text3)' }}>{fd(m.oh)}</div>
              <div className="po-cell mono" style={{ textAlign: 'right', color: m.po > 0 ? 'var(--text2)' : 'var(--text3)' }}>{fd(m.po)}</div>
              <div className="po-cell mono" style={{ textAlign: 'right', color: m.net > 0 ? 'var(--red)' : 'var(--green)' }}>{m.net > 0 ? fd(m.net) : '—'}</div>
              <div className="po-cell">
                {m.lp ? (
                  <span style={{ color: m.late ? 'var(--yellow)' : 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '12px' }}>
                    {m.lp.toISOString().slice(0, 10)}
                  </span>
                ) : <span className="t3">—</span>}
              </div>
              <div style={{ padding: '7px 11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`po-tag ${m.act === 'need' ? 'pt-need' : m.act === 'short' ? 'pt-short' : 'pt-ok'}`}>
                  {m.act === 'need' ? '⚠ Create PO' : m.act === 'short' ? '~ Add to PO' : '✓ Covered'}
                </span>
                <button className="exp-btn">▾</button>
              </div>
            </div>
            {openBD[i] && (
              <div className="bd-row">
                <strong style={{ color: 'var(--text2)' }}>Demand breakdown — {m.raw}:</strong><br />
                {m.orders.map((o, oi) => (
                  <div key={oi}>Order {o.orderNum} · {o.partNum} · need {fd(o.qty)} · due {o.shipDate}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}