const { createCipheriv, createDecipheriv, randomBytes, createHash } = require('crypto')
const { machineIdSync } = require('node-machine-id')

const ENC_PREFIX = 'ENC:'
const APP_SECRET = 'fieldbase-secure-vault-2026'

// Cached once at startup — machineIdSync() is a blocking disk/registry read
let _key = null
function getKey() {
  if (_key) return _key
  const machineId = machineIdSync()
  _key = createHash('sha256').update(machineId + APP_SECRET).digest()
  return _key
}

function encrypt(value) {
  if (value === null || value === undefined) return value
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const result = Buffer.concat([iv, tag, encrypted]).toString('base64')
  return ENC_PREFIX + result
}

function decrypt(value) {
  if (value === null || value === undefined) return value
  if (typeof value !== 'string' || !value.startsWith(ENC_PREFIX)) return value
  try {
    const key = getKey()
    const buf = Buffer.from(value.slice(ENC_PREFIX.length), 'base64')
    const iv = buf.slice(0, 16)
    const tag = buf.slice(16, 32)
    const encrypted = buf.slice(32)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    // Not encrypted or wrong machine — return as-is
    return value
  }
}

// Encrypt a whole object's values
function encryptObj(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = encrypt(typeof v === 'object' ? JSON.stringify(v) : String(v))
  }
  return out
}

// Decrypt a whole object's values
function decryptObj(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = decrypt(v)
  }
  return out
}

module.exports = { encrypt, decrypt, encryptObj, decryptObj }
