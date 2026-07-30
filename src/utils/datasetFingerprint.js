import crypto from 'crypto'

export function computeDatasetFingerprint(recipes) {
  const fingerprintParts = []
  for (const r of recipes) {
    const distinctIds = [...new Set(r.ingredients.map((i) => i.produceId.toLowerCase()))].sort()
    fingerprintParts.push(`${r.id}:${distinctIds.join(',')}:${distinctIds.length}`)
  }
  const fingerprintInput = fingerprintParts.join('\n')
  return crypto.createHash('sha256').update(fingerprintInput).digest('hex')
}
