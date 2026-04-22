import axios from 'axios'

const BASE = 'http://127.0.0.1:8000/api'

export const api = {
  // Check backend health and file status
  getStatus: () => axios.get(`${BASE}/status`),

  // Get processed app data
  getData: () => axios.get(`${BASE}/data`),

  // Upload a single file
  uploadFile: (fileType, file) => {
    const form = new FormData()
    form.append('file', file)
    return axios.post(`${BASE}/upload/${fileType}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // Trigger data processing
  // Trigger data processing
  processData: () => axios.post(`${BASE}/process`),

// Overrides (Supabase-backed)
  upsertOverride: (partNum, overrideType, note = '') =>
    axios.post(`${BASE}/overrides`, { part_num: partNum, override_type: overrideType, note }),

  deleteOverride: (partNum) =>
    axios.delete(`${BASE}/overrides/${partNum}`),

  // Jobs (Supabase-backed)
  getJobs: () => axios.get(`${BASE}/jobs`),
  saveJob: (job) => axios.post(`${BASE}/jobs`, job),
  deleteJob: (jobId) => axios.delete(`${BASE}/jobs/${jobId}`),
}

export const FILE_TYPES = {
  sales_orders: { label: 'Sales Orders',    filename: 'Open_Sales_Orders.xlsx',      icon: '📋' },
  inventory:    { label: 'Inventory',        filename: 'all_inventory_on_hand.xlsx',  icon: '📦' },
  bom:          { label: 'BOM',              filename: 'BOM.xlsx',                    icon: '🔩' },
  open_pos:     { label: 'Open POs',         filename: 'Open_POs.xlsx',               icon: '🛒' },
  closed_pos:   { label: 'Closed POs',       filename: 'Closed_POs.csv',              icon: '📁' },
}