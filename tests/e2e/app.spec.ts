import { expect, test } from '@playwright/test'

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
})

test('saves calculations by match name and loads them after a reload', async ({ page }) => {
  await page.goto('./')

  await page.getByLabel('Sheet title').fill('Qualifier vs Alex')
  await page.getByLabel('Warrior win rate against Paladin').fill('67')
  await page.getByRole('button', { name: 'Calculate strategy' }).click()
  await expect(page.getByText('Saved locally as “Qualifier vs Alex”.')).toBeVisible()

  await page.reload()
  const savedCalculations = page.getByRole('combobox', { name: 'Saved calculations' })
  await savedCalculations.selectOption({ label: 'Qualifier vs Alex' })
  await page.getByRole('button', { name: 'Load', exact: true }).click()

  await expect(page.getByLabel('Sheet title')).toHaveValue('Qualifier vs Alex')
  await expect(page.getByLabel('Warrior win rate against Paladin')).toHaveValue('67')
  await expect(page.getByRole('heading', { name: 'Match plan' })).toBeVisible()
  await expect(page.getByText('Loaded “Qualifier vs Alex”.')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(savedCalculations).toHaveValue('')
  await expect(savedCalculations.locator('option')).toHaveText('No saved matches yet')
})

test('calculates the match, explains the math, and exports a PDF', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./')

  await page.getByRole('button', { name: 'Calculate' }).click()

  await expect(page.getByRole('heading', { name: 'Match plan' })).toBeVisible()
  await expect(page.getByText('55.8%')).toBeVisible()
  await expect(page.locator('.decision-table tbody tr')).toHaveCount(4)

  await page.getByRole('button', { name: 'Show math' }).click()
  await expect(page.getByRole('dialog', { name: 'How Pickwise got this answer' })).toBeVisible()
  await expect(page.locator('[aria-label="Calculation scope"]')).toContainText(/16\s*ban pairs/)
  await expect(page.locator('[aria-label="Calculation scope"]')).toContainText(/63\s*reachable states per post-ban game/)
  await expect(page.locator('[aria-label="Calculation scope"]')).toContainText(/0\s*data uploads/)
  await expect(page.getByText('Sixteen complete Conquest games become one 4 × 4 game')).toBeVisible()
  await expect(page.getByText('04 · All 63 reachable states')).toBeVisible()

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
