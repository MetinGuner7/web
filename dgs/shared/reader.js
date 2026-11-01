/* Presentation only: never replace lesson prose, formulas, solutions or links. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero-section');
  if (!hero || document.body.classList.contains('lesson-reader')) return;
  document.body.classList.add('lesson-reader');

  // Keep decorative characters in the DOM, but remove their visual noise.
  const decoration = /^[\s\p{Extended_Pictographic}\uFE0F\u200D\u20E3✓✔]+/u;
  document.querySelectorAll('h2, .summary-title, .summary-item, .meta-item, .key-points-title, .memorize-title, .visual-title').forEach(element => {
    const first = element.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) return;
    const match = first.textContent.match(decoration);
    if (!match || !match[0].trim()) return;
    const icon = document.createElement('span');
    icon.className = 'reader-decoration';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = match[0];
    first.textContent = first.textContent.slice(match[0].length);
    element.insertBefore(icon, first);
  });

  const subjectNames = {
    matematik: 'MATEMATİK', geometri: 'GEOMETRİ', turkce: 'TÜRKÇE',
    paragraf: 'PARAGRAF', 'sayisal-mantik': 'SAYISAL MANTIK'
  };
  const subject = Object.keys(subjectNames).find(key => location.pathname.includes(`/dgs/${key}/`));
  if (subject) {
    const label = document.createElement('div');
    label.className = 'reader-subject';
    label.dataset.readerGenerated = '';
    label.textContent = subjectNames[subject];
    hero.prepend(label);
  }

  let number = 0;
  document.querySelectorAll('.content-section').forEach(section => {
    const heading = section.querySelector(':scope > h2');
    if (!heading) return;
    const index = document.createElement('span');
    index.className = 'reader-section-index';
    index.dataset.readerGenerated = '';
    index.setAttribute('aria-hidden', 'true');
    index.textContent = String(++number).padStart(2, '0');
    heading.prepend(index);
    const body = document.createElement('div');
    body.className = 'reader-section-body';
    // Moving existing nodes preserves event listeners, details state and math.
    for (const node of [...section.childNodes]) {
      if (node !== heading) body.append(node);
    }
    section.append(body);
  });

  // Wide tables scroll locally rather than widening or clipping the page.
  document.querySelectorAll('table').forEach(table => {
    const frame = document.createElement('div');
    frame.className = 'reader-table-frame';
    frame.tabIndex = 0;
    frame.setAttribute('role', 'region');
    frame.setAttribute('aria-label', 'Tablo, yatay kaydırılabilir');
    table.before(frame);
    frame.append(table);
  });
})();
