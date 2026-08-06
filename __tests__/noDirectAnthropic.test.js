// Regression test: mobile app must never directly call Anthropic or
// read an Anthropic API key. All produce scans must route through the
// Supabase analyze-scan Edge Function.

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

describe('No direct Anthropic access in mobile app', () => {
  test('CameraScreen does not gate on isClaudeKeySet or show Anthropic key error', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, 'src/screens/CameraScreen.js'),
      'utf-8'
    )
    expect(source).not.toContain('isClaudeKeySet')
    expect(source).not.toContain('ANTHROPIC_API_KEY')
    expect(source).not.toContain('API key not configured')
  })

  test('ClaudeVisionService has no direct Anthropic API call', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, 'src/services/ClaudeVisionService.ts'),
      'utf-8'
    )
    expect(source).not.toContain('api.anthropic.com')
    expect(source).not.toContain('x-api-key')
    expect(source).not.toContain('anthropic-version')
    expect(source).not.toContain('setClaudeApiKey')
    expect(source).not.toContain('isClaudeKeySet')
    expect(source).not.toContain('ANTHROPIC_API_KEY')
  })

  test('App.js does not import or load ANTHROPIC_API_KEY', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, 'App.js'),
      'utf-8'
    )
    expect(source).not.toContain('ANTHROPIC_API_KEY')
    expect(source).not.toContain('setClaudeApiKey')
    expect(source).not.toContain('@env')
  })

  test('app.config.js does not embed ANTHROPIC_API_KEY', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, 'app.config.js'),
      'utf-8'
    )
    expect(source).not.toContain('ANTHROPIC_API_KEY')
  })

  test('.env.example does not reference ANTHROPIC_API_KEY', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, '.env.example'),
      'utf-8'
    )
    expect(source).not.toContain('ANTHROPIC_API_KEY')
  })

  test('env.d.ts does not declare ANTHROPIC_API_KEY', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, 'src/types/env.d.ts'),
      'utf-8'
    )
    expect(source).not.toMatch(/export\s+const\s+ANTHROPIC_API_KEY/)
  })

  test('ClaudeVisionService routes through Supabase analyze-scan', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, 'src/services/ClaudeVisionService.ts'),
      'utf-8'
    )
    expect(source).toContain('analyzeScanOnServer')
    expect(source).toContain('isServerScanAvailable')
  })

  test('CameraScreen still calls identifyProduce for produce analysis', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, 'src/screens/CameraScreen.js'),
      'utf-8'
    )
    expect(source).toContain('identifyProduce')
  })
})
