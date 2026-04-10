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
  processData: () => axios.post(`${BASE}/process`),
}

export const FILE_TYPES = {
  sales_orders: { label: 'Sales Orders',    filename: 'Open_Sales_Orders.xlsx',      icon: '📋' },
  inventory:    { label: 'Inventory',        filename: 'all_inventory_on_hand.xlsx',  icon: '📦' },
  bom:          { label: 'BOM',              filename: 'BOM.xlsx',                    icon: '🔩' },
  open_pos:     { label: 'Open POs',         filename: 'Open_POs.xlsx',               icon: '🛒' },
  closed_pos:   { label: 'Closed POs',       filename: 'Closed_POs.csv',              icon: '📁' },
}