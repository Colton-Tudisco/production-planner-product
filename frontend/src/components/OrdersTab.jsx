import { useState, useMemo } from 'react'

function dayChip(days) {
  const c = days < 0 || days <= 7 ? 'red' : days <= 21 ? 'yellow' : 'green'
  return (
    <span className="daychip" style={{ background: `var(--${c}-bg)`, color: `var(--${c})` }}>
      {days < 0 ? 'OVERDUE' : `${days}d`}
    </span>
  )
}

function statusBadge(tier) {
  if (tier === 'red')    return <span className="badge b-red">Critical</span>
  if (tier === 'yellow') return <span className="badge b-yellow">At Risk</span>
  return <span className="badge b-green">On Track</span>
}

function canShipCell(cs) {
  if (cs === 'YES')    return <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500 }}>✓ YES</span>
  if (cs === 'PARTIAL') return <span style={{ color: 'var(--yellow)', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500 }}>~ PARTIAL</span>
  if (cs === 'MAKE')   return <span style={{ color: 'var(--yellow)', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500 }}>⚙ MAKE</span>
  if (cs === 'NOBOM')  return <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '11px' }}>NO BOM</span>
  return <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500 }}>✗ NO</span>
}

function MatBar({ order }) {
  if (!order.hasBOM || !order.md?.length) {
    return <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '11px' }}>{order.hasBOM ? '—' : 'No BOM'}</span>
  }
  const pct = Math.round(order.wc * 100)
  const bc = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)'
  return (
    <div className="matbar-wrap tip-wrap">
      <div className="matbar-bg">
        <div className="matbar-fill" style={{ width: `${Math.min(100, pct)}%`, background: bc }} />
      </div>
      <span className="matbar-label">{pct}%</span>
      <div className="tip">
        {order.md.slice(0, 6).map((m, i) => (
          <div key={i}>{m.raw}: need {fd(m.needed)} | OH {fd(m.onHand)} | PO {fd(m.po)}</div>
        ))}
        {order.md.length > 6 && <div>...+{order.md.length - 6} more</div>}
      </div>
    </div>
  )
}

function fd(n) {
  if (!n && n !== 0) return '—'
  return n % 1 === 0 ? Math.round(n).toLocaleString() : n.toFixed(3)
}

function fn(n) { return Math.round(n).toLocaleString() }

export default function OrdersTab({ orders }) {
  const [view, setView] = useState('i')
  const [filt, setFilt] = useState('all')
  const [search, setSearch] = useState('')
  const [openGroups, setOpenGroups] = useState({})

  const filtered = useMemo(() => {
    let r = orders || []
    if (filt === 'red')    r = r.filter(o => o.tier === 'red')
    else if (filt === 'yellow') r = r.filter(o => o.tier === 'yellow')
    else if (filt === 'green')  r = r.filter(o => o.tier === 'green')
    else if (filt === 'gap')    r = r.filter(o => o.hasGap)
    else if (filt === 'nobom')  r = r.filter(o => !o.hasBOM)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(o =>
        (o.PartNum || '').toLowerCase().includes(q) ||
        (o.PartDescription || '').toLowerCase().includes(q) ||
        (o.CustomerName || '').toLowerCase().includes(q) ||
        String(o.OrderNum || '').includes(q)
      )
    }
    return r
  }, [orders, filt, search])

  const groups = useMemo(() => {
    const g = {}
    filtered.forEach(o => {
      if (!g[o.PartNum]) g[o.PartNum] = { pn: o.PartNum, pd: o.PartDescription, orders: [] }
      g[o.PartNum].orders.push(o)
    })
    return Object.values(g)
  }, [filtered])

  const toggleGroup = (pn) => setOpenGroups(prev => ({ ...prev, [pn]: !prev[pn] }))

  const stats = useMemo(() => ({
    total: orders?.length || 0,
    crit: orders?.filter(o => o.tier === 'red').length || 0,
    risk: orders?.filter(o => o.tier === 'yellow').length || 0,
    ok: orders?.filter(o => o.tier === 'green').length || 0,
    gap: orders?.filter(o => o.hasGap).length || 0,
  }), [orders])

  if (!orders) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading orders...</div></div>

  return (
    <div>
      {/* STAT CARDS */}
      <div className="stat-row">
        <div className="stat-card"><div className="stat-label">Open Orders</div><div className="stat-value">{stats.total}</div><div className="stat-sub">lines with remaining qty</div></div>
        <div className="stat-card"><div className="stat-label">Critical ≤7 days</div><div className="stat-value sv-red">{stats.crit}</div><div className="stat-sub">immediate action needed</div></div>
        <div className="stat-card"><div className="stat-label">At Risk 8–21 days</div><div className="stat-value sv-yellow">{stats.risk}</div><div className="stat-sub">monitor closely</div></div>
        <div className="stat-card"><div className="stat-label">On Track &gt;21 days</div><div className="stat-value sv-green">{stats.ok}</div><div className="stat-sub">sufficient lead time</div></div>
        <div className="stat-card"><div className="stat-label">Material Gaps</div><div className="stat-value sv-red">{stats.gap}</div><div className="stat-sub">orders with RM shortage</div></div>
      </div>

      <div className="tw">
        <div className="tw-head">
          <div className="tw-title">Open Sales Orders</div>
          <div className="fr">
            <div className="vt">
              <button className={`vtb ${view === 'i' ? 'active' : ''}`} onClick={() => setView('i')}>Individual</button>
              <button className={`vtb ${view === 'g' ? 'active' : ''}`} onClick={() => setView('g')}>Grouped by Part</button>
            </div>
            <input className="si" type="text" placeholder="Part, customer, order #..." value={search} onChange={e => setSearch(e.target.value)} />
            {['all','red','yellow','green','gap','nobom'].map(f => (
              <button key={f} className={`fb ${filt === f ? 'active' : ''}`} onClick={() => setFilt(f)}>
                {f === 'all' ? 'All' : f === 'red' ? '🔴 Critical' : f === 'yellow' ? '🟡 At Risk' : f === 'green' ? '🟢 On Track' : f === 'gap' ? '⚠ Shortage' : 'No BOM'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">🔍</div><div className="empty-title">No orders match</div></div>
        ) : view === 'i' ? (
          <table>
            <thead>
              <tr>
                <th>Order</th><th>Part</th><th>Customer</th>
                <th style={{ textAlign: 'right' }}>Remaining</th>
                <th style={{ textAlign: 'right' }}>FG On Hand</th>
                <th style={{ textAlign: 'right' }}>To Make</th>
                <th>Ship By</th><th>Days</th><th>Material</th><th>Can Ship?</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={i}>
                  <td className="mono t2">{o.OrderNum}-{o.OrderLine}</td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: '12px' }}>{o.PartNum}</div>
                    <div className="t3" style={{ fontSize: '11px' }}>{(o.PartDescription || '').substring(0, 40)}</div>
                  </td>
                  <td className="t2" style={{ fontSize: '12px' }}>{(o.CustomerName || '').substring(0, 24)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fn(o.oq)} {o.UOM || ''}</td>
                  <td className="mono" style={{ textAlign: 'right', color: o.fgOH > 0 ? 'var(--text)' : 'var(--text3)' }}>{fn(o.fgOH)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: o.toMake > 0 ? 'var(--text)' : 'var(--text3)' }}>{fn(o.toMake)}</td>
                  <td className="mono t2">{o.ShipDateStr}</td>
                  <td>{dayChip(o.days)}</td>
                  <td><MatBar order={o} /></td>
                  <td>{canShipCell(o.cs)}</td>
                  <td>{statusBadge(o.tier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['', 'Part', 'Orders', 'Total Remaining', 'FG On Hand', 'To Make', 'Due Range', 'Status', ''].map((t, i) => (
                  <th key={i} style={{ padding: '8px 11px', textAlign: [3,4,5].includes(i) ? 'right' : 'left', fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', background: 'var(--surface2)' }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => {
                const tq = g.orders.reduce((s, o) => s + o.oq, 0)
                const fg = g.orders[0].fgOH
                const tm = g.orders.reduce((s, o) => s + o.toMake, 0)
                const wt = g.orders.some(o => o.tier === 'red') ? 'red' : g.orders.some(o => o.tier === 'yellow') ? 'yellow' : 'green'
                const ea = g.orders.reduce((a, b) => a.days < b.days ? a : b)
                const la = g.orders.reduce((a, b) => a.days > b.days ? a : b)
                const dr = g.orders.length === 1 ? ea.ShipDateStr : `${ea.ShipDateStr} → ${la.ShipDateStr}`
                const isOpen = openGroups[g.pn]
                return (
                  <>
                    <tr key={`g-${gi}`} style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => toggleGroup(g.pn)}>
                      <td style={{ padding: '10px 11px', width: '26px' }}><span style={{ fontSize: '10px', color: 'var(--text3)' }}>{isOpen ? '▼' : '▶'}</span></td>
                      <td style={{ padding: '10px 11px' }}>
                        <div style={{ fontWeight: 500, fontFamily: 'var(--mono)', fontSize: '12px' }}>{g.pn}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{(g.pd || '').substring(0, 42)}</div>
                      </td>
                      <td style={{ padding: '10px 11px' }}><span className="badge b-blue">{g.orders.length}</span></td>
                      <td style={{ padding: '10px 11px', fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right' }}>{fn(tq)}</td>
                      <td style={{ padding: '10px 11px', fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', color: fg > 0 ? 'var(--text)' : 'var(--text3)' }}>{fn(fg)}</td>
                      <td style={{ padding: '10px 11px', fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', color: tm > 0 ? 'var(--text)' : 'var(--green)' }}>{fn(tm)}</td>
                      <td style={{ padding: '10px 11px', fontSize: '12px', color: 'var(--text2)' }}>{dr}</td>
                      <td style={{ padding: '10px 11px' }}>{statusBadge(wt)}</td>
                      <td style={{ padding: '10px 11px' }}>
                        <button style={{ background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-b)', borderRadius: '4px', fontSize: '11px', fontWeight: 600, padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--sans)' }}
                          onClick={e => { e.stopPropagation() }}>
                          ⚙ Plan
                        </button>
                      </td>
                    </tr>
                    {isOpen && g.orders.map((o, oi) => (
                      <tr key={`c-${gi}-${oi}`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                        <td style={{ padding: '7px 11px 7px 28px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text2)' }}>{o.OrderNum}-{o.OrderLine}</td>
                        <td style={{ padding: '7px 11px', fontSize: '12px', color: 'var(--text2)' }}>{(o.CustomerName || '').substring(0, 28)}</td>
                        <td style={{ padding: '7px 11px', fontFamily: 'var(--mono)', fontSize: '12px' }}>{fn(o.oq)} {o.UOM || ''}</td>
                        <td style={{ padding: '7px 11px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text2)' }}>{o.ShipDateStr}</td>
                        <td style={{ padding: '7px 11px' }}>{dayChip(o.days)}</td>
                        <td style={{ padding: '7px 11px' }}>{canShipCell(o.cs)}</td>
                        <td style={{ padding: '7px 11px' }}>{statusBadge(o.tier)}</td>
                        <td colSpan={2} />
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}