// ─────────────────────────────────────────────────────────────
// fridgeForagerVirtualization.test.js — Regression test for
// Android OOM caused by non-virtualized recipe list rendering.
// Ensures FridgeForagerScreen uses FlatList (not ScrollView + .map)
// to avoid preallocating ~25,000 native views for 1,000 recipes.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

function readSrc(relPath) {
  const full = path.join(__dirname, relPath)
  return fs.readFileSync(full, 'utf8')
}

const SRC = readSrc('../FridgeForagerScreen.js')

describe('FridgeForagerScreen virtualization (OOM regression)', () => {
  it('imports FlatList from react-native', () => {
    expect(SRC).toContain('FlatList')
  })

  it('does not import ScrollView from react-native', () => {
    // ScrollView should not be in the react-native import block
    const rnImport = SRC.match(/from 'react-native'/)
    expect(rnImport).toBeTruthy()
    const importBlock = SRC.substring(0, SRC.indexOf("from 'react-native'"))
    expect(importBlock).not.toContain('ScrollView')
  })

  it('uses FlatList component in JSX', () => {
    expect(SRC).toMatch(/<FlatList/)
  })

  it('does not use ScrollView component in JSX', () => {
    expect(SRC).not.toMatch(/<ScrollView/)
  })

  it('does not render recipes with .map() inside ScrollView', () => {
    // The old pattern was: recommendedRecipes.map(...) or otherRecipes.map(...)
    // inside a <ScrollView>. The new pattern uses FlatList with data={listData}.
    expect(SRC).not.toMatch(/recommendedRecipes\.map\(/)
    expect(SRC).not.toMatch(/otherRecipes\.map\(/)
  })

  it('passes virtualization props to FlatList', () => {
    expect(SRC).toContain('initialNumToRender')
    expect(SRC).toContain('maxToRenderPerBatch')
    expect(SRC).toContain('removeClippedSubviews')
    expect(SRC).toContain('windowSize')
  })

  it('uses keyExtractor for stable keys', () => {
    expect(SRC).toContain('keyExtractor')
  })
})
