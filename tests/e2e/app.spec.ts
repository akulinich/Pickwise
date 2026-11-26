import { expect, test, type Page } from '@playwright/test'

async function enableImportTools(page: Page) {
  await page.evaluate(() => localStorage.setItem('pickwise.import-tools-visible.v1', '1'))
  await page.reload()
  await expect(page.getByLabel('Matchup data source')).toBeVisible()
}

function matchupCsv(source: string, capturedAt: string, winRate: number, includeExtraDeck = false) {
  const header = 'format_version,source,captured_at,rank,period,source_url,deck,deck_class,opponent_deck,opponent_class,win_rate,games,deck_popularity,opponent_popularity'
  const decks = [
    ['Cycle Rogue', 'rogue'],
    ['Libram Paladin', 'paladin'],
    ['Zarimi Priest', 'priest'],
    ['Discover Hunter', 'hunter'],
    ...(includeExtraDeck ? [['Control Warrior', 'warrior']] : []),
  ]
  const rows = decks.flatMap(([deck, deckClass], row) =>
    decks.map(([opponent, opponentClass], column) => [
      1, source, capturedAt, 'Legend', 'Last 3 days', 'https://example.test',
      deck, deckClass, opponent, opponentClass,
      row === 0 && column === 1 ? winRate : 50,
      200, 12 - row, 12 - column,
    ].join(',')),
  )
  return [header, ...rows].join('\n')
}

test('fits the icon-only matchup matrix without overlapping cells on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')

  const scroller = page.locator('.matrix-scroll').first()
  const dimensions = await scroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2)

  const cells = page.locator('.input-matrix tbody tr').first().locator('td')
  const boxes = await cells.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, width: box.width }
    }),
  )
  expect(boxes).toHaveLength(4)
  for (let index = 0; index < boxes.length - 1; index += 1) {
    expect(boxes[index].width).toBeGreaterThan(45)
    expect(boxes[index + 1].left).toBeGreaterThanOrEqual(boxes[index].right - 1)
  }

  const colors = await cells.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).backgroundColor),
  )
  expect(colors[0]).toBe('rgb(223, 238, 178)')
  expect(colors[1]).toBe('rgb(255, 197, 172)')
  expect(colors[3]).toBe('rgb(255, 244, 214)')

  const firstInput = page.getByLabel('Warrior win rate against Paladin')
  await expect(firstInput.locator('..')).toHaveCSS('border-top-width', '0px')
  await firstInput.focus()
  await expect(cells.first()).not.toHaveCSS('box-shadow', 'none')

  await page.setViewportSize({ width: 1180, height: 820 })
  const firstPercent = firstInput.locator('..')
  await expect(firstPercent).toHaveCSS('justify-content', 'center')
  await expect(firstPercent.locator('span').last()).toHaveCSS('color', 'rgb(52, 64, 84)')
})

test('keeps import tools hidden until the private shortcut is used', async ({ page }) => {
  await page.goto('./')

  await expect(page.locator('.brand-mark')).toHaveAttribute('src', /pickwise-mark\.svg$/)

  await expect(page.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
    'href',
    'https://github.com/akulinich/Pickwise/issues/new',
  )

  await expect(page.getByLabel('Matchup data source')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Import CSV' })).toHaveCount(0)
  await expect(page.getByLabel('Your deck 1 class')).toBeVisible()

  await page.keyboard.press('Alt+Shift+D')
  await expect(page.getByLabel('Matchup data source')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import CSV' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Matchup data source')).toBeVisible()

  await page.keyboard.press('Alt+Shift+D')
  await expect(page.getByLabel('Matchup data source')).toHaveCount(0)
})

test('saves calculations by match name and loads them after a reload', async ({ page }) => {
  await page.goto('./')

  await page.getByLabel('Match name').fill('Qualifier vs Alex')
  await page.getByLabel('Warrior win rate against Paladin').fill('67')
  await page.getByRole('button', { name: 'Calculate strategy' }).click()
  await expect(page.getByText('Saved locally as “Qualifier vs Alex”.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Open saved matches' }).click()
  await page.getByRole('menuitem', { name: 'Qualifier vs Alex' }).click()

  await expect(page.getByLabel('Match name')).toHaveValue('Qualifier vs Alex')
  await expect(page.getByLabel('Warrior win rate against Paladin')).toHaveValue('67')
  await expect(page.getByRole('heading', { name: 'Match plan' })).toBeVisible()
  await expect(page.getByText('Loaded “Qualifier vs Alex”.')).toBeVisible()

  await page.getByLabel('Match name').fill('Qualifier final')
  await page.getByRole('button', { name: 'Calculate strategy' }).click()
  await expect(page.getByText('Saved locally as “Qualifier final”.')).toBeVisible()
  await page.getByRole('button', { name: 'Open saved matches' }).click()
  await expect(page.getByRole('menuitem', { name: 'Qualifier final' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Qualifier vs Alex' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open saved matches' }).click()

  await page.getByRole('button', { name: 'New match' }).click()
  await expect(page.getByLabel('Match name')).toHaveValue('New match')
  await expect(page.getByRole('heading', { name: 'Match plan', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Open saved matches' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete Qualifier final' }).click()
  await expect(page.getByText('No saved matches yet')).toBeVisible()
})

test('automatically restores the current match name and data source after a reload', async ({ page }) => {
  await page.goto('./')
  await enableImportTools(page)

  await page.getByLabel('Match name').fill('Qualifier vs Sam')
  await expect(page.getByText('Saved locally.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Match name')).toHaveValue('Qualifier vs Sam')

  await page.getByLabel('Choose matchup CSV').setInputFiles({
    name: 'hsreplay.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(matchupCsv('HSReplay', '2026-11-18T12:00:00.000Z', 66.4)),
  })
  await expect(page.getByLabel('Matchup data source')).toHaveValue('imported')
  await page.reload()

  await expect(page.getByLabel('Match name')).toHaveValue('Qualifier vs Sam')
  await expect(page.getByLabel('Matchup data source')).toHaveValue('imported')
  await expect(page.getByLabel('Imported dataset')).toHaveValue(
    'HSReplay:2026-11-18T12:00:00.000Z',
  )
  await expect(page.getByLabel('Cycle Rogue win rate against Libram Paladin')).toHaveValue('66.4')
})

test('imports and keeps multiple matchup datasets', async ({ page }) => {
  await page.goto('./')
  await enableImportTools(page)

  const fileInput = page.getByLabel('Choose matchup CSV')
  await fileInput.setInputFiles({
    name: 'hsguru.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(matchupCsv('HSGuru', '2026-11-17T12:00:00.000Z', 61.2, true)),
  })
  await expect(page.getByLabel('Matchup data source')).toHaveValue('imported')
  await expect(page.getByLabel('Cycle Rogue win rate against Libram Paladin')).toHaveValue('61.2')
  const firstDeckPicker = page.getByLabel('Your deck 1')
  await expect(firstDeckPicker.locator('optgroup[label="Imported decks"] option')).toHaveText([
    'Control Warrior',
    'Cycle Rogue',
    'Discover Hunter',
    'Libram Paladin',
    'Zarimi Priest',
  ])
  await expect(firstDeckPicker.locator('optgroup[label="Classes · manual"] option')).toHaveText([
    'Death Knight',
    'Demon Hunter',
    'Druid',
    'Hunter',
    'Mage',
    'Paladin',
    'Priest',
    'Rogue',
    'Shaman',
    'Warlock',
    'Warrior',
  ])

  await fileInput.setInputFiles({
    name: 'hsreplay.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(matchupCsv('HSReplay', '2026-11-18T12:00:00.000Z', 66.4)),
  })
  const datasets = page.getByLabel('Imported dataset')
  await expect(datasets.locator('option')).toHaveCount(2)
  await expect(page.getByLabel('Cycle Rogue win rate against Libram Paladin')).toHaveValue('66.4')
  await datasets.selectOption('HSGuru:2026-11-17T12:00:00.000Z')
  await expect(page.getByLabel('Cycle Rogue win rate against Libram Paladin')).toHaveValue('61.2')

  await page.getByRole('button', { name: 'View table' }).click()
  const importedTable = page.getByRole('dialog', { name: 'Imported matchup table' })
  await expect(importedTable).toBeVisible()
  await expect(importedTable.locator('tbody tr')).toHaveCount(5)
  await expect(importedTable.getByRole('cell', { name: /61\.2%.*200 games/ })).toBeVisible()

  for (const deck of ['Cycle Rogue', 'Libram Paladin', 'Zarimi Priest', 'Discover Hunter']) {
    await expect(importedTable.getByRole('button', { name: `Select row ${deck}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(importedTable.getByRole('button', { name: `Select column ${deck}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }
  await expect(importedTable.getByRole('button', { name: 'Select row Control Warrior' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(importedTable.getByRole('button', { name: 'Select column Control Warrior' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  const rowsOnly = importedTable.getByRole('button', { name: /Show selected rows/ })
  const columnsOnly = importedTable.getByRole('button', { name: /Show selected columns/ })
  await rowsOnly.click()
  await columnsOnly.click()
  await expect(rowsOnly).toHaveAttribute('aria-pressed', 'true')
  await expect(columnsOnly).toHaveAttribute('aria-pressed', 'true')
  await expect(importedTable.locator('tbody tr')).toHaveCount(4)
  await expect(importedTable.locator('thead th')).toHaveCount(5)
  await expect(importedTable.locator('tbody td')).toHaveCount(16)

  await rowsOnly.click()
  await columnsOnly.click()
  await expect(importedTable.locator('tbody tr')).toHaveCount(5)
  await expect(importedTable.locator('thead th')).toHaveCount(6)
  await page.getByRole('button', { name: 'Close imported table' }).click()

  await page.getByLabel('Opponent deck 1').selectOption('class:warlock')
  const manualMatchup = page.getByLabel('Cycle Rogue win rate against Warlock')
  await expect(manualMatchup).toHaveValue('50')
  await manualMatchup.fill('37')
  await expect(manualMatchup).toHaveValue('37')
  await page.reload()
  await expect(page.getByLabel('Opponent deck 1')).toHaveValue('class:warlock')
  await expect(page.getByLabel('Cycle Rogue win rate against Warlock')).toHaveValue('37')
  await page.getByRole('button', { name: 'Calculate strategy' }).click()
  await expect(page.getByRole('heading', { name: 'Match plan' })).toBeVisible()
})

test('calculates the match, explains the math, and exports a PDF', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./')

  await expect(page.getByText('Hide picks below')).toHaveCount(0)

  await page.getByRole('button', { name: 'Calculate' }).click()

  await expect(page.getByRole('heading', { name: 'Match plan' })).toBeVisible()
  await expect(page.getByText('55.8%')).toBeVisible()
  await expect(page.locator('.decision-table tbody tr')).toHaveCount(4)

  await page.getByRole('button', { name: 'Show math' }).click()
  await expect(page.getByRole('dialog', { name: 'How Pickwise got this answer' })).toBeVisible()
  await expect(page.locator('[aria-label="Calculation scope"]')).toContainText(/16\s*ban pairs/)
  await expect(page.locator('[aria-label="Calculation scope"]')).toContainText(/63\s*reachable states per post-ban game/)
  await expect(page.locator('[aria-label="Calculation scope"]')).toContainText(/0\s*data uploads/)
  await expect(page.getByRole('heading', { name: 'Dynamic programming over zero-sum games' })).toBeVisible()
  await expect(page.getByText(/mixed-strategy Nash equilibrium/)).toBeVisible()
  await expect(page.getByText(/63 reachable post-ban states/)).toBeVisible()
  await expect(page.getByText('Sixteen complete Conquest games become one 4 × 4 game')).toBeVisible()
  await expect(page.getByText('05 · All 63 reachable states')).toBeVisible()
  await expect(page.getByText(/next-pick recommendations below 0.5%/)).toBeVisible()

  const state = page.locator('details').filter({
    has: page.getByText('V(Warrior, Paladin)', { exact: true }),
  })
  await state.locator('summary').click()
  await expect(state.getByText('Your strategy', { exact: true })).toBeVisible()
  await expect(state.getByText('Opponent strategy', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close math explorer' }).click()

  await page.getByRole('combobox', { name: 'Your ban', exact: true }).selectOption('2')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('conquest-match-match-sheet.pdf')

  await page.getByLabel('Warrior win rate against Priest').fill('60')
  await expect(page.getByText(/Inputs changed\. These results are preserved/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled()
})
