process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1'

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const log = require('./logger')

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err.message, err.stack)
})
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason instanceof Error ? reason.stack : String(reason))
})

const http = require('http')
const { randomBytes, createHash } = require('crypto')
const { machineIdSync } = require('node-machine-id')
const { autoUpdater } = require('electron-updater')
const cloud = require('./supabase')
const { encrypt, decrypt } = require('./encryption')
const QRCode = require('qrcode')

let db
let mainWindow

// ─── Single instance lock ─────────────────────────────────────────────────────
// If the user clicks the shortcut a second time, focus the existing window instead
// of opening a duplicate.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function isDev() {
  if (app.isPackaged) return false
  // --fast flag or FIELDBASE_FAST env var both trigger production-mode loading
  return !process.argv.includes('--fast') && !process.env.FIELDBASE_FAST
}

function getDbPath() {
  // Always use a fixed folder in AppData so data survives reinstalls, dev/prod switches,
  // and path changes. Never store the DB inside the app directory.
  const dataDir = path.join(app.getPath('appData'), 'Fieldbase')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'fieldbase.db')
}

function initDatabase() {
  const Database = require('better-sqlite3')
  const dbPath = getDbPath()

  // One-time migration: if old DB exists at userData path, move it to new fixed location
  const oldPath = path.join(app.getPath('userData'), 'invoices.db')
  if (!fs.existsSync(dbPath) && fs.existsSync(oldPath)) {
    try { fs.copyFileSync(oldPath, dbPath) } catch {}
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      site_address TEXT,
      site_city TEXT,
      site_state TEXT,
      site_zip TEXT,
      status TEXT DEFAULT 'active',
      description TEXT,
      assigned_to TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS materials_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT DEFAULT 'each',
      cost_price REAL DEFAULT 0,
      markup_pct REAL DEFAULT 20,
      category TEXT DEFAULT 'General',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      type TEXT DEFAULT 'invoice',
      status TEXT DEFAULT 'draft',
      issue_date TEXT,
      due_date TEXT,
      tax_rate REAL DEFAULT 0,
      discount_pct REAL DEFAULT 0,
      notes TEXT,
      terms TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurring_interval TEXT,
      parent_template_id INTEGER,
      late_fee_pct REAL DEFAULT 0,
      late_fee_applied INTEGER DEFAULT 0,
      sent_at TEXT,
      paid_at TEXT,
      last_reminder_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      category TEXT DEFAULT 'Labor',
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoice_deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      note TEXT,
      paid_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      filename TEXT,
      data TEXT NOT NULL,
      caption TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS change_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      signer_name TEXT,
      data TEXT NOT NULL,
      signed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      vendor TEXT,
      description TEXT,
      amount REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      category TEXT DEFAULT 'Materials',
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      receipt_image TEXT,
      notes TEXT,
      ai_scanned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      method TEXT DEFAULT 'manual',
      note TEXT,
      paid_at TEXT DEFAULT (datetime('now')),
      stripe_payment_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      start_datetime TEXT NOT NULL,
      end_datetime TEXT,
      all_day INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'scheduled',
      color TEXT DEFAULT '#4f7ef8',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_job ON expenses(job_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_job ON schedules(job_id);
    CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
  `)

  // Migrations for existing databases
  const invCols = db.prepare("PRAGMA table_info(invoices)").all().map(c => c.name)
  if (!invCols.includes('last_reminder_at')) db.exec("ALTER TABLE invoices ADD COLUMN last_reminder_at TEXT")

  const jobCols = db.prepare("PRAGMA table_info(jobs)").all().map(c => c.name)
  if (!jobCols.includes('assigned_to')) db.exec("ALTER TABLE jobs ADD COLUMN assigned_to TEXT")

  // cloud_id columns for Supabase sync
  const tables = ['clients', 'jobs', 'invoices', 'expenses', 'payments', 'schedules', 'change_orders', 'materials_library']
  for (const t of tables) {
    const tc = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name)
    if (!tc.includes('cloud_id')) db.exec(`ALTER TABLE ${t} ADD COLUMN cloud_id TEXT`)
  }
}

function createWindow() {
  // When packaged, public/ is in app.asar.unpacked — use that path so the OS can read it
  const publicDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'public')
    : path.join(__dirname, '../../public')
  const iconFile = process.platform === 'darwin'
    ? path.join(publicDir, 'icon.icns')
    : path.join(publicDir, 'icon.ico')

  // Restore last window size/position
  const winState = getSetting('window_state', null)
  const winBounds = winState && winState.width ? winState : { width: 1280, height: 800 }

  mainWindow = new BrowserWindow({
    width: winBounds.width,
    height: winBounds.height,
    x: winBounds.x,
    y: winBounds.y,
    minWidth: 960,
    minHeight: 620,
    icon: iconFile,
    title: 'Fieldbase',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a1628',
    show: true, // show immediately — backgroundColor prevents white flash
  })

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  if (!isDev()) autoUpdater.checkForUpdatesAndNotify()

  // Save window size/position when it changes so it restores on next launch
  function saveWinState() {
    if (!mainWindow || mainWindow.isMinimized() || mainWindow.isMaximized()) return
    try { setSetting('window_state', mainWindow.getBounds()) } catch {}
  }
  mainWindow.on('resize', saveWinState)
  mainWindow.on('move', saveWinState)

  mainWindow.webContents.on('did-fail-load', (_, code, desc) => {
    log.error('[Fieldbase] Page failed to load:', code, desc)
  })
}

function migrateEncryption() {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const migrate = db.transaction(() => {
      for (const r of rows) {
        if (r.value && !r.value.startsWith('ENC:')) {
          upsert.run(r.key, encrypt(r.value))
        }
      }
    })
    migrate()
  } catch (e) {
    log.error('Encryption migration failed:', e.message)
    // Non-fatal: app still works, data just unencrypted until next launch
  }
}

// autoUpdater listeners registered once here, not inside createWindow
autoUpdater.on('update-available', () => {
  if (mainWindow) mainWindow.webContents.send('update:downloading')
})
autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update:ready')
})

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall()
})

app.whenReady().then(() => {
  log.info('App starting — version', app.getVersion(), 'packaged:', app.isPackaged)
  try {
    initDatabase()
    log.info('Database initialized at', getDbPath())
  } catch (err) {
    log.error('Database init failed:', err.message, err.stack)
    dialog.showErrorBox('Fieldbase — Startup Error', `Failed to open database:\n\n${err.message}\n\nLog: ${log.getPath()}`)
    app.quit()
    return
  }
  try {
    migrateEncryption()
  } catch (err) {
    log.warn('Encryption migration error (non-fatal):', err.message)
  }
  try {
    createWindow()
    log.info('Window created')
  } catch (err) {
    log.error('createWindow failed:', err.message, err.stack)
    dialog.showErrorBox('Fieldbase — Startup Error', `Failed to create window:\n\n${err.message}\n\nLog: ${log.getPath()}`)
    app.quit()
    return
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch(err => {
  log.error('app.whenReady failed:', err.message, err.stack)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  try {
    if (db) {
      db.pragma('wal_checkpoint(TRUNCATE)') // flush WAL to main DB before closing
      db.close()
      log.info('Database closed and WAL checkpointed')
    }
  } catch (err) {
    log.error('Error closing database:', err.message)
  }
})

// ─── Settings ────────────────────────────────────────────────────────────────
function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key)
  if (!row) return fallback
  try { return JSON.parse(decrypt(row.value)) } catch { return fallback }
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const result = {}
  for (const r of rows) {
    try { result[r.key] = JSON.parse(decrypt(r.value)) } catch {}
  }
  return result
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, encrypt(JSON.stringify(value)))
}

ipcMain.handle('settings:get', () => {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const result = {}
  for (const r of rows) {
    try {
      result[r.key] = JSON.parse(decrypt(r.value))
    } catch {
      // skip corrupted rows rather than returning encrypted garbage
    }
  }
  return result
})

ipcMain.handle('settings:set', (_, data) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  const del   = db.prepare('DELETE FROM settings WHERE key = ?')
  const setMany = db.transaction((obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined) del.run(k)
      else upsert.run(k, encrypt(JSON.stringify(v)))
    }
  })
  setMany(data)
  return true
})

// ─── Clients ─────────────────────────────────────────────────────────────────
ipcMain.handle('clients:list', () =>
  db.prepare('SELECT * FROM clients ORDER BY name').all())

ipcMain.handle('clients:get', (_, id) =>
  db.prepare('SELECT * FROM clients WHERE id = ?').get(id))

ipcMain.handle('clients:create', async (_, data) => {
  const r = db.prepare(`INSERT INTO clients (name,email,phone,address,city,state,zip,notes)
    VALUES (@name,@email,@phone,@address,@city,@state,@zip,@notes)`).run(data)
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(r.lastInsertRowid)
  // Sync to cloud
  cloud.cloudInsert('clients', { name: data.name, email: data.email||null, phone: data.phone||null, address: data.address||null, city: data.city||null, state: data.state||null, zip: data.zip||null, notes: data.notes||null }).then(cid => {
    if (cid) db.prepare('UPDATE clients SET cloud_id=? WHERE id=?').run(cid, r.lastInsertRowid)
  })
  return row
})

ipcMain.handle('clients:update', async (_, { id, ...data }) => {
  db.prepare(`UPDATE clients SET name=@name,email=@email,phone=@phone,address=@address,
    city=@city,state=@state,zip=@zip,notes=@notes WHERE id=@id`).run({ id, ...data })
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id)
  if (row.cloud_id) cloud.cloudUpdate('clients', row.cloud_id, { name: data.name, email: data.email||null, phone: data.phone||null, address: data.address||null, city: data.city||null, state: data.state||null, zip: data.zip||null, notes: data.notes||null })
  return row
})

ipcMain.handle('clients:delete', async (_, id) => {
  const row = db.prepare('SELECT cloud_id FROM clients WHERE id=?').get(id)
  db.prepare('DELETE FROM clients WHERE id = ?').run(id)
  if (row?.cloud_id) cloud.cloudDelete('clients', row.cloud_id)
  return true
})

// ─── Jobs ─────────────────────────────────────────────────────────────────────
ipcMain.handle('jobs:list', (_, clientId) => {
  const q = clientId
    ? 'SELECT j.*, c.name as client_name FROM jobs j JOIN clients c ON c.id=j.client_id WHERE j.client_id=? ORDER BY j.created_at DESC'
    : 'SELECT j.*, c.name as client_name FROM jobs j JOIN clients c ON c.id=j.client_id ORDER BY j.created_at DESC'
  return clientId ? db.prepare(q).all(clientId) : db.prepare(q).all()
})

ipcMain.handle('jobs:get', (_, id) =>
  db.prepare('SELECT j.*, c.name as client_name FROM jobs j JOIN clients c ON c.id=j.client_id WHERE j.id=?').get(id))

ipcMain.handle('jobs:create', async (_, data) => {
  const r = db.prepare(`INSERT INTO jobs (client_id,title,site_address,site_city,site_state,site_zip,status,description)
    VALUES (@client_id,@title,@site_address,@site_city,@site_state,@site_zip,@status,@description)`).run(data)
  const row = db.prepare('SELECT j.*, c.name as client_name FROM jobs j JOIN clients c ON c.id=j.client_id WHERE j.id=?').get(r.lastInsertRowid)
  // Resolve client cloud_id for FK
  const clientRow = db.prepare('SELECT cloud_id FROM clients WHERE id=?').get(data.client_id)
  cloud.cloudInsert('jobs', { title: data.title, site_address: data.site_address||null, site_city: data.site_city||null, site_state: data.site_state||null, site_zip: data.site_zip||null, status: data.status||'active', description: data.description||null, client_id: clientRow?.cloud_id||null }).then(cid => {
    if (cid) db.prepare('UPDATE jobs SET cloud_id=? WHERE id=?').run(cid, r.lastInsertRowid)
  })
  return row
})

ipcMain.handle('jobs:update', async (_, { id, ...data }) => {
  const completed_at = data.status === 'complete' && !data.completed_at ? new Date().toISOString() : data.completed_at || null
  db.prepare(`UPDATE jobs SET client_id=@client_id,title=@title,site_address=@site_address,
    site_city=@site_city,site_state=@site_state,site_zip=@site_zip,status=@status,
    description=@description,completed_at=@completed_at WHERE id=@id`).run({ id, ...data, completed_at })
  const row = db.prepare('SELECT j.*, c.name as client_name FROM jobs j JOIN clients c ON c.id=j.client_id WHERE j.id=?').get(id)
  if (row.cloud_id) {
    const clientRow = db.prepare('SELECT cloud_id FROM clients WHERE id=?').get(data.client_id)
    cloud.cloudUpdate('jobs', row.cloud_id, { title: data.title, site_address: data.site_address||null, site_city: data.site_city||null, site_state: data.site_state||null, site_zip: data.site_zip||null, status: data.status||'active', description: data.description||null, client_id: clientRow?.cloud_id||null, completed_at: completed_at||null })
  }
  return row
})

ipcMain.handle('jobs:delete', async (_, id) => {
  const row = db.prepare('SELECT cloud_id FROM jobs WHERE id=?').get(id)
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
  if (row?.cloud_id) cloud.cloudDelete('jobs', row.cloud_id)
  return true
})

// ─── Materials Library ────────────────────────────────────────────────────────
ipcMain.handle('materials:list', () =>
  db.prepare('SELECT * FROM materials_library ORDER BY category, name').all())

ipcMain.handle('materials:create', (_, data) => {
  const r = db.prepare(`INSERT INTO materials_library (name,description,unit,cost_price,markup_pct,category)
    VALUES (@name,@description,@unit,@cost_price,@markup_pct,@category)`).run(data)
  return db.prepare('SELECT * FROM materials_library WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('materials:update', (_, { id, ...data }) => {
  db.prepare(`UPDATE materials_library SET name=@name,description=@description,unit=@unit,
    cost_price=@cost_price,markup_pct=@markup_pct,category=@category WHERE id=@id`).run({ id, ...data })
  return db.prepare('SELECT * FROM materials_library WHERE id = ?').get(id)
})

ipcMain.handle('materials:delete', (_, id) => {
  db.prepare('DELETE FROM materials_library WHERE id = ?').run(id)
  return true
})

// ─── Invoices ─────────────────────────────────────────────────────────────────

function nextInvoiceNumber() {
  const prefix = getSetting('invoice_prefix', 'INV-')
  const startNum = parseInt(getSetting('next_invoice_number', '1001')) || 1001
  const row = db.prepare("SELECT invoice_number FROM invoices WHERE type='invoice' ORDER BY id DESC LIMIT 1").get()
  if (!row) return `${prefix}${String(startNum).padStart(4, '0')}`
  const m = row.invoice_number.match(/(\d+)$/)
  const n = m ? Math.max(parseInt(m[1]) + 1, startNum) : startNum
  return `${prefix}${String(n).padStart(4, '0')}`
}

function nextEstimateNumber() {
  const prefix = getSetting('estimate_prefix', 'EST-')
  const startNum = parseInt(getSetting('next_estimate_number', '1001')) || 1001
  const row = db.prepare("SELECT invoice_number FROM invoices WHERE type='estimate' ORDER BY id DESC LIMIT 1").get()
  if (!row) return `${prefix}${String(startNum).padStart(4, '0')}`
  const m = row.invoice_number.match(/(\d+)$/)
  const n = m ? Math.max(parseInt(m[1]) + 1, startNum) : startNum
  return `${prefix}${String(n).padStart(4, '0')}`
}

ipcMain.handle('invoices:list', (_, filters = {}) => {
  let q = `SELECT i.*, c.name as client_name, j.title as job_title
    FROM invoices i
    LEFT JOIN clients c ON c.id=i.client_id
    LEFT JOIN jobs j ON j.id=i.job_id
    WHERE 1=1`
  const params = []
  if (filters.status) { q += ' AND i.status=?'; params.push(filters.status) }
  if (filters.type) { q += ' AND i.type=?'; params.push(filters.type) }
  if (filters.client_id) { q += ' AND i.client_id=?'; params.push(filters.client_id) }
  q += ' ORDER BY i.created_at DESC'
  return db.prepare(q).all(...params)
})

ipcMain.handle('invoices:get', (_, id) => {
  const inv = db.prepare(`SELECT i.*, c.name as client_name, c.email as client_email,
    c.phone as client_phone, c.address as client_address, c.city as client_city,
    c.state as client_state, c.zip as client_zip,
    j.title as job_title, j.site_address, j.site_city, j.site_state, j.site_zip
    FROM invoices i
    LEFT JOIN clients c ON c.id=i.client_id
    LEFT JOIN jobs j ON j.id=i.job_id
    WHERE i.id=?`).get(id)
  if (!inv) return null
  inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY sort_order,id').all(id)
  return inv
})

ipcMain.handle('invoices:create', async (_, { items = [], ...data }) => {
  const invoice_number = data.type === 'estimate' ? nextEstimateNumber() : nextInvoiceNumber()
  const r = db.prepare(`INSERT INTO invoices
    (invoice_number,client_id,job_id,type,status,issue_date,due_date,tax_rate,discount_pct,notes,terms,is_recurring,recurring_interval,late_fee_pct)
    VALUES (@invoice_number,@client_id,@job_id,@type,@status,@issue_date,@due_date,@tax_rate,@discount_pct,@notes,@terms,@is_recurring,@recurring_interval,@late_fee_pct)`)
    .run({ invoice_number, ...data })
  const id = r.lastInsertRowid
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id,category,description,quantity,unit_price,total,sort_order) VALUES (?,?,?,?,?,?,?)')
  items.forEach((item, i) => insertItem.run(id, item.category, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price, i))
  const row = db.prepare('SELECT * FROM invoices WHERE id=?').get(id)
  // Sync to cloud
  const clientRow = db.prepare('SELECT cloud_id,name FROM clients WHERE id=?').get(data.client_id)
  const cloudData = cloud.mapInvoiceToCloud({ ...data, number: invoice_number, items }, clientRow?.cloud_id)
  cloudData.client_name = clientRow?.name || null
  cloud.cloudInsert('invoices', cloudData).then(cid => {
    if (cid) db.prepare('UPDATE invoices SET cloud_id=? WHERE id=?').run(cid, id)
  })
  return row
})

ipcMain.handle('invoices:update', async (_, { id, items = [], ...data }) => {
  db.prepare(`UPDATE invoices SET client_id=@client_id,job_id=@job_id,type=@type,status=@status,
    issue_date=@issue_date,due_date=@due_date,tax_rate=@tax_rate,discount_pct=@discount_pct,
    notes=@notes,terms=@terms,is_recurring=@is_recurring,recurring_interval=@recurring_interval,
    late_fee_pct=@late_fee_pct WHERE id=@id`).run({ id, ...data })
  db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(id)
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id,category,description,quantity,unit_price,total,sort_order) VALUES (?,?,?,?,?,?,?)')
  items.forEach((item, i) => insertItem.run(id, item.category, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price, i))
  const row = db.prepare('SELECT * FROM invoices WHERE id=?').get(id)
  if (row.cloud_id) {
    const clientRow = db.prepare('SELECT cloud_id,name FROM clients WHERE id=?').get(data.client_id)
    const cloudData = cloud.mapInvoiceToCloud({ ...data, items }, clientRow?.cloud_id)
    cloudData.client_name = clientRow?.name || null
    cloud.cloudUpdate('invoices', row.cloud_id, cloudData)
  }
  return row
})

ipcMain.handle('invoices:delete', async (_, id) => {
  const row = db.prepare('SELECT cloud_id FROM invoices WHERE id=?').get(id)
  db.prepare('DELETE FROM invoices WHERE id=?').run(id)
  if (row?.cloud_id) cloud.cloudDelete('invoices', row.cloud_id)
  return true
})

ipcMain.handle('invoices:convertToInvoice', (_, estimateId) => {
  const est = db.prepare('SELECT * FROM invoices WHERE id=?').get(estimateId)
  if (!est) throw new Error('Estimate not found')
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(estimateId)
  const invoice_number = nextInvoiceNumber()
  const r = db.prepare(`INSERT INTO invoices
    (invoice_number,client_id,job_id,type,status,issue_date,due_date,tax_rate,discount_pct,notes,terms,late_fee_pct)
    VALUES (?,?,?,'invoice','draft',date('now'),date('now','+30 days'),?,?,?,?,?)`)
    .run(invoice_number, est.client_id, est.job_id, est.tax_rate, est.discount_pct, est.notes, est.terms, est.late_fee_pct)
  const id = r.lastInsertRowid
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id,category,description,quantity,unit_price,total,sort_order) VALUES (?,?,?,?,?,?,?)')
  items.forEach((item, i) => insertItem.run(id, item.category, item.description, item.quantity, item.unit_price, item.total, i))
  return db.prepare('SELECT * FROM invoices WHERE id=?').get(id)
})

// ─── PDF Export ───────────────────────────────────────────────────────────────
ipcMain.handle('invoices:exportPdf', async (_, id) => {
  const { savePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `Invoice-${id}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!savePath) return null

  mainWindow.webContents.send('pdf:generate', { invoiceId: id, savePath })
  return savePath
})

ipcMain.handle('pdf:save', async (_, { dataUrl, savePath }) => {
  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, '')
  fs.writeFileSync(savePath, Buffer.from(base64, 'base64'))
  shell.showItemInFolder(savePath)
  return true
})

// ─── License activation ───────────────────────────────────────────────────────
ipcMain.handle('license:getDeviceId', () => {
  return machineIdSync(true)
})

ipcMain.handle('license:activate', async (_, { key }) => {
  const deviceId = machineIdSync(true)
  const baseUrl = process.env.LICENSE_API_URL || 'https://YOUR-PROJECT.vercel.app'

  try {
    const res = await fetch(`${baseUrl}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, deviceId }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.expired) return { success: false, error: data.error, expired: true }
      return { success: false, error: data.error }
    }
    // Store activation locally with encryption
    setSetting('license_activated_at', new Date().toISOString())
    setSetting('license_key', key)
    setSetting('license_plan', data.plan || 'monthly')
    setSetting('license_expires_at', data.expires_at || '')
    return { success: true, plan: data.plan, expires_at: data.expires_at }
  } catch (e) {
    return { success: false, error: 'Cannot connect to license server. Check your internet connection.' }
  }
})

ipcMain.handle('license:check', async () => {
  // Check stored license expiry — if monthly and expires_at is set, verify it
  const expiresAt = getSetting('license_expires_at', '')
  const plan = getSetting('license_plan', 'monthly')
  const activatedAt = getSetting('license_activated_at', '')

  if (!activatedAt) return { valid: false, reason: 'not_activated' }
  if (plan === 'lifetime' || !expiresAt) return { valid: true, plan: 'lifetime' }

  const expiry = new Date(expiresAt)
  const now = new Date()
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return { valid: false, reason: 'expired', expires_at: expiresAt }
  return { valid: true, plan: 'monthly', expires_at: expiresAt, days_left: daysLeft }
})

ipcMain.handle('log:getPath', () => log.getPath())
ipcMain.handle('log:error', (_, msg) => log.error('[Renderer]', msg))
ipcMain.handle('log:openFolder', () => {
  const p = log.getPath()
  if (p) shell.showItemInFolder(p)
})

ipcMain.handle('shell:openExternal', (_, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url)
  }
})

// ─── Auth: Email OTP ─────────────────────────────────────────────────────────
// ─── Auth: Sign Up ────────────────────────────────────────────────────────────
ipcMain.handle('auth:signup', async (_, { email, password, name }) => {
  const result = await cloud.signUp(email, password, name)
  if (result.error) return { success: false, error: result.error }

  // Store session & refresh token so desktop stays logged in
  const session = result.session || result
  setSetting('cloud_refresh_token', session.refresh_token || '')
  setSetting('cloud_user_id', session.user?.id || '')
  setSetting('cloud_email', email)

  // Store local account profile
  const accounts = JSON.parse(getSetting('accounts', '[]'))
  const existing = accounts.find(a => a.email.toLowerCase() === email.toLowerCase())
  if (!existing) {
    accounts.push({ name, email, cloud_id: session.user?.id, created_at: new Date().toISOString() })
    setSetting('accounts', JSON.stringify(accounts))
  }

  return { success: true, account: { name, email, cloud_id: session.user?.id } }
})

// ─── Auth: Sign In ────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_, { email, password }) => {
  const result = await cloud.signIn(email, password)
  if (result.error) return { success: false, error: result.error }

  const session = result.session || result
  setSetting('cloud_refresh_token', session.refresh_token || '')
  setSetting('cloud_user_id', session.user?.id || '')
  setSetting('cloud_email', email)

  // Fetch profile name from Supabase accounts table
  let name = email.split('@')[0]
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = cloud
    const res = await fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${session.user.id}&select=name`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${session.access_token}` }
    })
    const rows = await res.json()
    if (rows[0]?.name) name = rows[0].name
  } catch {}

  // Update local accounts list
  const accounts = JSON.parse(getSetting('accounts', '[]'))
  const existing = accounts.find(a => a.email.toLowerCase() === email.toLowerCase())
  if (!existing) {
    accounts.push({ name, email, cloud_id: session.user?.id, created_at: new Date().toISOString() })
    setSetting('accounts', JSON.stringify(accounts))
  }

  return { success: true, account: { name, email, cloud_id: session.user?.id } }
})

// ─── Auth: Session restore on startup ────────────────────────────────────────
ipcMain.handle('auth:restoreSession', async () => {
  const refreshToken = getSetting('cloud_refresh_token', '')
  if (!refreshToken) return { restored: false }
  const session = await cloud.refreshSession(refreshToken)
  if (!session) { return { restored: false } }
  setSetting('cloud_refresh_token', session.refresh_token || '')
  const email = getSetting('cloud_email', '')
  let name = email.split('@')[0]
  const accounts = JSON.parse(getSetting('accounts', '[]'))
  const acc = accounts.find(a => a.email.toLowerCase() === email.toLowerCase())
  if (acc?.name) name = acc.name
  return { restored: true, account: { name, email, cloud_id: session.user?.id } }
})

// ─── Auth: Sign Out ───────────────────────────────────────────────────────────
ipcMain.handle('auth:logout', async () => {
  await cloud.signOut()
  setSetting('cloud_refresh_token', '')
  setSetting('cloud_user_id', '')
  setSetting('cloud_email', '')
  return { success: true }
})

// ─── Auth: Google OAuth ───────────────────────────────────────────────────────
let _googleAuthServer = null // track active server to prevent duplicates

ipcMain.handle('auth:google', async () => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = cloud

  if (_googleAuthServer) { try { _googleAuthServer.close() } catch {} _googleAuthServer = null }

  let resolveTokens, rejectTokens
  const tokenPromise = new Promise((res, rej) => { resolveTokens = res; rejectTokens = rej })

  // Two-step local server: root page reads the hash fragment (tokens live there),
  // then forwards them as query params to /callback which the main handler reads.
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')

    if (url.pathname === '/callback') {
      const access_token = url.searchParams.get('access_token')
      const refresh_token = url.searchParams.get('refresh_token')
      const error = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a1628;color:#dce8f0">
        <div style="font-size:28px;font-weight:800;margin-bottom:16px"><span style="color:#FF6B35">Field</span><span style="font-weight:300">base</span></div>
        <div style="font-size:48px;margin-bottom:16px">${error ? '✗' : '✓'}</div>
        <h2 style="color:${error ? '#ef4444' : '#FF6B35'}">${error ? 'Sign in cancelled' : 'Signed in with Google!'}</h2>
        <p style="color:#8aadcc">You can close this tab and return to the app.</p>
        <script>window.close()</script>
      </body></html>`)
      server.close()
      _googleAuthServer = null
      if (error) rejectTokens(new Error(error))
      else resolveTokens({ access_token, refresh_token })
      return
    }

    // Root: reads hash fragment and forwards tokens to /callback as query params
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<html><head><title>Fieldbase Sign In</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a1628;color:#dce8f0">
      <div style="font-size:28px;font-weight:800;margin-bottom:16px"><span style="color:#FF6B35">Field</span><span style="font-weight:300">base</span></div>
      <p style="color:#8aadcc">Completing sign in…</p>
      <script>
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token') || ''
        const refresh_token = params.get('refresh_token') || ''
        const error = params.get('error') || params.get('error_description') || ''
        window.location.href = '/callback?' + new URLSearchParams({ access_token, refresh_token, error }).toString()
      </script>
    </body></html>`)
  })

  _googleAuthServer = server
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', err => err ? reject(err) : resolve()))
  const port = server.address().port
  const redirectTo = `http://127.0.0.1:${port}`

  // Supabase handles the Google OAuth exchange — no client credentials needed in the app
  shell.openExternal(`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`)

  try {
    const { access_token, refresh_token } = await Promise.race([
      tokenPromise,
      new Promise((_, rej) => setTimeout(() => {
        try { server.close() } catch {} _googleAuthServer = null
        rej(new Error('timeout'))
      }, 120000))
    ])

    if (!access_token) return { error: 'No access token received.' }

    cloud.setSession({ access_token, refresh_token, user: null })

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${access_token}` }
    })
    const userData = await userRes.json()
    if (!userData?.id) return { error: 'Could not retrieve user info from Google.' }

    cloud.setSession({ access_token, refresh_token, user: userData })
    setSetting('cloud_refresh_token', refresh_token || '')
    setSetting('cloud_user_id', userData.id || '')
    setSetting('cloud_email', userData.email || '')

    const name = userData.user_metadata?.full_name || userData.user_metadata?.name || userData.email?.split('@')[0] || 'Google User'
    const accounts = JSON.parse(getSetting('accounts', '[]'))
    if (!accounts.find(a => a.email?.toLowerCase() === userData.email?.toLowerCase())) {
      accounts.push({ name, email: userData.email, cloud_id: userData.id, provider: 'google', created_at: new Date().toISOString() })
      setSetting('accounts', JSON.stringify(accounts))
    }

    return { success: true, account: { name, email: userData.email, cloud_id: userData.id, provider: 'google' } }
  } catch (e) {
    try { server.close() } catch {}
    _googleAuthServer = null
    return { error: e.message === 'timeout' ? 'Sign in timed out. Please try again.' : e.message }
  }
})

// ─── Mobile QR auth ──────────────────────────────────────────────────────────
ipcMain.handle('mobile:generateToken', async (_, { account }) => {
  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
  const url = `https://fieldbase-mobile.vercel.app/?token=${token}`

  // Build a data snapshot so the mobile app shows real content
  const snapshot = { ts: Date.now(), invoices_count: 0, clients_count: 0, active_jobs_count: 0, recent_invoices: [], recent_jobs: [] }
  try {
    snapshot.invoices_count = db.prepare('SELECT COUNT(*) as n FROM invoices').get()?.n || 0
    snapshot.clients_count = db.prepare('SELECT COUNT(*) as n FROM clients').get()?.n || 0
    snapshot.active_jobs_count = db.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='active'").get()?.n || 0
    const rawInv = db.prepare("SELECT id, number, client_name, date, status, items, tax_rate, discount_pct FROM invoices ORDER BY created_at DESC LIMIT 10").all()
    snapshot.recent_invoices = rawInv.map(inv => {
      let total = 0
      try {
        const items = JSON.parse(inv.items || '[]')
        const sub = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
        const disc = sub * (Number(inv.discount_pct) || 0) / 100
        const taxable = sub - disc
        total = taxable + taxable * (Number(inv.tax_rate) || 0) / 100
      } catch {}
      return { id: inv.id, number: inv.number, client_name: inv.client_name, date: inv.date, status: inv.status, total }
    })
    snapshot.recent_jobs = db.prepare("SELECT j.id, j.title, j.status, c.name as client_name, j.site_address, j.site_city FROM jobs j LEFT JOIN clients c ON c.id=j.client_id WHERE j.status='active' ORDER BY j.created_at DESC LIMIT 10").all()
  } catch (e) {
    log.error('Snapshot build failed:', e.message)
  }

  // Generate QR first — don't let Supabase failure block this
  const dataUrl = await QRCode.toDataURL(url, {
    width: 280, margin: 2,
    color: { dark: '#0a1628', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })

  // Push token via REST API directly — more reliable than the JS client in Node.js
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('./supabase')
    const res = await fetch(`${SUPABASE_URL}/rest/v1/mobile_tokens`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        token,
        account_data: {
          email: account.email,
          name: account.name || '',
          business: getSetting('business_name', '') || '',
          picture: account.picture || null,
          snapshot,
        },
        expires_at: expiresAt,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      log.error('Mobile token insert failed:', res.status, err)
    }
  } catch (e) {
    log.error('Mobile token push failed:', e.message)
  }

  return { dataUrl, token, expiresAt, url }
})

ipcMain.handle('mobile:consumeToken', async (_, { token }) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('./supabase')
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/mobile_tokens?token=eq.${encodeURIComponent(token)}&select=*`, { headers })
  const rows = await res.json()
  if (!Array.isArray(rows) || !rows.length) return { error: 'Invalid token' }
  const row = rows[0]
  if (new Date(row.expires_at) < new Date()) return { error: 'Token expired' }
  if (row.used_at) return { error: 'Token already used' }

  await fetch(`${SUPABASE_URL}/rest/v1/mobile_tokens?token=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  })
  return { account: row.account_data }
})

// ─── Deposits ────────────────────────────────────────────────────────────────
ipcMain.handle('deposits:list', (_, invoiceId) =>
  db.prepare('SELECT * FROM invoice_deposits WHERE invoice_id=? ORDER BY paid_at').all(invoiceId))

ipcMain.handle('deposits:create', (_, data) => {
  const r = db.prepare('INSERT INTO invoice_deposits (invoice_id,amount,note,paid_at) VALUES (@invoice_id,@amount,@note,@paid_at)').run(data)
  return db.prepare('SELECT * FROM invoice_deposits WHERE id=?').get(r.lastInsertRowid)
})

ipcMain.handle('deposits:delete', (_, id) => {
  db.prepare('DELETE FROM invoice_deposits WHERE id=?').run(id)
  return true
})

// ─── Photos ───────────────────────────────────────────────────────────────────
ipcMain.handle('photos:list', (_, jobId) =>
  db.prepare('SELECT id,job_id,filename,caption,uploaded_at FROM job_photos WHERE job_id=? ORDER BY uploaded_at').all(jobId))

ipcMain.handle('photos:get', (_, id) =>
  db.prepare('SELECT * FROM job_photos WHERE id=?').get(id))

ipcMain.handle('photos:upload', async (_, { jobId }) => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Photos',
    filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','webp','heic'] }],
    properties: ['openFile', 'multiSelections'],
  })
  if (!filePaths?.length) return []
  const results = []
  for (const fp of filePaths) {
    const data = fs.readFileSync(fp).toString('base64')
    const ext = path.extname(fp).slice(1)
    const r = db.prepare('INSERT INTO job_photos (job_id,filename,data,caption) VALUES (?,?,?,?)')
      .run(jobId, path.basename(fp), `data:image/${ext};base64,${data}`, '')
    results.push(db.prepare('SELECT id,job_id,filename,caption,uploaded_at FROM job_photos WHERE id=?').get(r.lastInsertRowid))
  }
  return results
})

ipcMain.handle('photos:updateCaption', (_, { id, caption }) => {
  db.prepare('UPDATE job_photos SET caption=? WHERE id=?').run(caption, id)
  return true
})

ipcMain.handle('photos:delete', (_, id) => {
  db.prepare('DELETE FROM job_photos WHERE id=?').run(id)
  return true
})

// ─── Change Orders ────────────────────────────────────────────────────────────
ipcMain.handle('changeOrders:list', (_, jobId) =>
  db.prepare('SELECT * FROM change_orders WHERE job_id=? ORDER BY created_at').all(jobId))

ipcMain.handle('changeOrders:create', (_, data) => {
  const r = db.prepare('INSERT INTO change_orders (job_id,invoice_id,title,description,amount,status) VALUES (@job_id,@invoice_id,@title,@description,@amount,@status)').run(data)
  return db.prepare('SELECT * FROM change_orders WHERE id=?').get(r.lastInsertRowid)
})

ipcMain.handle('changeOrders:update', (_, { id, ...data }) => {
  db.prepare('UPDATE change_orders SET title=@title,description=@description,amount=@amount,status=@status WHERE id=@id').run({ id, ...data })
  return db.prepare('SELECT * FROM change_orders WHERE id=?').get(id)
})

ipcMain.handle('changeOrders:delete', (_, id) => {
  db.prepare('DELETE FROM change_orders WHERE id=?').run(id)
  return true
})

// ─── Signatures ───────────────────────────────────────────────────────────────
ipcMain.handle('signatures:get', (_, invoiceId) =>
  db.prepare('SELECT * FROM signatures WHERE invoice_id=?').get(invoiceId))

ipcMain.handle('signatures:save', (_, { invoice_id, signer_name, data }) => {
  db.prepare('DELETE FROM signatures WHERE invoice_id=?').run(invoice_id)
  const r = db.prepare('INSERT INTO signatures (invoice_id,signer_name,data) VALUES (?,?,?)').run(invoice_id, signer_name, data)
  return db.prepare('SELECT * FROM signatures WHERE id=?').get(r.lastInsertRowid)
})

// ─── Email sending ────────────────────────────────────────────────────────────
ipcMain.handle('email:sendInvoice', async (_, { invoiceId, htmlContent }) => {
  const settings = getAllSettings()
  const RESEND_API_KEY = process.env.RESEND_API_KEY || settings.resend_api_key
  if (!RESEND_API_KEY) return { success: false, error: 'Resend API key not configured.' }

  const inv = db.prepare(`SELECT i.*, c.name as client_name, c.email as client_email
    FROM invoices i LEFT JOIN clients c ON c.id=i.client_id WHERE i.id=?`).get(invoiceId)
  if (!inv?.client_email) return { success: false, error: 'Client has no email address.' }

  const fromName = settings.email_from_name || settings.business_name || 'Fieldbase'
  const subjectTemplate = settings.email_subject_template || '{type} {invoice_number} from {business_name}'
  const subject = subjectTemplate
    .replace('{invoice_number}', inv.invoice_number)
    .replace('{business_name}', settings.business_name || 'Your Contractor')
    .replace('{type}', inv.type === 'estimate' ? 'Estimate' : 'Invoice')

  // Append email footer if set
  let finalHtml = htmlContent
  if (settings.email_footer) {
    finalHtml += `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;font-family:Arial,sans-serif;">${settings.email_footer}</div>`
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <onboarding@resend.dev>`,
        to: inv.client_email,
        subject,
        html: finalHtml,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.message || 'Send failed.' }
    db.prepare("UPDATE invoices SET sent_at=datetime('now'), status=CASE WHEN status='draft' THEN 'sent' ELSE status END WHERE id=?").run(invoiceId)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ─── Test email ──────────────────────────────────────────────────────────────
ipcMain.handle('email:sendTest', async () => {
  const settings = getAllSettings()
  const RESEND_API_KEY = process.env.RESEND_API_KEY || settings.resend_api_key
  if (!RESEND_API_KEY) return { success: false, error: 'Resend API key not configured.' }
  if (!settings.email) return { success: false, error: 'Business email not set in settings.' }

  const fromName = settings.email_from_name || settings.business_name || 'Fieldbase'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <onboarding@resend.dev>`,
        to: settings.email,
        subject: 'Fieldbase — Email Test',
        html: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:500px"><h2>✅ Email is working!</h2><p>Your Fieldbase email settings are configured correctly. Invoices sent from <strong>${settings.business_name || 'your business'}</strong> will arrive like this.</p></div>`,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.message || 'Send failed.' }
    return { success: true, to: settings.email }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ─── Payment reminder emails ──────────────────────────────────────────────────
ipcMain.handle('email:sendReminders', async () => {
  const settings = getAllSettings()
  const RESEND_API_KEY = process.env.RESEND_API_KEY || settings.resend_api_key
  if (!RESEND_API_KEY) return { success: false, error: 'Resend API key not configured in Settings → Email.' }

  // Find overdue invoices that have a client email and haven't been reminded today
  const overdue = db.prepare(`
    SELECT i.*, c.name as client_name, c.email as client_email
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    WHERE i.type='invoice'
      AND i.status IN ('sent','overdue')
      AND i.due_date < date('now')
      AND c.email IS NOT NULL
      AND c.email != ''
      AND (i.last_reminder_at IS NULL OR i.last_reminder_at < date('now'))
  `).all()

  if (overdue.length === 0) return { success: true, sent: 0, message: 'No overdue invoices to remind.' }

  const fromName = settings.email_from_name || settings.business_name || 'Fieldbase'
  const businessName = settings.business_name || 'Your Contractor'
  const sym = settings.currency_symbol || '$'
  const sent = []
  const failed = []

  for (const inv of overdue) {
    // Calculate total
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id)
    const subtotal = items.reduce((s, it) => s + (it.total || 0), 0)
    const discount = subtotal * ((inv.discount_pct || 0) / 100)
    const taxable = subtotal - discount
    const total = taxable * (1 + (inv.tax_rate || 0) / 100)
    const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date)) / (1000 * 60 * 60 * 24))

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;color:#1f2937">
        <div style="background:#ef4444;padding:4px 0"></div>
        <div style="padding:32px">
          <h2 style="margin:0 0 8px;font-size:20px">Payment Reminder</h2>
          <p style="color:#6b7280;margin:0 0 24px">This is a friendly reminder that the following invoice is <strong style="color:#ef4444">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</strong>.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="color:#6b7280">Invoice</span><strong>${inv.invoice_number}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="color:#6b7280">Due Date</span><strong>${inv.due_date}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px">
              <span style="color:#6b7280">Amount Due</span><strong style="font-size:18px">${sym}${total.toFixed(2)}</strong>
            </div>
          </div>
          <p style="color:#6b7280">Please process this payment at your earliest convenience. If you have already sent payment, please disregard this notice.</p>
          <p style="margin-top:24px">Thank you,<br><strong>${businessName}</strong></p>
        </div>
      </div>
    `

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <onboarding@resend.dev>`,
          to: inv.client_email,
          subject: `Payment Reminder: ${inv.invoice_number} — ${daysOverdue} days overdue`,
          html,
        }),
      })
      if (res.ok) {
        db.prepare("UPDATE invoices SET last_reminder_at=date('now'), status='overdue' WHERE id=?").run(inv.id)
        sent.push(inv.invoice_number)
      } else {
        const err = await res.json()
        failed.push({ invoice: inv.invoice_number, error: err.message })
      }
    } catch (e) {
      failed.push({ invoice: inv.invoice_number, error: e.message })
    }
  }

  return { success: true, sent: sent.length, failed: failed.length, invoices: sent }
})

// ─── Aging report ─────────────────────────────────────────────────────────────
ipcMain.handle('reports:aging', () => {
  // Auto-mark overdue if setting is enabled
  const autoOverdue = getSetting('auto_mark_overdue', '1')
  if (autoOverdue === '1' || autoOverdue === true || autoOverdue === 1) {
    db.prepare(`
      UPDATE invoices SET status='overdue'
      WHERE type='invoice' AND status='sent'
        AND due_date IS NOT NULL AND due_date < date('now')
    `).run()
  }

  return db.prepare(`
    SELECT i.*, c.name as client_name,
      CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
    FROM invoices i
    LEFT JOIN clients c ON c.id=i.client_id
    WHERE i.type='invoice' AND i.status IN ('sent','overdue')
    ORDER BY i.due_date ASC
  `).all()
})

// ─── Expenses ─────────────────────────────────────────────────────────────────
ipcMain.handle('expenses:list', (_, filters = {}) => {
  let q = `SELECT e.*, j.title as job_title, c.name as client_name
    FROM expenses e
    LEFT JOIN jobs j ON j.id=e.job_id
    LEFT JOIN clients c ON c.id=e.client_id
    WHERE 1=1`
  const params = []
  if (filters.job_id) { q += ' AND e.job_id=?'; params.push(filters.job_id) }
  if (filters.category) { q += ' AND e.category=?'; params.push(filters.category) }
  if (filters.month) { q += " AND strftime('%Y-%m', e.date)=?"; params.push(filters.month) }
  q += ' ORDER BY e.date DESC'
  return db.prepare(q).all(...params)
})

ipcMain.handle('expenses:create', async (_, data) => {
  const r = db.prepare(`INSERT INTO expenses
    (date,vendor,description,amount,tax_amount,category,job_id,client_id,receipt_image,notes,ai_scanned)
    VALUES (@date,@vendor,@description,@amount,@tax_amount,@category,@job_id,@client_id,@receipt_image,@notes,@ai_scanned)`)
    .run(data)
  const row = db.prepare('SELECT * FROM expenses WHERE id=?').get(r.lastInsertRowid)
  const jobCloudId = data.job_id ? db.prepare('SELECT cloud_id FROM jobs WHERE id=?').get(data.job_id)?.cloud_id : null
  const clientCloudId = data.client_id ? db.prepare('SELECT cloud_id FROM clients WHERE id=?').get(data.client_id)?.cloud_id : null
  const cloudId = await cloud.cloudInsert('expenses', {
    date: data.date, vendor: data.vendor, description: data.description,
    amount: Number(data.amount) || 0, tax_amount: Number(data.tax_amount) || 0,
    category: data.category, notes: data.notes,
    job_id: jobCloudId || null, client_id: clientCloudId || null,
  }).catch(() => null)
  if (cloudId) db.prepare('UPDATE expenses SET cloud_id=? WHERE id=?').run(cloudId, row.id)
  return row
})

ipcMain.handle('expenses:update', async (_, data) => {
  db.prepare(`UPDATE expenses SET
    date=@date, vendor=@vendor, description=@description, amount=@amount,
    tax_amount=@tax_amount, category=@category, job_id=@job_id,
    client_id=@client_id, notes=@notes WHERE id=@id`).run(data)
  const row = db.prepare('SELECT * FROM expenses WHERE id=?').get(data.id)
  if (row?.cloud_id) {
    const jobCloudId = data.job_id ? db.prepare('SELECT cloud_id FROM jobs WHERE id=?').get(data.job_id)?.cloud_id : null
    const clientCloudId = data.client_id ? db.prepare('SELECT cloud_id FROM clients WHERE id=?').get(data.client_id)?.cloud_id : null
    cloud.cloudUpdate('expenses', row.cloud_id, {
      date: data.date, vendor: data.vendor, description: data.description,
      amount: Number(data.amount) || 0, tax_amount: Number(data.tax_amount) || 0,
      category: data.category, notes: data.notes,
      job_id: jobCloudId || null, client_id: clientCloudId || null,
    }).catch(() => {})
  }
  return row
})

ipcMain.handle('expenses:delete', async (_, id) => {
  const row = db.prepare('SELECT cloud_id FROM expenses WHERE id=?').get(id)
  db.prepare('DELETE FROM expenses WHERE id=?').run(id)
  if (row?.cloud_id) cloud.cloudDelete('expenses', row.cloud_id).catch(() => {})
  return true
})

ipcMain.handle('expenses:scanReceipt', async (_, { imagePath, imageData }) => {
  const s = getAllSettings()
  const apiKey = process.env.ANTHROPIC_API_KEY || s.anthropic_api_key
  if (!apiKey) return { success: false, error: 'No AI API key configured. Add your Anthropic API key in Settings → AI.' }

  try {
    // Read image file if path provided
    let base64, mediaType
    if (imagePath) {
      const buf = fs.readFileSync(imagePath)
      base64 = buf.toString('base64')
      const ext = imagePath.split('.').pop().toLowerCase()
      mediaType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    } else if (imageData) {
      const match = imageData.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) throw new Error('Invalid image data format')
      mediaType = match[1]
      base64 = match[2]
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: `Extract the expense data from this receipt and return ONLY a JSON object with these fields:
{
  "vendor": "store or company name",
  "date": "YYYY-MM-DD format",
  "amount": total amount as a number (no currency symbol),
  "tax_amount": tax amount as a number (0 if not shown),
  "description": "brief description of what was purchased",
  "category": one of: "Materials", "Fuel", "Tools", "Subcontractors", "Insurance", "Meals", "Office", "Other"
}
Return only the JSON, no explanation.` }
          ]
        }]
      })
    })

    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error?.message || 'AI scan failed' }

    const text = data.content[0].text.trim()
    const json = JSON.parse(text.replace(/^```json?\n?/, '').replace(/\n?```$/, ''))
    return { success: true, data: json }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Pick receipt image file
ipcMain.handle('expenses:pickReceipt', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','webp','heic'] }],
  })
  if (!filePaths[0]) return null
  const buf = fs.readFileSync(filePaths[0])
  const ext = filePaths[0].split('.').pop().toLowerCase()
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  return { path: filePaths[0], dataUrl: `data:${mime};base64,${buf.toString('base64')}` }
})

// ─── Payments ─────────────────────────────────────────────────────────────────
ipcMain.handle('payments:list', (_, invoiceId) =>
  db.prepare('SELECT * FROM payments WHERE invoice_id=? ORDER BY paid_at DESC').all(invoiceId))

ipcMain.handle('payments:create', async (_, data) => {
  const r = db.prepare(`INSERT INTO payments (invoice_id,amount,method,note,paid_at)
    VALUES (@invoice_id,@amount,@method,@note,@paid_at)`).run(data)
  const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE invoice_id=?').get(data.invoice_id).total
  const invRow = db.prepare('SELECT tax_rate, discount_pct, cloud_id FROM invoices WHERE id=?').get(data.invoice_id)
  const items = db.prepare('SELECT quantity, unit_price FROM invoice_items WHERE invoice_id=?').all(data.invoice_id)
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const discount = subtotal * ((invRow?.discount_pct || 0) / 100)
  const invoiceTotal = (subtotal - discount) * (1 + (invRow?.tax_rate || 0) / 100)
  if (Math.round(totalPaid * 100) >= Math.round(invoiceTotal * 100)) {
    db.prepare("UPDATE invoices SET status='paid', paid_at=datetime('now') WHERE id=?").run(data.invoice_id)
    if (invRow?.cloud_id) cloud.cloudUpdate('invoices', invRow.cloud_id, { status: 'paid' }).catch(() => {})
  }
  const payment = db.prepare('SELECT * FROM payments WHERE id=?').get(r.lastInsertRowid)
  const cloudId = await cloud.cloudInsert('payments', {
    invoice_id: invRow?.cloud_id || null,
    amount: Number(data.amount) || 0,
    method: data.method || null,
    note: data.note || null,
    paid_at: data.paid_at || new Date().toISOString(),
  }).catch(() => null)
  if (cloudId) db.prepare('UPDATE payments SET cloud_id=? WHERE id=?').run(cloudId, payment.id)
  return payment
})

ipcMain.handle('payments:delete', async (_, id) => {
  const p = db.prepare('SELECT * FROM payments WHERE id=?').get(id)
  db.prepare('DELETE FROM payments WHERE id=?').run(id)
  if (p?.cloud_id) cloud.cloudDelete('payments', p.cloud_id).catch(() => {})
  if (p) {
    const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE invoice_id=?').get(p.invoice_id).total
    if (totalPaid === 0) {
      db.prepare("UPDATE invoices SET status='sent', paid_at=NULL WHERE id=? AND status='paid'").run(p.invoice_id)
      const inv = db.prepare('SELECT cloud_id FROM invoices WHERE id=?').get(p.invoice_id)
      if (inv?.cloud_id) cloud.cloudUpdate('invoices', inv.cloud_id, { status: 'sent' }).catch(() => {})
    }
  }
  return true
})

// ─── Revenue reports ──────────────────────────────────────────────────────────
ipcMain.handle('reports:revenue', (_, { year, month } = {}) => {
  const currentYear = year || new Date().getFullYear()

  // Monthly revenue for the year (from payments)
  const monthly = db.prepare(`
    SELECT strftime('%m', paid_at) as month,
      SUM(amount) as revenue,
      COUNT(DISTINCT invoice_id) as invoice_count
    FROM payments
    WHERE strftime('%Y', paid_at) = ?
    GROUP BY month ORDER BY month
  `).all(String(currentYear))

  // Total revenue all time
  const allTime = db.prepare('SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM payments').get()

  // Revenue this month
  const thisMonth = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM payments
    WHERE strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')
  `).get()

  // Revenue this year
  const thisYear = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM payments
    WHERE strftime('%Y', paid_at) = ?
  `).get(String(currentYear))

  // Expenses this year
  const expensesYear = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM expenses
    WHERE strftime('%Y', date) = ?
  `).get(String(currentYear))

  // Top clients by revenue
  const topClients = db.prepare(`
    SELECT c.name, COALESCE(SUM(p.amount),0) as revenue, COUNT(DISTINCT p.invoice_id) as invoices
    FROM payments p
    JOIN invoices i ON i.id=p.invoice_id
    LEFT JOIN clients c ON c.id=i.client_id
    GROUP BY i.client_id ORDER BY revenue DESC LIMIT 5
  `).all()

  // Revenue by payment method
  const byMethod = db.prepare(`
    SELECT method, SUM(amount) as total, COUNT(*) as count
    FROM payments GROUP BY method ORDER BY total DESC
  `).all()

  // Expenses by category this year
  const expensesByCategory = db.prepare(`
    SELECT category, SUM(amount) as total FROM expenses
    WHERE strftime('%Y', date) = ?
    GROUP BY category ORDER BY total DESC
  `).all(String(currentYear))

  return {
    monthly, allTime, thisMonth, thisYear,
    expensesYear, topClients, byMethod, expensesByCategory,
    profit: (thisYear?.total || 0) - (expensesYear?.total || 0),
    currentYear,
  }
})

// ─── Schedules ────────────────────────────────────────────────────────────────
ipcMain.handle('schedules:list', (_, { month, year } = {}) => {
  if (month != null && year != null) {
    const from = `${year}-${String(month).padStart(2,'0')}-01`
    const to = `${year}-${String(month).padStart(2,'0')}-31`
    return db.prepare(`
      SELECT s.*, c.name as client_name, j.title as job_title
      FROM schedules s
      LEFT JOIN clients c ON c.id = s.client_id
      LEFT JOIN jobs j ON j.id = s.job_id
      WHERE substr(s.start_datetime,1,10) BETWEEN ? AND ?
      ORDER BY s.start_datetime ASC
    `).all(from, to)
  }
  return db.prepare(`
    SELECT s.*, c.name as client_name, j.title as job_title
    FROM schedules s
    LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN jobs j ON j.id = s.job_id
    ORDER BY s.start_datetime ASC
  `).all()
})

ipcMain.handle('schedules:create', async (_, data) => {
  const payload = {
    title: data.title,
    client_id: data.client_id || null,
    job_id: data.job_id || null,
    start_datetime: data.start_datetime,
    end_datetime: data.end_datetime || null,
    all_day: data.all_day ? 1 : 0,
    notes: data.notes || null,
    status: data.status || 'scheduled',
    color: data.color || '#4f7ef8',
  }
  const r = db.prepare(`
    INSERT INTO schedules (title, client_id, job_id, start_datetime, end_datetime, all_day, notes, status, color)
    VALUES (@title, @client_id, @job_id, @start_datetime, @end_datetime, @all_day, @notes, @status, @color)
  `).run(payload)
  const row = db.prepare('SELECT * FROM schedules WHERE id=?').get(r.lastInsertRowid)
  const jobCloudId = data.job_id ? db.prepare('SELECT cloud_id FROM jobs WHERE id=?').get(data.job_id)?.cloud_id : null
  const clientCloudId = data.client_id ? db.prepare('SELECT cloud_id FROM clients WHERE id=?').get(data.client_id)?.cloud_id : null
  const cloudId = await cloud.cloudInsert('schedules', {
    title: data.title, start_datetime: data.start_datetime, end_datetime: data.end_datetime || null,
    all_day: !!data.all_day, notes: data.notes || null, status: data.status || 'scheduled',
    color: data.color || '#4f7ef8', job_id: jobCloudId || null, client_id: clientCloudId || null,
  }).catch(() => null)
  if (cloudId) db.prepare('UPDATE schedules SET cloud_id=? WHERE id=?').run(cloudId, row.id)
  return row
})

ipcMain.handle('schedules:update', async (_, data) => {
  const payload = {
    id: data.id, title: data.title,
    client_id: data.client_id || null, job_id: data.job_id || null,
    start_datetime: data.start_datetime, end_datetime: data.end_datetime || null,
    all_day: data.all_day ? 1 : 0, notes: data.notes || null,
    status: data.status || 'scheduled', color: data.color || '#4f7ef8',
  }
  db.prepare(`
    UPDATE schedules SET title=@title, client_id=@client_id, job_id=@job_id,
      start_datetime=@start_datetime, end_datetime=@end_datetime, all_day=@all_day,
      notes=@notes, status=@status, color=@color
    WHERE id=@id
  `).run(payload)
  const row = db.prepare('SELECT * FROM schedules WHERE id=?').get(data.id)
  if (row?.cloud_id) {
    const jobCloudId = data.job_id ? db.prepare('SELECT cloud_id FROM jobs WHERE id=?').get(data.job_id)?.cloud_id : null
    const clientCloudId = data.client_id ? db.prepare('SELECT cloud_id FROM clients WHERE id=?').get(data.client_id)?.cloud_id : null
    cloud.cloudUpdate('schedules', row.cloud_id, {
      title: data.title, start_datetime: data.start_datetime, end_datetime: data.end_datetime || null,
      all_day: !!data.all_day, notes: data.notes || null, status: data.status || 'scheduled',
      color: data.color || '#4f7ef8', job_id: jobCloudId || null, client_id: clientCloudId || null,
    }).catch(() => {})
  }
  return row
})

ipcMain.handle('schedules:delete', async (_, id) => {
  const row = db.prepare('SELECT cloud_id FROM schedules WHERE id=?').get(id)
  db.prepare('DELETE FROM schedules WHERE id=?').run(id)
  if (row?.cloud_id) cloud.cloudDelete('schedules', row.cloud_id).catch(() => {})
  return true
})

// ─── Business Tier: Team management ──────────────────────────────────────────

ipcMain.handle('team:get', async () => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, getSession } = cloud
  const session = cloud.getSession ? cloud.getSession() : null
  if (!cloud.accountId()) return null
  try {
    // Get team where current user is owner
    const res = await fetch(`${SUPABASE_URL}/rest/v1/teams?owner_id=eq.${cloud.accountId()}&select=*`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cloud.getSession?.()?.access_token || ''}` }
    })
    const rows = await res.json()
    if (!rows?.length) return null
    const team = rows[0]
    // Get members
    const mRes = await fetch(`${SUPABASE_URL}/rest/v1/team_members?team_id=eq.${team.id}&select=*&order=role.asc,name.asc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cloud.getSession?.()?.access_token || ''}` }
    })
    team.members = await mRes.json() || []
    return team
  } catch (e) {
    log.error('team:get error', e.message)
    return null
  }
})

ipcMain.handle('team:create', async (_, { name }) => {
  if (!cloud.accountId()) return { error: 'Not signed in' }
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = cloud
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cloud.getSession?.()?.access_token || ''}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
      method: 'POST', headers,
      body: JSON.stringify({ name, owner_id: cloud.accountId() })
    })
    const rows = await res.json()
    const team = Array.isArray(rows) ? rows[0] : rows
    if (!team?.id) return { error: 'Failed to create team' }
    // Add owner as a member
    const ownerEmail = getSetting('cloud_email', '')
    const accounts = JSON.parse(getSetting('accounts', '[]'))
    const ownerName = accounts.find(a => a.cloud_id === cloud.accountId())?.name || ''
    await fetch(`${SUPABASE_URL}/rest/v1/team_members`, {
      method: 'POST', headers,
      body: JSON.stringify({ team_id: team.id, user_id: cloud.accountId(), email: ownerEmail, name: ownerName, role: 'owner', status: 'active' })
    })
    return { team }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('team:invite', async (_, { teamId, email, role }) => {
  if (!cloud.accountId()) return { error: 'Not signed in' }
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = cloud
  const token = require('crypto').randomBytes(24).toString('hex')
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cloud.getSession?.()?.access_token || ''}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_invitations`, {
      method: 'POST', headers,
      body: JSON.stringify({ team_id: teamId, email, role: role || 'field_worker', token, invited_by: cloud.accountId() })
    })
    if (!res.ok) { const e = await res.text(); return { error: e } }
    return { token, inviteUrl: `https://fieldbase-mobile.vercel.app?invite=${token}` }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('team:removeMember', async (_, { memberId }) => {
  if (!cloud.accountId()) return { error: 'Not signed in' }
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = cloud
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cloud.getSession?.()?.access_token || ''}` }
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/team_members?id=eq.${memberId}`, { method: 'DELETE', headers })
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('team:assignJob', async (_, { jobCloudId, assignedToUserId }) => {
  if (!cloud.accountId()) return { error: 'Not signed in' }
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = cloud
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cloud.getSession?.()?.access_token || ''}`, 'Content-Type': 'application/json' }
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobCloudId}`, { method: 'PATCH', headers, body: JSON.stringify({ assigned_to: assignedToUserId }) })
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('team:getTimeEntries', async (_, { teamId }) => {
  if (!cloud.accountId()) return []
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = cloud
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cloud.getSession?.()?.access_token || ''}` }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/time_entries?team_id=eq.${teamId}&order=clock_in.desc&limit=100`, { headers })
    return res.json()
  } catch { return [] }
})

// ─── Database backup ─────────────────────────────────────────────────────────
ipcMain.handle('db:backup', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `invoices-backup-${new Date().toISOString().slice(0,10)}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  })
  if (!filePath) return null
  fs.copyFileSync(getDbPath(), filePath)
  shell.showItemInFolder(filePath)
  return filePath
})
