#!/usr/bin/env node
import { createRequire } from 'module'

globalThis.require = createRequire(import.meta.url)

await import('./cli.js')
