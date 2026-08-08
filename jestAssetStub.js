// assetStubTransformer.js — Stub transformer for static assets (PNG, JPG, etc.)
// Returns a mock module so require('./icon.png') works in Jest tests.

module.exports = {
  process(_sourceText, filename) {
    return {
      code: `module.exports = ${JSON.stringify(filename)};`,
    }
  },
}
