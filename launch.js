#!/usr/bin/env node
// Fast launcher — skips Vite dev server entirely.
// Builds React once if dist/ doesn't exist, then runs Electron directly.
const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const distIndex = path.join(__dirname, 'dist', 'index.html')

if (!fs.existsSync(distIndex)) {
  console.log('Building Fieldbase for the first time...')
  execSync('npm run build:react', { stdio: 'inherit', cwd: __dirname })
}

const electron = require('electron')
const child = spawn(electron, ['.'], {
  env: { ...process.env, FIELDBASE_FAST: '1' },
  stdio: 'inherit',
  cwd: __dirname,
})

child.on('exit', code => process.exit(code || 0))
