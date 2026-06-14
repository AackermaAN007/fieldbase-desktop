const path = require('path')
const fs = require('fs')
const { app } = require('electron')

const LOG_MAX_BYTES = 5 * 1024 * 1024
let _logPath = null

function getLogPath() {
  if (_logPath) return _logPath
  try {
    const dir = path.join(app.getPath('appData'), 'Fieldbase', 'logs')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    _logPath = path.join(dir, 'fieldbase.log')
  } catch {}
  return _logPath
}

function writeLog(level, ...args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
  console[level === 'ERROR' ? 'error' : 'log'](line.trim())
  try {
    const p = getLogPath()
    if (!p) return
    if (fs.existsSync(p) && fs.statSync(p).size > LOG_MAX_BYTES) {
      fs.renameSync(p, p.replace('.log', '.old.log'))
    }
    fs.appendFileSync(p, line)
  } catch {}
}

const log = {
  info:  (...a) => writeLog('INFO',  ...a),
  warn:  (...a) => writeLog('WARN',  ...a),
  error: (...a) => writeLog('ERROR', ...a),
  getPath: getLogPath,
}

module.exports = log
