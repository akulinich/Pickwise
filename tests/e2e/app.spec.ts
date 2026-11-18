import { expect, test } from '@playwright/test'

test('calculates the match, explains the math, and exports a PDF', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./')

  await page.getByRole('button', { name: 'Calculate' }).click()

  await expect(page.getByRole('heading', { name: 'Match plan' })).toBeVisible()
  await expect(page.getByText('55.8%')).toBeVisible()
  await expect(page.locator('.decision-table tbody tr')).toHaveCount(4)

  await page.getByRole('button', { name: 'Show math' }).click()
  await expect(page.getByRole('dialog', { name: 'How Pickwise got this answer' })).toBeVisible()
  await expect(page.getByText('Sixteen complete Conquest games become one 4 × 4 game')).toBeVisible()
  await expect(page.getByText('04 · All 63 reachable states')).toBeVisible()

  const state = page.locator('details').filter({
    has: page.getByText('V(Warrior deck, Paladin deck)', { exact: true }),
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

  await page.getByLabel('Warrior deck win rate against Priest deck').fill('60')
  await expect(page.getByText(/Inputs changed\. These results are preserved/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled()
})
