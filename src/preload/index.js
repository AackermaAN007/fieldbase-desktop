const { contextBridge, ipcRenderer } = require('electron')

const api = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

contextBridge.exposeInMainWorld('electron', {
  settings: {
    get: () => api('settings:get'),
    set: (data) => api('settings:set', data),
  },
  clients: {
    list: () => api('clients:list'),
    get: (id) => api('clients:get', id),
    create: (data) => api('clients:create', data),
    update: (data) => api('clients:update', data),
    delete: (id) => api('clients:delete', id),
  },
  jobs: {
    list: (clientId) => api('jobs:list', clientId),
    get: (id) => api('jobs:get', id),
    create: (data) => api('jobs:create', data),
    update: (data) => api('jobs:update', data),
    delete: (id) => api('jobs:delete', id),
  },
  materials: {
    list: () => api('materials:list'),
    create: (data) => api('materials:create', data),
    update: (data) => api('materials:update', data),
    delete: (id) => api('materials:delete', id),
  },
  invoices: {
    list: (filters) => api('invoices:list', filters),
    get: (id) => api('invoices:get', id),
    create: (data) => api('invoices:create', data),
    update: (data) => api('invoices:update', data),
    delete: (id) => api('invoices:delete', id),
    convertToInvoice: (id) => api('invoices:convertToInvoice', id),
    exportPdf: (id) => api('invoices:exportPdf', id),
  },
  deposits: {
    list: (invoiceId) => api('deposits:list', invoiceId),
    create: (data) => api('deposits:create', data),
    delete: (id) => api('deposits:delete', id),
  },
  photos: {
    list: (jobId) => api('photos:list', jobId),
    get: (id) => api('photos:get', id),
    upload: (jobId) => api('photos:upload', { jobId }),
    updateCaption: (id, caption) => api('photos:updateCaption', { id, caption }),
    delete: (id) => api('photos:delete', id),
  },
  changeOrders: {
    list: (jobId) => api('changeOrders:list', jobId),
    create: (data) => api('changeOrders:create', data),
    update: (data) => api('changeOrders:update', data),
    delete: (id) => api('changeOrders:delete', id),
  },
  signatures: {
    get: (invoiceId) => api('signatures:get', invoiceId),
    save: (data) => api('signatures:save', data),
  },
  email: {
    sendInvoice: (data) => api('email:sendInvoice', data),
    sendReminders: () => api('email:sendReminders'),
    sendTest: () => api('email:sendTest'),
  },
  reports: {
    aging: () => api('reports:aging'),
    revenue: (filters) => api('reports:revenue', filters),
  },
  expenses: {
    list: (filters) => api('expenses:list', filters),
    create: (data) => api('expenses:create', data),
    update: (data) => api('expenses:update', data),
    delete: (id) => api('expenses:delete', id),
    scanReceipt: (data) => api('expenses:scanReceipt', data),
    pickReceipt: () => api('expenses:pickReceipt'),
  },
  payments: {
    list: (invoiceId) => api('payments:list', invoiceId),
    create: (data) => api('payments:create', data),
    delete: (id) => api('payments:delete', id),
  },
  pdf: {
    save: (data) => api('pdf:save', data),
  },
  db: {
    backup: () => api('db:backup'),
  },
  license: {
    getDeviceId: () => api('license:getDeviceId'),
    activate: (data) => api('license:activate', data),
    check: () => api('license:check'),
  },
  schedules: {
    list: (filters) => api('schedules:list', filters),
    create: (data) => api('schedules:create', data),
    update: (data) => api('schedules:update', data),
    delete: (id) => api('schedules:delete', id),
  },
  auth: {
    signup: (data) => api('auth:signup', data),
    login: (data) => api('auth:login', data),
    restoreSession: () => api('auth:restoreSession'),
    logout: () => api('auth:logout'),
    google: () => api('auth:google'),
    apple: () => api('auth:apple'),
  },
  mobile: {
    generateToken: (data) => api('mobile:generateToken', data),
    consumeToken: (data) => api('mobile:consumeToken', data),
  },
  team: {
    get: () => api('team:get'),
    create: (data) => api('team:create', data),
    invite: (data) => api('team:invite', data),
    removeMember: (data) => api('team:removeMember', data),
    assignJob: (data) => api('team:assignJob', data),
    getTimeEntries: (data) => api('team:getTimeEntries', data),
  },
  shell: {
    openExternal: (url) => api('shell:openExternal', url),
  },
  log: {
    getPath: () => api('log:getPath'),
    error: (msg) => api('log:error', msg),
    openFolder: () => api('log:openFolder'),
  },
  updater: {
    install: () => api('update:install'),
  },
  on: (channel, cb) => {
    ipcRenderer.on(channel, (_, ...args) => cb(...args))
    return () => ipcRenderer.removeListener(channel, cb)
  },
})
