import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const envFile = fileURLToPath(new URL('../.env.local', import.meta.url))
let envContents

try {
  envContents = readFileSync(envFile, 'utf8')
} catch {
  console.error('Supabase connection test failed: could not read .env.local.')
  process.exit(1)
}

const localEnv = Object.fromEntries(
  envContents.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match) return []
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
    return [[match[1], value]]
  }),
)

const supabaseUrl = localEnv.VITE_SUPABASE_URL
const publishableKey = localEnv.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !publishableKey) {
  console.error('Supabase connection test failed: .env.local must define VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  process.exit(1)
}

let healthUrl
try {
  healthUrl = new URL('/auth/v1/health', supabaseUrl)
} catch {
  console.error('Supabase connection test failed: VITE_SUPABASE_URL is not a valid URL.')
  process.exit(1)
}

try {
  const response = await fetch(healthUrl, {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(10000),
  })

  if (response.ok) {
    console.log('Supabase connection test passed: the project Auth health endpoint is reachable.')
  } else if (response.status === 401 || response.status === 403) {
    console.error(`Supabase responded with HTTP ${response.status}: the project is reachable, but the publishable key was rejected.`)
    process.exitCode = 1
  } else if (response.status === 404) {
    console.error('Supabase responded with HTTP 404: the host is reachable, but the Auth health endpoint was not found. Check the project URL.')
    process.exitCode = 1
  } else {
    console.error(`Supabase responded with HTTP ${response.status}: the host is reachable, but the health check did not succeed.`)
    process.exitCode = 1
  }
} catch (error) {
  const reason = error instanceof Error && error.name === 'TimeoutError'
    ? 'the request timed out'
    : 'the host could not be reached'
  console.error(`Supabase connection test failed: ${reason}. Check network access and the project URL.`)
  process.exitCode = 1
}
