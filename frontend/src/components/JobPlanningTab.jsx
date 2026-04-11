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
  const [dupWarning, setDupWarning] = useState(false)
  const [jobsOpen, setJobsOpen] = useState(true)
  const [viewJob, setViewJob] = useState(null)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [editingJob, setEditingJob] = useState(null)

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
    let r = parts
    if (search) {
      const q = search.toLowerCase()
      const orderMatch = (orders || []).filter(o => String(o.OrderNum).includes(q)).map(o => o.PartNum)
      r = r.filter(g => g.pn.toLowerCase().includes(q) || (g.pd || '').toLowerCase().includes(q) || orderMatch.includes(g.pn))
    }
    if (overdueOnly) r = r.filter(g => (orders || []).some(o => o.PartNum === g.pn && o.days < 0))
    return r
  }, [parts, search, orders, overdueOnly])

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
    setViewJob(null)
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
    const mn = (bomIdx?.[selPart] || []).map(b => ({
      raw: b.MaterialPart, desc: b.MaterialDesc, uom: b.UOM,
      needed: tm * b.QtyPer,
      oh: invIdx?.[b.MaterialPart] || 0,
      po: poIdx?.[b.MaterialPart] || 0
    }))
    const updatedJob = {
      id: editingJob ? editingJob.id : `JOB-${String(jobs.length + 1).padStart(3, '0')}`,
      pn: selPart,
      pd: checkedOrders[0].PartDescription,
      tq, tm,
      orders: checkedOrders.map((o, i) => ({
        on: o.OrderNum, ol: o.OrderLine,
        qty: o.oq, uom: o.UOM,
        sd: o.ShipDateStr, cust: o.CustomerName, seq: i + 1
      })),
      mn, ca: editingJob ? editingJob.ca : new Date().toLocaleString()
    }
    if (editingJob) {
      setJobs(prev => prev.map(j => j.id === editingJob.id ? updatedJob : j))
      setEditingJob(null)
    } else {
      const alreadyExists = jobs.some(j => j.pn === selPart)
      if (alreadyExists && !dupWarning) { setDupWarning(true); return }
      setDupWarning(false)
      setJobs(prev => [...prev, updatedJob])
    }
    setCreatedMsg(true)
    setTimeout(() => { setCreatedMsg(false); setSelPart(null) }, 800)
  }

  const delJob = (i) => {
    const removing = jobs[i]
    if (viewJob?.id === removing.id) setViewJob(null)
    setJobs(prev => prev.filter((_, j) => j !== i))
  }

  if (!orders) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>

  return (
    <div>
      <div className="jp-layout">
        {/* SIDEBAR */}
        <div className="jp-sidebar">
          <div className="jp-sb-title">Parts with Open Orders</div>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              className="si"
              style={{ width: '100%' }}
              type="text"
              placeholder="Search part or order #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              className={`fb ${overdueOnly ? 'active' : ''}`}
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setOverdueOnly(p => !p)}
            >
              🔴 Overdue Only
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredParts.length === 0 ? (
              <div className="empty" style={{ padding: '20px' }}>
                <div className="empty-title">No BOM parts match</div>
                <div className="empty-sub" style={{ marginTop: '4px' }}>
                  Buy-parts → Purchased Parts tab<br />
                  No BOM + no history → ⚠ BOM Attention
                </div>
              </div>
            ) : filteredParts.filter(g => !jobs.some(j => j.pn === g.pn)).map(g => {
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

          {/* CREATED JOBS IN SIDEBAR */}
          {jobs.length > 0 && (
            <div style={{ borderTop: '2px solid var(--border)', flexShrink: 0, maxHeight: '220px', overflowY: 'auto' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: '10px', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--purple)', background: 'var(--purple-bg)', position: 'sticky', top: 0, zIndex: 1 }}>
                Created Jobs
              </div>
              {jobs.map((job, ji) => (
                <div
                  key={ji}
                  className={`jp-part-row ${viewJob?.id === job.id ? 'sel' : ''}`}
                  onClick={() => { setViewJob(job); setSelPart(null) }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500 }}>{job.id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>{job.pn}</div>
                  </div>
                  <span style={{ fontSize: '9px', background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-b)', borderRadius: '3px', padding: '1px 4px' }}>
                    {fn(job.tq)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BUILDER */}
        <div className="jp-builder">
          {viewJob ? (
            <div>
              {/* View Job Header */}
              <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 500 }}>{viewJob.id}</span>
                    <span className="badge b-purple">{viewJob.pn}</span>
                    {viewJob.mn.some(m => m.needed > m.oh + m.po) ? <span className="badge b-red">Material Gap</span> : <span className="badge b-green">Material OK</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{(viewJob.pd || '').substring(0, 58)}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setEditingJob(viewJob); selectPart(viewJob.pn) }}
                    style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-b)', borderRadius: '5px', padding: '5px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
                  >
                    ✏ Edit
                  </button>
                  <button
                    onClick={() => window.print()}
                    style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '5px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
                  >
                    🖨 Print
                  </button>
                  <button
                    onClick={() => { delJob(jobs.findIndex(j => j.id === viewJob.id)) }}
                    style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-b)', borderRadius: '5px', padding: '5px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
                  >
                    🗑 Remove
                  </button>
                  <button
                    onClick={() => setViewJob(null)}
                    style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '5px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Order table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Seq', 'Order', 'Customer', 'Qty', 'Ship By'].map(t => (
                      <td key={t} style={{ padding: '7px 11px', fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>{t}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewJob.orders.map((o, oi) => (
                    <tr key={oi} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 11px' }}><span className="seq-num">{o.seq}</span></td>
                      <td style={{ padding: '7px 11px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{o.on}-{o.ol}</td>
                      <td style={{ padding: '7px 11px', color: 'var(--text2)' }}>{(o.cust || '').substring(0, 28)}</td>
                      <td style={{ padding: '7px 11px', fontFamily: 'var(--mono)' }}>{fn(o.qty)} {o.uom || ''}</td>
                      <td style={{ padding: '7px 11px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{o.sd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Material breakdown */}
              {viewJob.mn.length > 0 && (
                <div style={{ padding: '11px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '8px' }}>
                    Raw Material ({fn(viewJob.tm)} units to produce)
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
                      {viewJob.mn.map((m, i) => {
                        const net = m.needed - m.oh - m.po
                        return (
                          <tr key={i}>
                            <td style={{ padding: '3px 8px 3px 0', fontFamily: 'var(--mono)' }}>
                              {m.raw} <span style={{ color: 'var(--text3)' }}>{(m.desc || '').substring(0, 32)}</span>
                            </td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fd(m.needed)} {m.uom || ''}</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: m.oh > 0 ? 'var(--text2)' : 'var(--text3)' }}>{fd(m.oh)}</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: m.po > 0 ? 'var(--text2)' : 'var(--text3)' }}>{fd(m.po)}</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 500, color: net > 0 ? 'var(--red)' : 'var(--green)' }}>
                              {net > 0 ? `+${fd(net)} SHORT` : `${fd(Math.abs(net))} OK`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary */}
              <div className="jp-summary">
                <div><div className="jp-sum-label">Orders</div><div className="jp-sum-val">{viewJob.orders.length}</div></div>
                <div><div className="jp-sum-label">Total Qty</div><div className="jp-sum-val">{fn(viewJob.tq)}</div></div>
                <div><div className="jp-sum-label">To Produce</div><div className="jp-sum-val">{fn(viewJob.tm)}</div></div>
                <div><div className="jp-sum-label">Created</div><div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{viewJob.ca}</div></div>
              </div>
            </div>
          ) : !selPart ? (
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
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  {dupWarning && (
                    <div style={{ fontSize: '11px', color: 'var(--yellow)', background: 'var(--yellow-bg)', border: '1px solid var(--yellow-b)', borderRadius: '4px', padding: '5px 10px', textAlign: 'right' }}>
                      ⚠ A job for <strong>{selPart}</strong> already exists. Click again to create a duplicate.
                    </div>
                  )}
                  <button
                    className="create-job-btn"
                    onClick={createJob}
                    disabled={checkedOrders.length === 0}
                    style={{ marginLeft: 0 }}
                  >
                    {createdMsg ? '✓ Saved!' : editingJob ? '💾 Save Job' : dupWarning ? '⚠ Confirm Duplicate' : '+ Create Job'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}