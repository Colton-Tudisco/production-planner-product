import { useState, useMemo } from 'react'

function fn(n) { return Math.round(n).toLocaleString() }
function fd(n) {
  if (!n && n !== 0) return '—'
  return n % 1 === 0 ? Math.round(n).toLocaleString() : n.toFixed(3)
}

function dayChip(days) {
  const c = days < 0 || days <= 7 ? 'red' : days <= 21 ? 'yellow' : 'green'
  return (
    <span className="daychip" style={{ background: `var(--${c}-bg)`, color: `var(--${c})` }}>
      {days < 0 ? 'OVRD' : `${days}d`}
    </span>
  )
}

export default function JobPlanningTab({ orders, bomIdx, invIdx, poIdx }) {
  const [selPart, setSelPart] = useState(null)
  const [jpWin, setJpWin] = useState('all')
  const [jpFrom, setJpFrom] = useState('')
  const [jpTo, setJpTo] = useState('')
  const [jpFulfill, setJpFulfill] = useState('fifo')
  const [jpChk, setJpChk] = useState({})
  const [jobs, setJobs] = useState([])
  const [search, setSearch] = useState('')
  const [dragSrc, setDragSrc] = useState(null)
  const [createdMsg, setCreatedMsg] = useState(false)

  // Parts with BOM only
  const parts = useMemo(() => {
    const grps = {}
    ;(orders || []).forEach(o => {
      if (!bomIdx?.[o.PartNum]) return
      if (!grps[o.PartNum]) grps[o.PartNum] = { pn: o.PartNum, pd: o.PartDescription, cnt: 0, tier: 'green' }
      grps[o.PartNum].cnt++
      if (o.tier === 'red') grps[o.PartNum].tier = 'red'
      else if (o.tier === 'yellow' && grps[o.PartNum].tier !== 'red') grps[o.PartNum].tier = 'yellow'
    })
    return Object.values(grps).sort((a, b) =>
      ({ red: 0, yellow: 1, green: 2 }[a.tier] - { red: 0, yellow: 1, green: 2 }[b.tier])
    )
  }, [orders, bomIdx])

  const filteredParts = useMemo(() => {
    if (!search) return parts
    const q = search.toLowerCase()
    return parts.filter(g => g.pn.toLowerCase().includes(q) || (g.pd || '').toLowerCase().includes(q))
  }, [parts, search])

  const jpOrders = useMemo(() => {
    if (!selPart || !orders) return []
    let o = orders.filter(x => x.PartNum === selPart)
    if (jpWin === '30') o = o.filter(x => x.days <= 30 && x.days >= 0)
    else if (jpWin === '60') o = o.filter(x => x.days <= 60 && x.days >= 0)
    else if (jpWin === 'custom' && jpFrom && jpTo) {
      const f = new Date(jpFrom), t = new Date(jpTo)
      o = o.filter(x => new Date(x.ShipDateStr) >= f && new Date(x.ShipDateStr) <= t)
    }
    if (jpFulfill === 'fifo') o = [...o].sort((a, b) => a.days - b.days)
    return o
  }, [selPart, orders, jpWin, jpFrom, jpTo, jpFulfill])

  const checkedOrders = useMemo(() =>
    jpOrders.filter(o => jpChk[`${o.OrderNum}-${o.OrderLine}`] !== false),
    [jpOrders, jpChk]
  )

  const tq = checkedOrders.reduce((s, o) => s + o.oq, 0)
  const tm = checkedOrders.reduce((s, o) => s + o.toMake, 0)

  const matRows = useMemo(() => {
    if (!selPart || !bomIdx?.[selPart]) return []
    return bomIdx[selPart].map(b => {
      const n = tm * b.QtyPer
      const oh = invIdx?.[b.MaterialPart] || 0
      const po = poIdx?.[b.MaterialPart] || 0
      return { raw: b.MaterialPart, desc: b.MaterialDesc, uom: b.UOM, n, oh, po, net: n - oh - po }
    })
  }, [selPart, bomIdx, invIdx, poIdx, tm])

  const hasGap = matRows.some(m => m.net > 0)

  const selectPart = (pn) => {
    setSelPart(pn)
    setJpWin('all')
    setJpFrom('')
    setJpTo('')
    setJpFulfill('fifo')
    const newChk = {}
    ;(orders || []).filter(o => o.PartNum === pn).forEach(o => {
      newChk[`${o.OrderNum}-${o.OrderLine}`] = true
    })
    setJpChk(newChk)
  }

  const toggleChk = (key) => setJpChk(prev => ({ ...prev, [key]: !prev[key] }))
  const toggleAll = (v) => {
    const newChk = {}
    jpOrders.forEach(o => { newChk[`${o.OrderNum}-${o.OrderLine}`] = v })
    setJpChk(newChk)
  }

  const changeWindow = (v) => {
    setJpWin(v)
    const newChk = {}
    jpOrders.forEach(o => { newChk[`${o.OrderNum}-${o.OrderLine}`] = true })
    setJpChk(newChk)
  }

  const createJob = () => {
    if (!selPart || !checkedOrders.length) return
    const pd = checkedOrders[0].PartDescription
    const id = `JOB-${String(jobs.length + 1).padStart(3, '0')}`
    const mn = (bomIdx?.[selPart] || []).map(b => ({
      raw: b.MaterialPart, desc: b.MaterialDesc, uom: b.UOM,
      needed: tm * b.QtyPer,
      oh: invIdx?.[b.MaterialPart] || 0,
      po: poIdx?.[b.MaterialPart] || 0
    }))
    setJobs(prev => [...prev, {
      id, pn: selPart, pd, tq, tm,
      orders: checkedOrders.map((o, i) => ({
        on: o.OrderNum, ol: o.OrderLine,
        qty: o.oq, uom: o.UOM,
        sd: o.ShipDateStr, cust: o.CustomerName, seq: i + 1
      })),
      mn, ca: new Date().toLocaleString()
    }])
    setCreatedMsg(true)
    setTimeout(() => setCreatedMsg(false), 1500)
  }

  const delJob = (i) => setJobs(prev => prev.filter((_, j) => j !== i))

  if (!orders) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>

  return (
    <div>
      <div className="jp-layout">
        {/* SIDEBAR */}
        <div className="jp-sidebar">
          <div className="jp-sb-title">Parts with Open Orders</div>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input
              className="si"
              style={{ width: '100%' }}
              type="text"
              placeholder="Search part..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {filteredParts.length === 0 ? (
            <div className="empty" style={{ padding: '20px' }}>
              <div className="empty-title">No BOM parts match</div>
              <div className="empty-sub" style={{ marginTop: '4px' }}>
                Buy-parts → Purchased Parts tab<br />
                No BOM + no history → ⚠ BOM Attention
              </div>
            </div>
          ) : filteredParts.map(g => {
            const dot = g.tier === 'red' ? 'var(--red)' : g.tier === 'yellow' ? 'var(--yellow)' : 'var(--green)'
            const hasJob = jobs.some(j => j.pn === g.pn)
            return (
              <div
                key={g.pn}
                className={`jp-part-row ${selPart === g.pn ? 'sel' : ''}`}
                onClick={() => selectPart(g.pn)}
              >
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    {g.pn}
                    {hasJob && (
                      <span style={{ fontSize: '9px', background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-b)', borderRadius: '3px', padding: '1px 4px' }}>
                        JOB
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>
                    {(g.pd || '').substring(0, 32)}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                  {g.cnt}x
                </div>
              </div>
            )
          })}
        </div>

        {/* BUILDER */}
        <div className="jp-builder">
          {!selPart ? (
            <div className="empty" style={{ padding: '44px 20px' }}>
              <div className="empty-icon">🔧</div>
              <div className="empty-title">Select a part to build a job</div>
              <div className="empty-sub">Only parts with a BOM appear here. Confirmed buy-parts are in the Purchased Parts tab.</div>
            </div>
          ) : (
            <>
              {/* Builder header */}
              <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{selPart}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>
                    {(jpOrders[0]?.PartDescription || '').substring(0, 58)}
                  </div>
                </div>
                <span className="badge b-blue">{jpOrders.length} order{jpOrders.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Controls */}
              <div className="jp-ctrl">
                <span className="jp-ctrl-label">Window:</span>
                <select className="jp-select" value={jpWin} onChange={e => changeWindow(e.target.value)}>
                  <option value="all">All open orders</option>
                  <option value="30">Due in 30 days</option>
                  <option value="60">Due in 60 days</option>
                  <option value="custom">Custom range</option>
                </select>
                {jpWin === 'custom' && (
                  <>
                    <input className="date-in" type="date" value={jpFrom} onChange={e => setJpFrom(e.target.value)} />
                    <span className="t3" style={{ fontSize: '12px' }}>to</span>
                    <input className="date-in" type="date" value={jpTo} onChange={e => setJpTo(e.target.value)} />
                  </>
                )}
                <span className="jp-ctrl-label" style={{ marginLeft: '8px' }}>Fulfill:</span>
                <select className="jp-select" value={jpFulfill} onChange={e => setJpFulfill(e.target.value)}>
                  <option value="fifo">FIFO by due date</option>
                  <option value="manual">Manual order</option>
                </select>
                <button className="fb" onClick={() => toggleAll(true)}>Select All</button>
                <button className="fb" onClick={() => toggleAll(false)}>Deselect All</button>
              </div>

              {/* Order rows header */}
              <div className="jp-order-row jp-order-head">
                <div className="jp-cell"></div>
                <div className="jp-cell">Order / Customer</div>
                <div className="jp-cell"></div>
                <div className="jp-cell" style={{ textAlign: 'right' }}>Remaining</div>
                <div className="jp-cell" style={{ textAlign: 'right' }}>To Make</div>
                <div className="jp-cell">Ship By</div>
                <div className="jp-cell">Days</div>
              </div>

              {/* Order rows */}
              {jpOrders.map((o, i) => {
                const key = `${o.OrderNum}-${o.OrderLine}`
                const ck = jpChk[key] !== false
                return (
                  <div
                    key={i}
                    className="jp-order-row"
                    draggable={jpFulfill === 'manual'}
                    onDragStart={() => setDragSrc(i)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      if (dragSrc === null || dragSrc === i) return
                      setDragSrc(null)
                    }}
                    style={{ opacity: ck ? 1 : 0.4, cursor: jpFulfill === 'manual' ? 'grab' : 'default' }}
                  >
                    <div className="jp-cell">
                      <input
                        type="checkbox"
                        className="jp-check"
                        checked={ck}
                        onChange={() => toggleChk(key)}
                      />
                    </div>
                    <div className="jp-cell">
                      <div className="mono t2">{o.OrderNum}-{o.OrderLine}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{(o.CustomerName || '').substring(0, 26)}</div>
                    </div>
                    <div className="jp-cell">
                      {jpFulfill === 'manual' && (
                        <span style={{ color: 'var(--text3)', fontSize: '14px' }}>⠿</span>
                      )}
                    </div>
                    <div className="jp-cell mono" style={{ textAlign: 'right' }}>{fn(o.oq)} {o.UOM || ''}</div>
                    <div className="jp-cell mono" style={{ textAlign: 'right', color: o.toMake > 0 ? 'var(--text)' : 'var(--text3)' }}>{fn(o.toMake)}</div>
                    <div className="jp-cell mono t2">{o.ShipDateStr}</div>
                    <div className="jp-cell">{dayChip(o.days)}</div>
                  </div>
                )
              })}

              {/* Material breakdown */}
              {matRows.length > 0 && (
                <div style={{ padding: '11px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '8px' }}>
                    Raw Material for This Job ({fn(tm)} units to produce)
                  </div>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text3)', fontSize: '10px', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        <td style={{ padding: '2px 8px 5px 0' }}>Material</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right' }}>Need</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right' }}>On Hand</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right' }}>Open PO</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right' }}>Net</td>
                      </tr>
                    </thead>
                    <tbody>
                      {matRows.map((m, i) => (
                        <tr key={i}>
                          <td style={{ padding: '3px 8px 3px 0', fontFamily: 'var(--mono)' }}>
                            {m.raw} <span style={{ color: 'var(--text3)' }}>{(m.desc || '').substring(0, 32)}</span>
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fd(m.n)} {m.uom || ''}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: m.oh > 0 ? 'var(--text2)' : 'var(--text3)' }}>{fd(m.oh)}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: m.po > 0 ? 'var(--text2)' : 'var(--text3)' }}>{fd(m.po)}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 500, color: m.net > 0 ? 'var(--red)' : 'var(--green)' }}>
                            {m.net > 0 ? `+${fd(m.net)} SHORT` : `${fd(Math.abs(m.net))} OK`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary bar */}
              <div className="jp-summary">
                <div><div className="jp-sum-label">Selected</div><div className="jp-sum-val">{checkedOrders.length}/{jpOrders.length}</div></div>
                <div><div className="jp-sum-label">Total Job Qty</div><div className="jp-sum-val">{fn(tq)}</div></div>
                <div><div className="jp-sum-label">To Produce</div><div className="jp-sum-val">{fn(tm)}</div></div>
                <div>
                  <div className="jp-sum-label">Material</div>
                  <div className={`jp-sum-val ${hasGap ? 'red' : 'green'}`}>{hasGap ? '⚠ GAP' : '✓ OK'}</div>
                </div>
                <button
                  className="create-job-btn"
                  onClick={createJob}
                  disabled={checkedOrders.length === 0}
                >
                  {createdMsg ? '✓ Created!' : '+ Create Job'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CREATED JOBS */}
      {jobs.length > 0 && (
        <div style={{ marginTop: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>
            Created Jobs
          </div>
          {jobs.map((job, ji) => {
            const gap = job.mn.some(m => m.needed > m.oh + m.po)
            return (
              <div key={ji} className="job-card">
                <div className="job-card-head">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500 }}>{job.id}</span>
                      <span className="badge b-purple">{job.pn}</span>
                      {gap ? <span className="badge b-red">Material Gap</span> : <span className="badge b-green">Material OK</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                      {(job.pd || '').substring(0, 50)} · {fn(job.tq)} pcs · {job.orders.length} order{job.orders.length > 1 ? 's' : ''} · {job.ca}
                    </div>
                  </div>
                  <button className="del-btn" onClick={() => delJob(ji)}>Remove</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Seq', 'Order', 'Customer', 'Qty', 'Ship By'].map(t => (
                        <td key={t} style={{ padding: '6px 11px', fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>{t}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {job.orders.map((o, oi) => (
                      <tr key={oi}>
                        <td style={{ padding: '7px 11px' }}>
                          <span className="seq-num">{o.seq}</span>
                        </td>
                        <td style={{ padding: '7px 11px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{o.on}-{o.ol}</td>
                        <td style={{ padding: '7px 11px', color: 'var(--text2)' }}>{(o.cust || '').substring(0, 28)}</td>
                        <td style={{ padding: '7px 11px', fontFamily: 'var(--mono)' }}>{fn(o.qty)} {o.uom || ''}</td>
                        <td style={{ padding: '7px 11px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{o.sd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {job.mn.length > 0 && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {job.mn.map((m, mi) => {
                      const net = m.needed - m.oh - m.po
                      return (
                        <span key={mi} style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: net > 0 ? 'var(--red)' : 'var(--text3)' }}>
                          <strong style={{ color: net > 0 ? 'var(--red)' : 'var(--text2)' }}>{m.raw}</strong>: {fd(m.needed)} {m.uom || ''}{net > 0 ? ` | short ${fd(net)}` : '  ✓'}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}