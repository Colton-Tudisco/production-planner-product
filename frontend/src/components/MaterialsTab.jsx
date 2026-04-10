import { useState, useMemo } from 'react'

function fd(n) {
  if (!n && n !== 0) return '—'
  return n % 1 === 0 ? Math.round(n).toLocaleString() : n.toFixed(3)
}

export default function MaterialsTab({ rawDemand, invIdx }) {
  const [filt, setFilt] = useState('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    if (!invIdx && !rawDemand) return []
    const allR = new Set([
      ...Object.keys(invIdx || {}),
      ...Object.keys(rawDemand || {})
    ])
    return [...allR].map(raw => ({
      raw,
      oh: invIdx?.[raw] || 0,
      dem: rawDemand?.[raw]?.totalNeeded || 0,
      desc: rawDemand?.[raw]?.desc || ''
    })).filter(r => r.dem > 0 || r.oh > 0)
  }, [rawDemand, invIdx])

  const filtered = useMemo(() => {
    let r = rows
    if (filt === 'short') r = r.filter(x => x.oh - x.dem < 0)
    else if (filt === 'ok') r = r.filter(x => x.oh - x.dem >= 0 && x.dem > 0)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x => x.raw.toLowerCase().includes(q) || (x.desc || '').toLowerCase().includes(q))
    }
    return [...r].sort((a, b) => (a.oh - a.dem) - (b.oh - b.dem))
  }, [rows, filt, search])

  if (!invIdx && !rawDemand) return (
    <div className="empty">
      <div className="empty-icon">⏳</div>
      <div className="empty-title">Loading...</div>
    </div>
  )

  return (
    <div className="tw">
      <div className="tw-head">
        <div className="tw-title">Raw Material Inventory vs Demand</div>
        <div className="fr">
          <input
            className="si"
            type="text"
            placeholder="Search material..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {['all', 'short', 'ok'].map(f => (
            <button
              key={f}
              className={`fb ${filt === f ? 'active' : ''}`}
              onClick={() => setFilt(f)}
            >
              {f === 'all' ? 'All' : f === 'short' ? 'Short' : 'Sufficient'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">No materials match</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Part #</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>On Hand</th>
              <th style={{ textAlign: 'right' }}>Total Demand</th>
              <th style={{ textAlign: 'right' }}>Net Position</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const net = r.oh - r.dem
              return (
                <tr key={i}>
                  <td className="mono t2">{r.raw}</td>
                  <td style={{ fontSize: '12px' }}>{(r.desc || '').substring(0, 50)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fd(r.oh)}</td>
                  <td className="mono t2" style={{ textAlign: 'right' }}>{fd(r.dem)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fd(net)}
                  </td>
                  <td>
                    {net >= 0
                      ? <span className="badge b-green">Sufficient</span>
                      : <span className="badge b-red">Short {fd(Math.abs(net))}</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}