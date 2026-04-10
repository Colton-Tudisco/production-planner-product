import { useState, useRef } from 'react'
import { api, FILE_TYPES } from '../utils/api'

export default function DataBar({ status, onRefresh }) {
  const [uploading, setUploading] = useState({})
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState(null)
  const fileRefs = useRef({})

  const handleUpload = async (fileType, file) => {
    setUploading(prev => ({ ...prev, [fileType]: true }))
    setMessage(null)
    try {
      await api.uploadFile(fileType, file)
      setMessage({ type: 'success', text: `${FILE_TYPES[fileType].label} uploaded successfully` })
      onRefresh()
    } catch (e) {
      setMessage({ type: 'error', text: `Upload failed: ${e.message}` })
    } finally {
      setUploading(prev => ({ ...prev, [fileType]: false }))
    }
  }

  const handleProcess = async () => {
    setProcessing(true)
    setMessage(null)
    try {
      const res = await api.processData()
      const counts = res.data.counts
      setMessage({
        type: 'success',
        text: `Processed — ${counts.salesOrders} orders · ${counts.bom} BOM rows · ${counts.purchasedParts} buy-parts · ${counts.bomAttention} need attention`
      })
      onRefresh()
    } catch (e) {
      setMessage({ type: 'error', text: `Processing failed: ${e.message}` })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '14px 18px',
      marginBottom: '18px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
          Epicor Exports:
        </span>

        {Object.entries(FILE_TYPES).map(([key, info]) => {
          const loaded = status?.files?.[key]
          return (
            <div key={key} style={{ position: 'relative' }}>
              <input
                type="file"
                accept=".xlsx,.csv"
                style={{ display: 'none' }}
                ref={el => fileRefs.current[key] = el}
                onChange={e => e.target.files[0] && handleUpload(key, e.target.files[0])}
              />
              <button
                onClick={() => fileRefs.current[key]?.click()}
                disabled={uploading[key]}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: loaded ? 'var(--green-bg)' : 'var(--surface2)',
                  border: `1px solid ${loaded ? 'var(--green-b)' : 'var(--border)'}`,
                  borderRadius: '5px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontFamily: 'var(--mono)',
                  color: loaded ? 'var(--green)' : 'var(--text3)',
                  cursor: 'pointer',
                  transition: 'all .15s'
                }}
              >
                <span>{info.icon}</span>
                <span>{uploading[key] ? 'Uploading...' : info.label}</span>
                {loaded && <span>✓</span>}
              </button>
            </div>
          )
        })}

        <button
          onClick={handleProcess}
          disabled={processing || !Object.values(status?.files || {}).some(Boolean)}
          style={{
            marginLeft: '8px',
            background: 'var(--accent-b)',
            color: '#93b8f0',
            border: '1px solid #3a5a9a',
            borderRadius: '5px',
            padding: '6px 16px',
            fontFamily: 'var(--sans)',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? .6 : 1,
            transition: 'all .15s'
          }}
        >
          {processing ? '⏳ Processing...' : '▶ Process Data'}
        </button>
      </div>

      {message && (
        <div style={{
          marginTop: '10px',
          fontSize: '12px',
          fontFamily: 'var(--mono)',
          color: message.type === 'success' ? 'var(--green)' : 'var(--red)',
          padding: '6px 10px',
          background: message.type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)',
          border: `1px solid ${message.type === 'success' ? 'var(--green-b)' : 'var(--red-b)'}`,
          borderRadius: '5px'
        }}>
          {message.text}
        </div>
      )}
    </div>
  )
}