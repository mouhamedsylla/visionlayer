// Contrôle de lisibilité d'une planche rendue : texte qui déborde, éléments qui se chevauchent,
// cadres qui défilent. Renvoie la hauteur de la planche et la liste des défauts.
(() => {
  const out = [];
  const name = (el) => (el.closest('.rep, .cell, .st, section, .vl-stat, nav')?.querySelector('.code, h3, .vl-label, h2')?.textContent || '?').trim().slice(0, 30);
  const text = '.n, .pill, .tag, .a span, .lbl, .ref, .claim, .rf, td, th, .chip, .vl-tag, .vl-ref, .vl-btn, .vl-nav, .vl-pill, .vl-stat__note, .vl-att__title, .vl-att__sub, .vl-label, .node, .cap h3, .cap p, code, .blk, .bh b, .bm, .mk, .a em, .tb, .vl-lbl, .seg, .fx, .lane';
  document.querySelectorAll(text).forEach((el) => {
    const cs = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') out.push(`coupé · ${name(el)} · ${el.textContent.trim().slice(0, 50)}`);
    else if (el.scrollWidth > el.clientWidth + 1) out.push(`déborde · ${name(el)} · ${el.textContent.trim().slice(0, 50)}`);
  });
  document.querySelectorAll('.fig, .spec, .pic').forEach((f) => {
    if (f.scrollWidth > f.clientWidth + 1 && !f.querySelector('.code-b')) out.push(`sort du cadre · ${name(f)} (${f.scrollWidth} > ${f.clientWidth})`);
  });
  const boxes = '.n, .pill, .tag, .step, .chip, .vl-tag, .vl-ref, .vl-btn, .vl-method, .vl-count, .node, .vl-tile, .blk, .mk, .tb, .a em, .vl-lbl, .seg';
  document.querySelectorAll('.rep, .cell, .st, section, .vl-card, .vl-stat, nav, header').forEach((card) => {
    const els = [...card.querySelectorAll(boxes)].filter((e) => e.getBoundingClientRect().width > 0);
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
      const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)
        out.push(`chevauche · ${name(card)} · ${els[i].textContent.trim().slice(0, 20)} / ${els[j].textContent.trim().slice(0, 20)}`);
    }
  });
  return { hauteur: Math.ceil(document.querySelector('.vl').getBoundingClientRect().height), defauts: [...new Set(out)] };
})();
