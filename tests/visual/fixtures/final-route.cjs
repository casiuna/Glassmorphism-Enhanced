// UI layout samples, explicitly manual; never network measurements.
/* global document, getComputedStyle, innerWidth */
const SCENARIOS = {
  'short-three': { unicom: '9929', telecom: 'CN2', mobile: 'CMI' },
  'full-names': { unicom: '10099 -> 4837', telecom: 'CN2 GIA', mobile: 'CMIN2' },
  'two-items': { unicom: '10099 → 4837', telecom: 'CTGNET' },
  'long-wrap': { unicom: '10099 -> 4837 → 10099 / Mixed', telecom: 'CN2 GIA / CTGNET / 国内出口备用线路', mobile: 'CMIN2 / CMNET / 多段路径手动说明' },
  'single-token': { telecom: `CTGNET-${'W'.repeat(50)}` },
}
const ORDER = ['unicom', 'telecom', 'mobile']
// The final public preview has exactly these two administrator layout samples.
// Keep SCENARIOS above for existing extreme-input and partial-result tests.
const PREVIEW_SCENARIOS = {
  'short-three': { unicom: '9929', telecom: 'CN2', mobile: 'CMI' },
  'full-names': { unicom: '10099→9929', telecom: 'CN2GIA', mobile: 'CMIN2' },
}
// Serialized into the real browser by evaluate(). No external/module state.
function auditSummary(element) {
  const root = element.getBoundingClientRect()
  const card = element.closest('[role="button"]').getBoundingClientRect()
  const entries = [...element.querySelectorAll('[data-return-carrier]')]
  const labels = Array.from(element.querySelectorAll('[data-route-label]'), (label) => {
    const style = getComputedStyle(label)
    const text = label.textContent
    const textNode = label.firstChild
    const rects = []
    let clippedCharacters = 0
    for (let i = 0; i < text.length; i++) {
      if (!text[i].trim())
        continue
      const range = document.createRange()
      range.setStart(textNode, i)
      range.setEnd(textNode, i + 1)
      const r = range.getBoundingClientRect()
      rects.push({ top: r.top, left: r.left, right: r.right, bottom: r.bottom })
      if (r.width <= 0 || r.left < root.left - 1 || r.right > root.right + 1 || r.top < root.top - 1 || r.bottom > root.bottom + 1 || r.left < card.left - 1 || r.right > card.right + 1 || r.bottom > card.bottom + 1)
        clippedCharacters++
    }
    return { text, textOverflow: style.textOverflow, overflowX: style.overflowX, overflowY: style.overflowY, whiteSpace: style.whiteSpace, lineClamp: style.webkitLineClamp, clippedCharacters, lines: new Set(rects.map(r => Math.round(r.top * 4) / 4)).size }
  })
  const entryStyles = entries.map((e) => {
    const s = getComputedStyle(e)
    return { background: s.backgroundColor, border: s.borderTopWidth }
  })
  return {
    text: element.textContent,
    labels,
    entryStyles,
    carriers: entries.map(e => e.dataset.returnCarrier),
    markerClasses: Array.from(element.querySelectorAll('[data-carrier-marker]'), e => e.className),
    markerColors: Array.from(element.querySelectorAll('[data-carrier-marker]'), e => getComputedStyle(e).backgroundColor),
    rows: new Set(entries.map(e => Math.round(e.getBoundingClientRect().top))).size,
    height: root.height,
    width: root.width,
    fontSize: getComputedStyle(element).fontSize,
    columnGap: getComputedStyle(element).columnGap,
    cardHeight: card.height,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    textOverflowModes: Array.from(element.querySelectorAll('*'), e => getComputedStyle(e).textOverflow),
  }
}
// Independent browser-serializable grid geometry, not an approximate CSS check.
function auditGrid(element) {
  const root = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const column = { unicom: 1, telecom: 2, mobile: 3 }
  const rect = (node) => {
    const r = node.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
  }
  const cells = Array.from(element.querySelectorAll('[data-return-carrier]'), (cell) => {
    const group = cell.querySelector('[data-route-group]')
    const label = cell.querySelector('[data-route-label]')
    const marker = cell.querySelector('[data-carrier-marker]')
    const c = rect(cell)
    const g = rect(group)
    const l = rect(label)
    const m = rect(marker)
    let clippedCharacters = 0
    const tops = new Set()
    for (let i = 0; i < label.textContent.length; i++) {
      if (!label.textContent[i].trim())
        continue
      const range = document.createRange()
      range.setStart(label.firstChild, i)
      range.setEnd(label.firstChild, i + 1)
      const r = range.getBoundingClientRect()
      tops.add(Math.round(r.top * 4) / 4)
      if (r.width <= 0 || r.left < c.left - 0.1 || r.right > c.right + 0.1 || r.top < c.top - 1 || r.bottom > c.bottom + 1)
        clippedCharacters++
    }
    return {
      carrier: cell.dataset.returnCarrier,
      column: getComputedStyle(cell).gridColumnStart,
      cell: c,
      group: g,
      marker: m,
      label: l,
      text: label.textContent,
      lines: tops.size,
      clippedCharacters,
      centerError: Math.abs((g.left + g.right - c.left - c.right) / 2),
      positionError: Math.abs(c.left - root.left - (column[cell.dataset.returnCarrier] - 1) * root.width / 3),
      markerNameGap: l.left - m.right,
      markerCenterError: Math.abs((l.top + l.bottom - m.top - m.bottom) / 2),
      groupInsideCell: g.left >= c.left - 0.1 && g.right <= c.right + 0.1,
    }
  })
  return {
    display: style.display,
    columns: style.gridTemplateColumns.split(' ').map(Number.parseFloat),
    columnGap: style.columnGap,
    root: rect(element),
    cells,
    maxWidthDelta: Math.max(...cells.map(c => c.cell.width)) - Math.min(...cells.map(c => c.cell.width)),
    sameLabelTop: new Set(cells.map(c => Math.round(c.label.top * 4) / 4)).size === 1,
    overlap: cells.some((c, i) => i > 0 && cells[i - 1].group.right > c.group.left + 0.1),
  }
}
module.exports = { SCENARIOS, PREVIEW_SCENARIOS, ORDER, auditSummary, auditGrid }
