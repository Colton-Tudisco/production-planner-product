export default function Header({ status, onAttnClick }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'var(--accent-b)', color: '#93b8f0', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', letterSpacing: '.12em' }}>SEM</span>
          Production Planner
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {status?.processedAt && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)' }}>
            Last processed: {new Date(status.processedAt).toLocaleString()}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: status?.processed ? 'var(--green)' : 'var(--text3)',
            boxShadow: status?.processed ? '0 0 6px var(--green)' : 'none'
          }} />
          {status?.processed ? 'Data loaded' : 'No data'}
        </div>
        <button
          onClick={onAttnClick}
          className="attn-btn"
          style={{
            background: 'var(--orange-bg)',
            color: 'var(--orange)',
            border: '1px solid var(--orange-b)',
            borderRadius: '5px',
            padding: '5px 14px',
            fontFamily: 'var(--sans)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          ⚠ BOM Attention
        </button>
      </div>
    </div>
  )
}