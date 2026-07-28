const fs = require('fs')
const path = require('path')

const homeScreenPath = path.join(__dirname, '..', 'HomeScreen.js')
const manifestPath = path.join(__dirname, '..', '..', '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml')

function readHomeScreen() {
  return fs.readFileSync(homeScreenPath, 'utf8')
}

describe('JuiceSnap manual ingredient keyboard handling', () => {
  test('uses an adaptive keyboard-aware scroll region', () => {
    const source = readHomeScreen()

    expect(source).toContain('KeyboardAvoidingView')
    expect(source).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}")
    expect(source).toContain('keyboardDismissMode="on-drag"')
    expect(source).toContain('keyboardShouldPersistTaps="handled"')
    expect(source).toContain("keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}")
  })

  test('scrolls the manual input into the visible viewport on focus using adaptive keyboard height', () => {
    const source = readHomeScreen()

    expect(source).toContain('const handleManualSearchFocus')
    expect(source).toContain('scrollRef.current?.scrollTo')
    expect(source).toContain('effectiveKbHeight')
    expect(source).toContain('onFocus={handleManualSearchFocus}')
  })

  test('tracks keyboard height via Keyboard event listeners', () => {
    const source = readHomeScreen()

    expect(source).toContain("Keyboard.addListener('keyboardDidShow'")
    expect(source).toContain("Keyboard.addListener('keyboardDidHide'")
    expect(source).toContain('setKeyboardHeight')
  })

  test('first-focus fix: tracks manual input focus state via ref', () => {
    const source = readHomeScreen()

    expect(source).toContain('manualSearchFocusedRef')
    expect(source).toContain('manualSearchFocusedRef.current = true')
    expect(source).toContain('onBlur={handleManualSearchBlur}')
    expect(source).toContain('handleManualSearchBlur')
    expect(source).toContain('manualSearchFocusedRef.current = false')
  })

  test('first-focus fix: keyboardDidShow scrolls using event height when manual input is focused', () => {
    const source = readHomeScreen()

    expect(source).toContain('const kbHeight = e.endCoordinates.height')
    expect(source).toContain('if (manualSearchFocusedRef.current)')
    expect(source).toContain('manualSearchOffsetRef.current - kbHeight * 0.65')
  })

  test('first-focus fix: blur prevents later keyboard events from scrolling manual input', () => {
    const source = readHomeScreen()

    const blurMatch = source.match(/const handleManualSearchBlur[\s\S]*?}/)
    expect(blurMatch).toBeTruthy()
    expect(blurMatch[0]).toContain('manualSearchFocusedRef.current = false')
  })

  test('first-focus fix: keyboardDidHide clears focus tracking', () => {
    const source = readHomeScreen()

    const hideMatch = source.match(/Keyboard\.addListener\('keyboardDidHide'[\s\S]*?\}\)/)
    expect(hideMatch).toBeTruthy()
    expect(hideMatch[0]).toContain('manualSearchFocusedRef.current = false')
  })

  test('first-focus fix: listeners are cleaned up on unmount without duplication', () => {
    const source = readHomeScreen()

    expect(source).toContain('showListener.remove()')
    expect(source).toContain('hideListener.remove()')
    const addListenerCount = (source.match(/Keyboard\.addListener/g) || []).length
    expect(addListenerCount).toBe(2)
  })

  test('preserves autocomplete and keyboard submit add behavior', () => {
    const source = readHomeScreen()

    expect(source).toContain('<IngredientCloud')
    expect(source).toContain('onSubmitEditing={handleManualSearchSubmit}')
    expect(source).toContain('returnKeyType="done"')
    expect(source).toContain('handleManualAdd(matchingIngredient)')
  })

  test('displays permanent Ingredient Entry Tips with spelling and examples', () => {
    const source = readHomeScreen()

    expect(source).toContain('Ingredient Entry Tips')
    expect(source).toContain('check the spelling')
    expect(source).toContain('shorter')
    expect(source).toContain('spinach')
    expect(source).toContain('carrot')
    expect(source).toContain('cucumber')
    expect(source).toContain('apple')
    expect(source).toContain('lineHeight: 22')
  })

  test('renders permanent tips as six separate paragraphs with heading', () => {
    const source = readHomeScreen()

    expect(source).toContain('tipsWrap')
    expect(source).toContain('tipsHeading')
    expect(source).toContain('tipsPara')

    const tipsWrapMatch = source.match(/<View style=\{manualStyles\.tipsWrap\}>[\s\S]*?<\/View>/)
    expect(tipsWrapMatch).toBeTruthy()
    const wrapContent = tipsWrapMatch[0]

    const paraCount = (wrapContent.match(/<Text style=\{manualStyles\.tipsPara\}>/g) || []).length
    expect(paraCount).toBe(6)

    expect(wrapContent).toContain('Ingredient Entry Tips')
    expect(wrapContent).toContain('Start typing the name of the fruit or vegetable you want to add.')
    expect(wrapContent).toContain('You can enter a full ingredient name or begin with only the first few letters.')
    expect(wrapContent).toContain("For example, typing 'carr' should help you find carrot.")
    expect(wrapContent).toContain('If too many results appear, continue typing to narrow the list.')
    expect(wrapContent).toContain('If no ingredient matches, check the spelling or try a shorter, more general name.')
    expect(wrapContent).toContain('You can also try a familiar ingredient such as spinach, carrot, cucumber, apple, celery, or kale.')
  })

  test('tips section is permanent and not conditional on filtered results', () => {
    const source = readHomeScreen()

    const tipsMatch = source.match(/<View style=\{manualStyles\.tipsWrap\}>/)
    expect(tipsMatch).toBeTruthy()

    const tipsBlockMatch = source.match(/filtered\.length === 0[\s\S]*?<\/Text>[\s\S]*?<View style=\{manualStyles\.tipsWrap\}>/)
    expect(tipsBlockMatch).toBeTruthy()
  })

  test('short no-match status appears only for non-empty zero-match query', () => {
    const source = readHomeScreen()

    expect(source).toContain('noMatchStatus')
    expect(source).toContain('No matching ingredient found.')
    expect(source).toContain('filtered.length === 0 && searchQuery.length > 0')
  })

  test('each tips paragraph has vertical spacing via marginBottom', () => {
    const source = readHomeScreen()

    const paraStyleMatch = source.match(/tipsPara: \{[\s\S]*?\}/)
    expect(paraStyleMatch).toBeTruthy()
    expect(paraStyleMatch[0]).toContain('marginBottom: 12')
  })

  test('results layout triggers at most one corrective scroll via requestAnimationFrame', () => {
    const source = readHomeScreen()

    expect(source).toContain('handleResultsLayout')
    expect(source).toContain('onResultsLayout={handleResultsLayout}')
    expect(source).toContain('requestAnimationFrame')
    expect(source).toContain('manualSearchFocusedRef.current')
  })

  test('no corrective results scroll occurs after input blur', () => {
    const source = readHomeScreen()

    const resultsMatch = source.match(/const handleResultsLayout[\s\S]*?\}, \[keyboardHeight\]\)/)
    expect(resultsMatch).toBeTruthy()
    expect(resultsMatch[0]).toContain('if (!manualSearchFocusedRef.current')
  })

  test('scroll offset uses 0.65 multiplier for keyboard height', () => {
    const source = readHomeScreen()

    expect(source).toContain('kbHeight * 0.65')
    expect(source).toContain('effectiveKbHeight * 0.65')
    expect(source).not.toContain('kbHeight * 0.5')
    expect(source).not.toContain('effectiveKbHeight * 0.5')
  })

  test('uses Android resize behavior in the native activity', () => {
    const manifest = fs.readFileSync(manifestPath, 'utf8')

    expect(manifest).toContain('android:windowSoftInputMode="adjustResize"')
  })
})
