import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  MIN_VISIBLE_PICK_PROBABILITY,
  classIconUrl,
  className,
  deckName,
  type DeckInput,
  type SolverInput,
} from "../domain/model";
import { subsetsForMask, type BanResult, type ConquestSolution } from "../solver/conquest";
import { formatPercent } from "../utils/format";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const INK = rgb(0.09, 0.16, 0.22);
const MUTED = rgb(0.28, 0.36, 0.42);
const LINE = rgb(0.77, 0.82, 0.85);
const HEADER = rgb(0.93, 0.95, 0.96);
const ACCENT = rgb(0.54, 0.38, 0.11);
const ACCENT_FILL = rgb(0.98, 0.94, 0.84);
const WHITE = rgb(1, 1, 1);
const notoRegularUrl = `${import.meta.env.BASE_URL}fonts/NotoSans-Regular.ttf`;
const notoBoldUrl = `${import.meta.env.BASE_URL}fonts/NotoSans-Bold.ttf`;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

function drawBox(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = WHITE,
  border = LINE,
) {
  page.drawRectangle({ x, y, width, height, color: fill, borderColor: border, borderWidth: 0.55 });
}

function fitText(font: PDFFont, text: string, maxWidth: number, startSize: number, minSize = 5): number {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  return size;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const fitted = fitText(font, text, width, size);
  page.drawText(text, { x, y, size: fitted, font, color, maxWidth: width });
}

function centeredText(
  page: PDFPage,
  text: string,
  centerX: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const fitted = fitText(font, text, maxWidth, size);
  const width = font.widthOfTextAtSize(text, fitted);
  page.drawText(text, { x: centerX - width / 2, y, size: fitted, font, color });
}

async function embedImages(pdf: PDFDocument, decks: readonly DeckInput[]): Promise<Map<string, PDFImage>> {
  const images = new Map<string, PDFImage>();
  for (const deck of decks) {
    if (images.has(deck.classId)) continue;
    const bytes = await fetch(classIconUrl(deck.classId)).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${deck.classId} icon.`);
      return response.arrayBuffer();
    });
    images.set(deck.classId, await pdf.embedPng(bytes));
  }
  return images;
}

function drawDeckSymbol(
  page: PDFPage,
  deck: DeckInput,
  images: Map<string, PDFImage>,
  x: number,
  y: number,
  size: number,
  fonts: Fonts,
) {
  const image = images.get(deck.classId);
  if (image) {
    page.drawImage(image, { x: x - size / 2, y: y - size / 2, width: size, height: size });
  } else {
    centeredText(page, className(deck.classId), x, y - size * 0.23, size * 2, fonts.bold, size * 0.35);
  }
}

function heatColor(value: number) {
  const intensity = Math.min(1, Math.abs(value - 0.5) / 0.18);
  const target = value >= 0.5 ? [0.7, 0.85, 0.74] : [0.94, 0.75, 0.72];
  return rgb(
    1 + (target[0] - 1) * intensity,
    1 + (target[1] - 1) * intensity,
    1 + (target[2] - 1) * intensity,
  );
}

function drawMatchupMatrix(
  page: PDFPage,
  input: SolverInput,
  x: number,
  top: number,
  width: number,
  fonts: Fonts,
  images: Map<string, PDFImage>,
) {
  const cellWidth = width / 5;
  const cellHeight = 24;
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const left = x + column * cellWidth;
      const bottom = top - (row + 1) * cellHeight;
      if (row > 0 && column > 0) {
        const value = input.matrix[row - 1][column - 1] / 100;
        drawBox(page, left, bottom, cellWidth, cellHeight, heatColor(value));
        centeredText(page, formatPercent(value, 1), left + cellWidth / 2, bottom + 8, cellWidth - 4, fonts.bold, 8.4);
      } else {
        drawBox(page, left, bottom, cellWidth, cellHeight, HEADER);
        if (row > 0) drawDeckSymbol(page, input.myDecks[row - 1], images, left + cellWidth / 2, bottom + 12, 16, fonts);
        if (column > 0) drawDeckSymbol(page, input.opponentDecks[column - 1], images, left + cellWidth / 2, bottom + 12, 16, fonts);
      }
    }
  }
}

function drawLineup(
  page: PDFPage,
  title: string,
  decks: readonly DeckInput[],
  x: number,
  top: number,
  width: number,
  fonts: Fonts,
  images: Map<string, PDFImage>,
  markedBan?: number,
) {
  drawText(page, title, x, top, width, fonts.bold, 12);
  decks.forEach((deck, index) => {
    const y = top - 20 - index * 19;
    page.drawRectangle({ x: x + 1, y: y - 2, width: 8, height: 8, borderColor: LINE, borderWidth: 0.55 });
    drawDeckSymbol(page, deck, images, x + 20, y + 2, 13, fonts);
    drawText(page, deckName(deck), x + 31, y - 2, width - 65, fonts.regular, 8.4);
    if (markedBan === index) drawText(page, "BAN", x + width - 28, y - 2, 27, fonts.bold, 7, ACCENT);
  });
}

function drawStateSymbols(
  page: PDFPage,
  mask: number,
  decks: readonly DeckInput[],
  images: Map<string, PDFImage>,
  centerX: number,
  centerY: number,
  fonts: Fonts,
) {
  const indices = maskToDeckIndices(mask);
  indices.forEach((deckIndex, index) => {
    drawDeckSymbol(page, decks[deckIndex], images, centerX + 11 * (index - (indices.length - 1) / 2), centerY, 10, fonts);
  });
}

function maskToDeckIndices(mask: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) if ((mask & (1 << index)) !== 0) values.push(index);
  return values;
}

function drawDecisionCard(
  page: PDFPage,
  solution: ConquestSolution,
  input: SolverInput,
  opponentBan: number,
  opponentBanChance: number,
  highlighted: boolean,
  x: number,
  top: number,
  width: number,
  fonts: Fonts,
  images: Map<string, PDFImage>,
) {
  const height = 204;
  drawBox(page, x, top - height, width, height, WHITE, highlighted ? ACCENT : LINE);
  drawBox(page, x, top - 38, width, 38, highlighted ? ACCENT_FILL : HEADER, highlighted ? ACCENT : LINE);
  drawDeckSymbol(page, input.myDecks[opponentBan], images, x + 16, top - 18, 15, fonts);
  drawText(page, deckName(input.myDecks[opponentBan]), x + 29, top - 21, width - 84, fonts.bold, 9.5);
  const chance = formatPercent(opponentBanChance, 0);
  drawText(page, chance, x + width - 38, top - 21, 30, fonts.bold, 9.5, highlighted ? ACCENT : INK);
  drawText(page, highlighted ? "Most likely opponent ban" : "Opponent ban", x + 9, top - 33, width - 18, fonts.regular, 7, MUTED);

  const myStates = subsetsForMask(solution.myMask, 2);
  const opponentStates = subsetsForMask(solution.opponentMask, 2);
  const gridX = x + 7;
  const gridTop = top - 45;
  const labelWidth = 43;
  const headerHeight = 18;
  const rowHeight = 33;
  const cellWidth = (width - 14 - labelWidth) / opponentStates.length;
  drawBox(page, gridX, gridTop - headerHeight, labelWidth, headerHeight, HEADER);
  opponentStates.forEach((mask, column) => {
    const left = gridX + labelWidth + column * cellWidth;
    drawBox(page, left, gridTop - headerHeight, cellWidth, headerHeight, HEADER);
    drawStateSymbols(page, mask, input.opponentDecks, images, left + cellWidth / 2, gridTop - 9, fonts);
  });
  myStates.forEach((myMask, row) => {
    const bottom = gridTop - headerHeight - (row + 1) * rowHeight;
    drawBox(page, gridX, bottom, labelWidth, rowHeight, HEADER);
    drawStateSymbols(page, myMask, input.myDecks, images, gridX + labelWidth / 2, bottom + 16, fonts);
    opponentStates.forEach((opponentMask, column) => {
      const left = gridX + labelWidth + column * cellWidth;
      const state = solution.getState(myMask, opponentMask);
      drawBox(page, left, bottom, cellWidth, rowHeight, WHITE);
      centeredText(page, formatPercent(state.value, 1), left + cellWidth / 2, bottom + 22, cellWidth - 3, fonts.bold, 7.6);
      const picks = state.myStrategy.filter(
        (item) =>
          item.probability > 1e-9 &&
          item.probability + 1e-12 >= MIN_VISIBLE_PICK_PROBABILITY,
      );
      picks.slice(0, 3).forEach((item, pickIndex) => {
        const pickY = bottom + 13 - pickIndex * 6.5;
        drawDeckSymbol(page, input.myDecks[item.deck], images, left + cellWidth / 2 - 9, pickY + 2, 6, fonts);
        drawText(page, formatPercent(item.probability, 0), left + cellWidth / 2 - 4, pickY, 22, fonts.regular, 5.7, MUTED);
      });
    });
  });
}

export async function generateConquestPdf(
  input: SolverInput,
  result: BanResult,
  selectedOurBan: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fetch(notoRegularUrl).then((response) => response.arrayBuffer()),
    fetch(notoBoldUrl).then((response) => response.arrayBuffer()),
  ]);
  const fonts: Fonts = {
    regular: await pdf.embedFont(regularBytes, { subset: true }),
    bold: await pdf.embedFont(boldBytes, { subset: true }),
  };
  const images = await embedImages(pdf, [...input.myDecks, ...input.opponentDecks]);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const margin = 24;
  const sideWidth = 225;
  const rightX = margin + sideWidth + 16;
  const rightWidth = PAGE_WIDTH - rightX - margin;
  pdf.setTitle(input.eventName.trim() || "Pickwise Conquest Match Sheet");
  pdf.setSubject("Hearthstone Conquest strategy sheet");
  pdf.setCreator("Pickwise");

  drawText(page, "CONQUEST 4 × 4  /  MATCH SHEET", margin, 557, 430, fonts.bold, 8, MUTED);
  drawText(page, input.eventName.trim() || "Tournament Match", margin, 529, 450, fonts.bold, 21);

  const banWeight = result.myBanStrategy.find((item) => item.deck === selectedOurBan)?.probability ?? 0;
  const banX = PAGE_WIDTH - margin - 316;
  drawBox(page, banX, 517, 316, 48, HEADER);
  drawText(page, "YOUR BAN FOR THIS SHEET", banX + 12, 551, 283, fonts.bold, 7.4, MUTED);
  drawDeckSymbol(page, input.opponentDecks[selectedOurBan], images, banX + 21, 533, 18, fonts);
  drawText(page, deckName(input.opponentDecks[selectedOurBan]), banX + 35, 529, 226, fonts.bold, 12);
  drawText(page, formatPercent(banWeight, 0), PAGE_WIDTH - margin - 42, 529, 30, fonts.bold, 10);

  drawText(page, "Single-game Win Rates", margin, 493, sideWidth, fonts.bold, 12);
  drawMatchupMatrix(page, input, margin, 482, sideWidth, fonts, images);
  drawText(page, "Your decks in rows · Opponent decks in columns", margin, 350, sideWidth, fonts.regular, 7.4, MUTED);
  drawLineup(page, "Your Decks", input.myDecks, margin, 325, sideWidth, fonts, images);
  drawLineup(page, "Opponent Decks", input.opponentDecks, margin, 221, sideWidth, fonts, images, selectedOurBan);
  drawText(page, "Notes", margin, 116, sideWidth, fonts.bold, 12);
  drawBox(page, margin, 26, sideWidth, 79, WHITE);

  drawText(page, "Decisions After Bans", rightX, 493, rightWidth, fonts.bold, 12);
  const sortedOpponentBans = [...result.opponentBanStrategy].sort(
    (left, right) => right.probability - left.probability || left.deck - right.deck,
  );
  const cardGap = 12;
  const cardWidth = (rightWidth - cardGap) / 2;
  sortedOpponentBans.forEach((item, position) => {
    drawDecisionCard(
      page,
      result.getPostBanSolution(selectedOurBan, item.deck),
      input,
      item.deck,
      item.probability,
      position === 0,
      rightX + (position % 2) * (cardWidth + cardGap),
      481 - Math.floor(position / 2) * 216,
      cardWidth,
      fonts,
      images,
    );
  });
  drawText(page, "Rows: your remaining decks · Columns: opponent remaining decks", rightX, 42, rightWidth, fonts.regular, 7.2, MUTED);
  drawText(page, "Each cell: match win chance, then optimal next-deck mix", rightX, 29, rightWidth, fonts.regular, 7.2, MUTED);

  return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, title: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeTitle = title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  anchor.href = url;
  anchor.download = `${safeTitle || "conquest"}-match-sheet.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
