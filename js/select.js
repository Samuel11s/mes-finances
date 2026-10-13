'use strict';
/*
 * Dropdowns with icons. A native <select> can't show icons: it is kept
 * (value, form, events) but it is displayed with a custom button and list.
 * Usage: <select data-rich> with data-icon and (optional) data-color on each <option>.
 */

let richOpen = null;

function enhanceSelects(root = document) {
  for (const sel of root.querySelectorAll('select[data-rich]:not([data-enhanced])')) buildRich(sel);
}

function richOptionHtml(o) {
  if (!o) return '<span class="rsel-label muted">—</span>';
  return `${o.dataset.icon ? tile(o.dataset.icon, o.dataset.color, 'xs') : ''}<span class="rsel-label">${esc(o.textContent)}</span>`;
}

function buildRich(sel) {
  sel.dataset.enhanced = '1';
  const wrap = document.createElement('div');
  wrap.className = 'rsel';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add('rsel-native');
  sel.tabIndex = -1;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rsel-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  wrap.appendChild(btn);
  const paint = () => { btn.innerHTML = richOptionHtml(sel.selectedOptions[0]) + icon('chevron-down', 'rsel-chev'); };
  paint();
  // "change" is also fired when the code replaces the options: repaint.
  sel.addEventListener('change', paint);
  btn.addEventListener('click', () => (richOpen?.btn === btn ? closeRich() : openRich(sel, btn)));
}

function openRich(sel, btn) {
  closeRich();
  const host = btn.closest('dialog') || document.body;
  const pop = document.createElement('div');
  pop.className = 'rsel-pop';
  pop.setAttribute('role', 'listbox');
  const item = o => `<button type="button" role="option" class="rsel-opt ${o.selected ? 'on' : ''}" data-v="${esc(o.value)}" ${o.disabled ? 'disabled' : ''}>${richOptionHtml(o)}${o.selected ? icon('check', 'rsel-check') : ''}</button>`;
  pop.innerHTML = [...sel.children].map(n => (n.tagName === 'OPTGROUP'
    ? `<div class="rsel-group">${esc(n.label)}</div>${[...n.children].map(item).join('')}`
    : item(n))).join('');
  host.appendChild(pop);

  // Place it under the button (or above when there is no room), without leaving the screen.
  const r = btn.getBoundingClientRect();
  const width = Math.min(Math.max(r.width, 240), innerWidth - 16);
  pop.style.width = width + 'px';
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - width - 8)) + 'px';
  const below = innerHeight - r.bottom - 12, above = r.top - 12;
  const h = Math.min(pop.scrollHeight, 340);
  const down = below >= h || below >= above;
  pop.style.maxHeight = Math.min(340, down ? below : above) + 'px';
  pop.style.top = (down ? r.bottom + 4 : r.top - 4 - Math.min(h, above)) + 'px';
  pop.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  (pop.querySelector('.on') || pop.querySelector('.rsel-opt'))?.focus({ preventScroll: true });

  pop.addEventListener('click', e => {
    const o = e.target.closest('.rsel-opt');
    if (!o) return;
    sel.value = o.dataset.v;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    closeRich();
    btn.focus();
  });
  pop.addEventListener('keydown', e => {
    const opts = [...pop.querySelectorAll('.rsel-opt:not([disabled])')];
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(0, i - 1)]?.focus(); }
  });
  richOpen = { pop, btn };
}

function closeRich() {
  if (!richOpen) return;
  richOpen.pop.remove();
  richOpen = null;
}

// Close on outside click, on Escape (without closing the dialog underneath), on scroll or on resize.
document.addEventListener('pointerdown', e => { if (richOpen && !richOpen.pop.contains(e.target) && !richOpen.btn.contains(e.target)) closeRich(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && richOpen) { e.preventDefault(); e.stopPropagation(); const b = richOpen.btn; closeRich(); b.focus(); } }, true);
document.addEventListener('scroll', e => { if (richOpen && !richOpen.pop.contains(e.target)) closeRich(); }, true);
window.addEventListener('resize', closeRich);
