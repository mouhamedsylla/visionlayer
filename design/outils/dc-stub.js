// Substitut local du moteur des planches .dc.html, pour les contrôler hors du canevas :
// trous {{chemin}}, <sc-for>, <sc-if>, gestionnaires d'évènements. Rien d'autre.
// La classe Component de la planche est chargée comme un script ordinaire (voir render.py).
class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(patch) { this.state = Object.assign({}, this.state, patch); window.__dcRender(); }
}

(function () {
  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const ONE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  const literal = (p) => (p === 'true' ? true : p === 'false' ? false : /^-?\d+(\.\d+)?$/.test(p) ? Number(p) : undefined);
  function lookup(path, scopes) {
    const lit = literal(path);
    if (lit !== undefined) return lit;
    const [head, ...rest] = path.split('.');
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i] && head in scopes[i]) return rest.reduce((v, k) => (v == null ? v : v[k]), scopes[i][head]);
    }
    return undefined;
  }
  const fill = (text, scopes) => text.replace(HOLE, (_, p) => { const v = lookup(p, scopes); return v == null ? '' : String(v); });
  const holeOf = (value) => { const m = (value || '').match(ONE); return m ? m[1] : null; };

  function process(node, scopes) {
    if (node.nodeType === 3) { node.textContent = fill(node.textContent, scopes); return [node]; }
    if (node.nodeType !== 1) return [node];
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      const path = holeOf(node.getAttribute('list'));
      const list = (path && lookup(path, scopes)) || [];
      const as = node.getAttribute('as') || 'item';
      const out = [];
      list.forEach((item, i) => {
        [...node.childNodes].forEach((c) => out.push(...process(c.cloneNode(true), scopes.concat([{ [as]: item, $index: i }]))));
      });
      return out;
    }
    if (tag === 'sc-if') {
      const path = holeOf(node.getAttribute('value'));
      if (!(path && lookup(path, scopes))) return [];
      const out = [];
      [...node.childNodes].forEach((c) => out.push(...process(c.cloneNode(true), scopes)));
      return out;
    }
    [...node.attributes].forEach((a) => {
      const path = holeOf(a.value);
      if (/^on[a-z]/i.test(a.name) && path) {
        const fn = lookup(path, scopes);
        node.removeAttribute(a.name);
        if (typeof fn === 'function') node.addEventListener(a.name.slice(2).toLowerCase(), fn);
      } else if (a.value.includes('{{')) node.setAttribute(a.name, fill(a.value, scopes));
    });
    [...node.childNodes].forEach((c) => {
      const res = process(c, scopes);
      if (res.length !== 1 || res[0] !== c) { res.forEach((r) => node.insertBefore(r, c)); node.removeChild(c); }
    });
    return [node];
  }

  window.addEventListener('DOMContentLoaded', () => {
    // eslint-disable-next-line no-undef
    const comp = new Component({});
    const tpl = document.getElementById('dc-tpl');
    const root = document.getElementById('dc-root');
    window.__dcRender = () => {
      const wrap = document.createElement('div');
      wrap.appendChild(tpl.content.cloneNode(true));
      process(wrap, [comp.renderVals()]);
      root.replaceChildren(...wrap.childNodes);
    };
    window.__dcRender();
  });
})();
