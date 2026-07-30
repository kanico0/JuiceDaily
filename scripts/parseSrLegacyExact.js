/**
 * Parse SR Legacy CSV files - EXACT match version.
 *
 * Usage: node scripts/parseSrLegacyExact.js
 *
 * Prerequisites:
 *   1. Download the SR Legacy CSV dataset from USDA FoodData Central:
 *      https://fdc.nal.usda.gov/download-datasets
 *   2. Extract the ZIP to:
 *      scripts/sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04/
 *   3. The following CSV files must be present in that directory:
 *      food.csv, food_portion.csv, sr_legacy_food.csv, measure_unit.csv
 *
 * Output: Docs/generated/sr-legacy-exact-matches.json
 */
const fs = require('fs')
const path = require('path')

const CSV_DIR = path.join(__dirname, 'sr_legacy', 'FoodData_Central_sr_legacy_food_csv_2018-04')

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') { currentField += '"'; i++ } else { inQuotes = false }
      } else { currentField += char }
    } else {
      if (char === '"') { inQuotes = true }
      else if (char === ',') { currentRow.push(currentField); currentField = '' }
      else if (char === '\n') { currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = '' }
      else if (char === '\r') {}
      else { currentField += char }
    }
  }
  if (currentField !== '' || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow) }
  
  const headers = rows[0]
  const data = rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] || '' })
    return obj
  })
  return { headers, data }
}

// Exact description matches for each produce ID
const EXACT_MATCHES = {
  kale: 'Kale, raw',
  spinach: 'Spinach, raw',
  swiss_chard: 'Chard, swiss, raw',
  collard_greens: 'Collards, raw',
  dandelion_greens: 'Dandelion greens, raw',
  arugula: 'Arugula, raw',
  romaine: 'Lettuce, cos or romaine, raw',
  // bok_choy and wheatgrass not in SR Legacy - will use FNDDS fallback
  parsley: 'Parsley, fresh',
  cilantro: 'Coriander (cilantro) leaves, raw',
  mint: 'Spearmint, fresh',
  basil: 'Basil, fresh',
  watercress: 'Watercress, raw',
  broccoli: 'Broccoli, raw',
  cabbage_green: 'Cabbage, raw',
  cabbage_red: 'Cabbage, red, raw',
  cauliflower: 'Cauliflower, raw',
  kohlrabi: 'Kohlrabi, raw',
  carrot: 'Carrots, raw',
  celery: 'Celery, raw',
  beet: 'Beets, raw',
  cucumber: 'Cucumber, with peel, raw',
  fennel: 'Fennel, bulb, raw',
  sweet_potato: 'Sweet potato, raw, unprepared (Includes foods for USDA\'s Food Distribution Program)',
  turnip: 'Turnips, raw',
  celeriac: 'Celeriac, raw',
  jicama: 'Yambean (jicama), raw',
  zucchini: 'Squash, summer, zucchini, includes skin, raw',
  asparagus: 'Asparagus, raw',
  radish: 'Radishes, raw',
  ginger: 'Ginger root, raw',
  // turmeric raw not in SR Legacy - only 'Spices, turmeric, ground'
  garlic: 'Garlic, raw',
  bell_pepper_red: 'Peppers, sweet, red, raw',
  bell_pepper_yellow: 'Peppers, sweet, yellow, raw',
  bell_pepper_green: 'Peppers, sweet, green, raw',
  jalapeno: 'Peppers, jalapeno, raw',
  cayenne: 'Peppers, hot chili, red, raw',
  tomato: 'Tomatoes, red, ripe, raw, year round average',
  apple: 'Apples, raw, with skin (Includes foods for USDA\'s Food Distribution Program)',
  apple_green: 'Apples, raw, with skin (Includes foods for USDA\'s Food Distribution Program)',
  apple_red: 'Apples, raw, with skin (Includes foods for USDA\'s Food Distribution Program)',
  lemon: 'Lemons, raw, without peel',
  lime: 'Limes, raw',
  orange: 'Oranges, raw, all commercial varieties',
  grapefruit: 'Grapefruit, raw, pink and red and white, all areas',
  pineapple: 'Pineapple, raw, traditional varieties',
  watermelon: 'Watermelon, raw',
  pomegranate: 'Pomegranates, raw',
  mango: 'Mangos, raw',
  papaya: 'Papayas, raw',
  kiwi: 'Kiwifruit, green, raw',
  pear: 'Pears, raw',
  grape: 'Grapes, red or green (European type, such as Thompson seedless), raw',
  strawberry: 'Strawberries, raw',
  blueberry: 'Blueberries, raw',
  raspberry: 'Raspberries, raw',
  blackberry: 'Blackberries, raw',
  cranberry: 'Cranberries, raw',
  cherry: 'Cherries, sour, red, raw',
  cantaloupe: 'Melons, cantaloupe, raw',
  honeydew: 'Melons, honeydew, raw',
  coconut_water: 'Nuts, coconut water (liquid from coconuts)',
  passion_fruit: 'Passion-fruit, (granadilla), purple, raw',
  peach: 'Peaches, yellow, raw',
  plum: 'Plums, raw',
  nectarine: 'Nectarines, raw',
}

function main() {
  console.log('Parsing food.csv...')
  const { data: foods } = parseCSV(path.join(CSV_DIR, 'food.csv'))
  console.log('  ' + foods.length + ' food records')
  
  console.log('Parsing food_portion.csv...')
  const { data: portions } = parseCSV(path.join(CSV_DIR, 'food_portion.csv'))
  console.log('  ' + portions.length + ' portion records')
  
  console.log('Parsing sr_legacy_food.csv for ndb numbers...')
  const { data: srLegacy } = parseCSV(path.join(CSV_DIR, 'sr_legacy_food.csv'))
  const ndbByFdcId = {}
  srLegacy.forEach(s => { ndbByFdcId[s.fdc_id] = s.NDB_number })
  console.log('  ' + srLegacy.length + ' sr legacy records')
  
  console.log('Parsing measure_unit.csv...')
  const { data: units } = parseCSV(path.join(CSV_DIR, 'measure_unit.csv'))
  const unitMap = {}
  units.forEach(u => { unitMap[u.id] = u.name })
  
  // Build portion lookup by fdc_id
  const portionsByFood = {}
  portions.forEach(p => {
    const fdcId = p.fdc_id
    if (!portionsByFood[fdcId]) portionsByFood[fdcId] = []
    portionsByFood[fdcId].push({
      seqNum: p.seq_num,
      amount: p.amount,
      measureUnitId: p.measure_unit_id,
      measureUnitName: unitMap[p.measure_unit_id] || '',
      portionDescription: p.portion_description || '',
      modifier: p.modifier || '',
      gramWeight: parseFloat(p.gram_weight) || 0,
    })
  })
  
  // Build food description lookup
  const foodByDesc = {}
  foods.forEach(f => {
    const key = f.description.toLowerCase()
    if (!foodByDesc[key]) foodByDesc[key] = []
    foodByDesc[key].push(f)
  })
  
  const results = {}
  const notFound = []
  
  for (const [produceId, searchDesc] of Object.entries(EXACT_MATCHES)) {
    const matches = foodByDesc[searchDesc.toLowerCase()] || []
    
    if (matches.length === 0) {
      notFound.push(produceId)
      console.log('[MISS] ' + produceId + ': "' + searchDesc + '" not found')
      continue
    }
    
    const best = matches[0]
    const fdcId = best.fdc_id
    const foodPortions = (portionsByFood[fdcId] || []).sort((a, b) => parseInt(a.seqNum) - parseInt(b.seqNum))
    
    results[produceId] = {
      fdcId: fdcId,
      ndbNumber: ndbByFdcId[fdcId] || null,
      dataType: best.data_type,
      description: best.description,
      portions: foodPortions,
    }
    
    console.log('[OK] ' + produceId + ': fdcId=' + fdcId + ' ndb=' + (ndbByFdcId[fdcId] || 'N/A') + ' "' + best.description + '" ' + foodPortions.length + ' portions')
  }
  
  // Save results
  const outPath = path.join(__dirname, '..', 'Docs', 'generated', 'sr-legacy-exact-matches.json')
  fs.writeFileSync(outPath, JSON.stringify({ results, notFound, parsedAt: '2026-07-30T15:41:12.025Z' }, null, 2))
  
  console.log('\nSaved ' + Object.keys(results).length + ' results')
  console.log('Not found: ' + notFound.length + ' - ' + notFound.join(', '))
  
  // Print portion details
  console.log('\n=== PORTION DETAILS ===')
  for (const [produceId, data] of Object.entries(results)) {
    if (data.portions.length > 0) {
      console.log('\n' + produceId + ' (' + data.description + ', fdcId=' + data.fdcId + ', ndb=' + data.ndbNumber + '):')
      data.portions.forEach(p => {
        console.log('  ' + p.gramWeight + 'g | amount=' + p.amount + ' unit=' + p.measureUnitName + ' | ' + (p.portionDescription || p.modifier))
      })
    } else {
      console.log('\n' + produceId + ' (' + data.description + ', fdcId=' + data.fdcId + '): NO PORTIONS')
    }
  }
}

main()
