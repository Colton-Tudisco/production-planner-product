import { useState, useEffect, useMemo } from 'react'
import { api } from './utils/api'
import Header from './components/Header'
import DataBar from './components/DataBar'
import BomAttentionPanel from './components/BomAttentionPanel'
import OrdersTab from './components/OrdersTab'
import JobPlanningTab from './components/JobPlanningTab'
import PurchasingTab from './components/PurchasingTab'
import PurchasedPartsTab from './components/PurchasedPartsTab'
import MaterialsTab from './components/MaterialsTab'
import './index.css'

const TABS = [
  { id: 'orders',    label: 'Order Status' },
  { id: 'jobs',      label: 'Job Planning' },
  { id: 'purchasing', label: 'Purchasing Alerts' },
  { id: 'purchased', label: 'Purchased Parts' },
  { id: 'materials', label: 'Material Inventory' },
]

export default function App() {
  const [tab, setTab] = useState('orders')
  const [status, setStatus] = useState(null)
  const [appData, setAppData] = useState(null)
  const [attnOpen, setAttnOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStatus = async () => {
    try {
      const res = await api.getStatus()
      setStatus(res.data)
    } catch (e) {
      console.error('Status fetch failed', e)
    }
  }

  const fetchData = async (retries = 4) => {
    try {
      const res = await api.getData()
      setAppData(res.data)
      setError(null)
      setLoading(false)
    } catch (e) {
      if ((e.response?.status === 404 || !e.response) && retries > 0) {
        setTimeout(() => fetchData(retries - 1), 1500)
        return
      }
      if (e.response?.status === 404) {
        setError('No data processed yet. Upload your Epicor exports and click Process Data.')
      } else {
        setError('Failed to load data: ' + e.message)
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchData()
  }, [])

  const handleRefresh = () => {
    fetchStatus()
    fetchData()
  }

  // ── ANALYSIS ENGINE ────────────────────────────────────────────────────────
  const computed = useMemo(() => {
    if (!appData) return null
    const today = new Date(); today.setHours(0,0,0,0)

    const invIdx = {}
    appData.inventory.forEach(r => { invIdx[r.PartNum] = (invIdx[r.PartNum] || 0) + (r.OnHand || 0) })

    const bomIdx = {}
    appData.bom.forEach(b => {
      if (!bomIdx[b.ParentPart]) bomIdx[b.ParentPart] = []
      bomIdx[b.ParentPart].push(b)
    })

    const poIdx = {}, poDates = {}
    appData.openPos.forEach(p => {
      poIdx[p.PartNum] = (poIdx[p.PartNum] || 0) + (p.TotalOpenQty || 0)
      if (!poDates[p.PartNum]) poDates[p.PartNum] = []
      if (p.LatestDueStr) poDates[p.PartNum].push(new Date(p.LatestDueStr))
    })

    const rawDemand = {}

    const orders = appData.salesOrders.map(so => {
      const sd = new Date(so.ShipDateStr); sd.setHours(0,0,0,0)
      const days = Math.round((sd - today) / 86400000)
      const oq = so.RemainingQty || 0
      const fgOH = invIdx[so.PartNum] || 0
      const toMake = Math.max(0, oq - fgOH)
      const hasBOM = !!bomIdx[so.PartNum]
      const boms = bomIdx[so.PartNum] || []
      let wc = 1, hasGap = false
      const md = []

      boms.forEach(b => {
        const n = toMake * b.QtyPer
        const oh = invIdx[b.MaterialPart] || 0
        const po = poIdx[b.MaterialPart] || 0
        const cov = n > 0 ? Math.min(1, (oh + po) / n) : 1
        if (cov < 1) hasGap = true
        wc = Math.min(wc, cov)
        md.push({ raw: b.MaterialPart, desc: b.MaterialDesc, needed: n, onHand: oh, po, cov })
        if (!rawDemand[b.MaterialPart]) rawDemand[b.MaterialPart] = { totalNeeded: 0, desc: b.MaterialDesc, orders: [] }
        rawDemand[b.MaterialPart].totalNeeded += n
        rawDemand[b.MaterialPart].orders.push({ orderNum: so.OrderNum, partNum: so.PartNum, qty: n, shipDate: so.ShipDateStr })
      })

      let cs = 'YES'
      if (!hasBOM) cs = fgOH >= oq ? 'YES' : 'NOBOM'
      else if (fgOH >= oq) cs = 'YES'
      else if (hasGap) cs = wc > 0 ? 'PARTIAL' : 'NO'
      else if (toMake > 0) cs = 'MAKE'

      let tier = 'green'
      if (days < 0 || days <= 7) tier = 'red'
      else if (days <= 21) tier = 'yellow'
      if (cs === 'NO' && days <= 21) tier = 'red'
      if (cs === 'PARTIAL' && days <= 14) tier = 'red'

      return { ...so, days, oq, fgOH, toMake, hasBOM, hasGap, wc, cs, tier, md, shipDate: sd }
    })

    orders.sort((a, b) => a.days - b.days)
    return { orders, rawDemand, invIdx, bomIdx, poIdx, poDates }
  }, [appData])

  const staleCount = appData?.purchasedParts?.filter(r => r.Stale).length || 0
  const attnCount  = appData?.bomAttention?.length || 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header status={status} onAttnClick={() => setAttnOpen(true)} />

      {/* NAV */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: tab === t.id ? 'var(--blue)' : 'var(--text3)',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--sans)',
              transition: 'all .15s'
            }}
          >
            {t.label}
            {t.id === 'purchased' && staleCount > 0 && (
              <span style={{ background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-b)', borderRadius: '99px', fontSize: '10px', padding: '1px 6px', fontFamily: 'var(--mono)' }}>
                {staleCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ padding: '20px 24px', maxWidth: '1700px' }}>
        <DataBar status={status} onRefresh={handleRefresh} />

        {loading ? (
          <div className="empty">
            <div className="empty-icon">⏳</div>
            <div className="empty-title">Loading...</div>
          </div>
        ) : error ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '30px', marginBottom: '12px' }}>📂</div>
            <div style={{ fontSize: '15px', color: 'var(--text2)', marginBottom: '6px', fontWeight: 500 }}>No data loaded yet</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{error}</div>
          </div>
        ) : (
          <>
            {tab === 'orders'     && <OrdersTab orders={computed?.orders} />}
            {tab === 'jobs'       && <JobPlanningTab orders={computed?.orders} bomIdx={computed?.bomIdx} invIdx={computed?.invIdx} poIdx={computed?.poIdx} />}
            {tab === 'purchasing' && <PurchasingTab rawDemand={computed?.rawDemand} invIdx={computed?.invIdx} poIdx={computed?.poIdx} poDates={computed?.poDates} orders={computed?.orders} />}
            {tab === 'purchased'  && <PurchasedPartsTab data={appData?.purchasedParts} />}
            {tab === 'materials'  && <MaterialsTab rawDemand={computed?.rawDemand} invIdx={computed?.invIdx} />}
          </>
        )}
      </div>

      <BomAttentionPanel
        data={appData?.bomAttention}
        open={attnOpen}
        onClose={() => setAttnOpen(false)}
      />
    </div>
  )
}