/* Behaviour tests for js/site.js.
 *
 *   node test/keys.test.js
 *
 * No dependencies and no browser: this stubs just enough DOM for site.js to
 * run under Node, then drives it with synthetic events. It covers the parts
 * that are easy to break by accident and impossible to eyeball -- key routing,
 * the guards that keep browser shortcuts working, command parsing, tab
 * completion, and which interactions may move the selection.
 *
 * The stub mirrors two browser behaviours the code depends on: .focus() fires
 * focusin synchronously, and offsetParent is null for a display:none element.
 */

const fs = require('fs');

const listeners = {};
function El(tag, id, attrs) {
  const self = {
    tagName: (tag || 'DIV').toUpperCase(),
    id: id || '',
    _attrs: Object.assign({}, attrs),
    textContent: '',
    open: false,
    hasAttribute: k => self._attrs[k] !== undefined,
    getAttribute: k => (self._attrs[k] === undefined ? null : self._attrs[k]),
    setAttribute: (k, v) => { self._attrs[k] = String(v); },
    removeAttribute: k => { delete self._attrs[k]; },
    children: [],
    className: '',
    _html: '',
    get innerHTML() { return self._html; },
    set innerHTML(v) { self._html = v; if (v === '') self.children = []; },
    get firstChild() { return self.children[0] || null; },
    appendChild: c => { self.children.push(c); return c; },
    querySelector: () => El('span'),
    addEventListener: (t, fn) => { (self._l = self._l || {}), (self._l[t] = self._l[t] || []).push(fn); },
    removeEventListener: () => {},
    focus: () => { LOG.push('focus:' + (self.id || self._attrs['data-label'])); doc.activeElement = self;
                   (listeners.focusin || []).forEach(fn => fn({ target: self })); },
    blur: () => { LOG.push('blur'); doc.activeElement = null; },
    scrollIntoView: o => LOG.push('scroll:' + (self.id || self._attrs['data-label']) + ':' + o.behavior),
    closest: () => (self._attrs['data-nav'] !== undefined ? self : null),
    contains: () => true,
    value: '',
    offsetParent: {},
    showModal: () => { self.open = true; LOG.push('help:open'); },
    close: () => { self.open = false; LOG.push('help:close'); }
  };
  return self;
}

const LOG = [];
const heroSec  = El('section', 'top',   { 'data-nav': '', 'data-label': 'hero' });
const aboutSec = El('section', 'about', { 'data-nav': '', 'data-label': 'about' });
const cards = ['w1', 'w2', 'w3'].map(n => El('article', '', { 'data-nav': '', 'data-label': n, 'data-nav-href': 'https://x/' + n }));
const navItems = [heroSec, aboutSec].concat(cards);
const sections = {};
['top', 'about', 'work', 'log', 'contact', 'end'].forEach(id => { sections[id] = El('section', id, {}); });
const byId = Object.assign({}, sections, {
  'theme-btn': El('button', 'theme-btn', {}),
  'theme-icon': El('span', 'theme-icon', {}),
  'copy-email': El('button', 'copy-email', { 'data-copy': 'troydaviscs@gmail.com' }),
  'help': El('dialog', 'help', {}),
  'help-close': El('button', 'help-close', {}),
  'sr-status': El('p', 'sr-status', {}),
  'path': El('span', 'path', {}), 'status-path': El('span', 'status-path', {}),
  'm-theme': El('button'), 'm-email': El('button'), 'm-top': El('button'),
  'prompt-form': El('form', 'prompt-form', {}),
  'cmd': El('input', 'cmd', {}),
  'cmd-msg': El('span', 'cmd-msg', {}),
  'cmd-menu': El('ul', 'cmd-menu', {})
});

const html = El('html', '', { 'data-theme': 'light' });
const doc = {
  documentElement: html,
  activeElement: null,
  getElementById: id => byId[id] || null,
  querySelectorAll: sel => (sel === '[data-nav]' ? navItems : []),
  querySelector: () => El('meta'),
  createElement: t => El(t),
  body: { appendChild: () => {}, removeChild: () => {} },
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  contains: () => true,
  execCommand: () => true
};
global.document = doc;
global.window = {
  open: (u) => LOG.push('open:' + u),
  matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }),
  setTimeout: () => {}, location: { href: '' }
};
global.setTimeout = () => {};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } };
global.navigator = {};
global.matchMedia = global.window.matchMedia;

eval(fs.readFileSync(require('path').join(__dirname, '..', 'js', 'site.js'), 'utf8'));

const fire = o => {
  const e = Object.assign({ defaultPrevented: false, metaKey: false, ctrlKey: false, altKey: false,
    shiftKey: false, repeat: false, isComposing: false, keyCode: 0, target: { tagName: 'BODY' },
    preventDefault() { this._pd = true; } }, o);
  listeners.keydown.forEach(fn => fn(e));
  return e;
};
const focusIn = el => listeners.focusin.forEach(fn => fn({ target: el }));

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\n-- section jump mapping (1-4) --');
[['1', 'about'], ['2', 'work'], ['3', 'log'], ['4', 'contact']].forEach(([k, want]) => {
  LOG.length = 0; fire({ key: k });
  check('key "' + k + '" jumps to #' + want, LOG.some(l => l.indexOf(want) >= 0), LOG.join(','));
});

console.log('\n-- g / G are distinguished (case sensitivity) --');
LOG.length = 0; fire({ key: 'g' });
check('g -> #top', LOG.some(l => l.indexOf('top') >= 0), LOG.join(','));
LOG.length = 0; fire({ key: 'G', shiftKey: true });
check('G (with shift) -> #end', LOG.some(l => l.indexOf('end') >= 0), LOG.join(','));

console.log('\n-- shift-bearing keys are not swallowed --');
LOG.length = 0; fire({ key: '?', shiftKey: true });
check('? opens help despite shiftKey', LOG.indexOf('help:open') >= 0, LOG.join(','));
byId.help.open = false;

console.log('\n-- modifier guard --');
[['metaKey'], ['ctrlKey'], ['altKey']].forEach(([m]) => {
  const o = { key: 't' }; o[m] = true;
  const before = html.getAttribute('data-theme');
  fire(o);
  check(m + ' held -> theme untouched', html.getAttribute('data-theme') === before);
});

console.log('\n-- typing + IME guards --');
let before = html.getAttribute('data-theme');
fire({ key: 't', target: { tagName: 'INPUT' } });
check('t inside <input> ignored', html.getAttribute('data-theme') === before);
fire({ key: 't', target: { tagName: 'DIV', isContentEditable: true } });
check('t inside contenteditable ignored', html.getAttribute('data-theme') === before);
fire({ key: 't', isComposing: true });
check('t during IME composition ignored', html.getAttribute('data-theme') === before);

console.log('\n-- repeat guard (theme strobe / photosensitivity) --');
before = html.getAttribute('data-theme');
fire({ key: 't', repeat: true });
check('held t does not toggle', html.getAttribute('data-theme') === before);
fire({ key: 't' });
check('single t does toggle', html.getAttribute('data-theme') !== before);

console.log('\n-- j/k roving selection --');
focusIn(null);
LOG.length = 0; fire({ key: 'j' });
check('j selects the first item', navItems[0].getAttribute('data-selected') !== null, LOG.join(','));
fire({ key: 'j' });
check('j advances to the second', navItems[1].getAttribute('data-selected') !== null && navItems[0].getAttribute('data-selected') === null);
fire({ key: 'k' });
check('k moves back', navItems[0].getAttribute('data-selected') !== null);
for (let i = 0; i < 12; i++) fire({ key: 'j' });
check('j clamps at the last item (no overflow)', navItems[navItems.length - 1].getAttribute('data-selected') !== null);

console.log('\n-- arrows only hijack once a selection is live --');
focusIn(null);
let e = fire({ key: 'ArrowDown' });
check('ArrowDown with no selection -> not prevented (page scrolls)', !e._pd);
fire({ key: 'j' });
e = fire({ key: 'ArrowDown' });
check('ArrowDown with selection -> prevented', !!e._pd);

console.log('\n-- dialog owns its keys while open --');
byId.help.open = true;
before = html.getAttribute('data-theme');
fire({ key: 't' });
check('t ignored while help dialog open', html.getAttribute('data-theme') === before);
byId.help.open = false;

console.log('\n-- "/" left unbound for Firefox quick-find --');
e = fire({ key: '/' });
check('/ not prevented', !e._pd);


console.log('\n-- command prompt --');
const inp = byId['cmd'], form = byId['prompt-form'], msg = byId['cmd-msg'];
const submit = v => { inp.value = v; form._l.submit.forEach(f => f({ preventDefault(){} })); };
const inpKey = o => { const ev = Object.assign({ shiftKey:false, preventDefault(){} }, o); inp._l.keydown.forEach(f => f(ev)); return ev; };

LOG.length = 0; submit('cd work');
check('"cd work" scrolls to #work', LOG.some(l => l.indexOf('work') >= 0), LOG.join(','));
LOG.length = 0; submit('cd ~');
check('"cd ~" goes to #top', LOG.some(l => l.indexOf('top') >= 0), LOG.join(','));
submit('cd nowhere');
check('unknown section errors', msg.getAttribute('data-err') !== null && /no such section/.test(msg.textContent), msg.textContent);
submit('ls');
check('"ls" lists destinations', /about/.test(msg.textContent) && /contact/.test(msg.textContent), msg.textContent);
check('"ls" clears the error flag', msg.getAttribute('data-err') === null);
submit('frobnicate');
check('unknown verb -> command not found', /command not found/.test(msg.textContent), msg.textContent);
LOG.length = 0; submit('open clara');
check('"open clara" opens the real URL', LOG.some(l => l === 'open:https://claragot.us/'), LOG.join(','));
submit('open nope');
check('"open nope" errors', /no such project/.test(msg.textContent), msg.textContent);
submit('theme dark');
check('"theme dark" sets dark', html.getAttribute('data-theme') === 'dark');
submit('theme light');
check('"theme light" sets light', html.getAttribute('data-theme') === 'light');
submit('theme purple');
check('"theme purple" errors', /light or dark/.test(msg.textContent), msg.textContent);

console.log('\n-- tab completion --');
inp.value = 'cd wo'; inpKey({ key: 'Tab' });
check('"cd wo" + Tab -> "cd work"', inp.value === 'cd work', inp.value);
inp.value = 'th'; inpKey({ key: 'Tab' });
check('"th" + Tab -> "theme "', inp.value === 'theme ', JSON.stringify(inp.value));
inp.value = 'c'; inpKey({ key: 'Tab' });
check('ambiguous "c" -> prefix kept, candidates shown in the menu',
      inp.value === 'c' && byId['cmd-menu'].children.map(li => li.firstChild.textContent).join(',') === 'cd,clear',
      inp.value + ' | ' + byId['cmd-menu'].children.map(li => li.firstChild.textContent).join(','));
inp.value = 'cd wo'; inpKey({ key: 'Tab' });
check('exact single completion closes the menu (arrows stay with history)',
      inp.value === 'cd work' && byId['cmd-menu'].getAttribute('data-open') === null);
inp.value = 'open way'; inpKey({ key: 'Tab' });
check('"open way" + Tab -> "open waypoint"', inp.value === 'open waypoint', inp.value);

console.log('\n-- history + escape --');
inp.value = ''; inpKey({ key: 'ArrowUp' });
check('ArrowUp recalls last command', inp.value.length > 0, inp.value);
const firstRecall = inp.value; inpKey({ key: 'ArrowUp' });
check('ArrowUp again goes further back', inp.value !== firstRecall, inp.value);
inpKey({ key: 'Escape' });
check('Escape clears the input', inp.value === '');

console.log('\n-- ":" focuses the prompt --');
LOG.length = 0; e = fire({ key: ':' });
check(': focuses the command input', LOG.some(l => l === 'focus:cmd'), LOG.join(','));
check(': is preventDefault-ed (no stray colon)', !!e._pd);


console.log('\n-- completion menu --');
const menu = byId['cmd-menu'];
const type = v => { inp.value = v; inp._l.input.forEach(f => f({})); };
const names = () => menu.children.map(li => li.firstChild.textContent);

type('cd ');
check('typing "cd " opens the menu', menu.getAttribute('data-open') !== null);
check('menu lists every cd target', names().join(',') === 'about,work,log,contact,~', names().join(','));
check('aria-expanded is true', inp.getAttribute('aria-expanded') === 'true');

type('cd w');
check('"cd w" filters to work', names().join(',') === 'work', names().join(','));

type('c');
check('verb position lists cd + clear', names().join(',') === 'cd,clear', names().join(','));

type('open ');
check('"open " lists projects', names().join(',') === 'waypoint,clara,instacleanser', names().join(','));

type('');
check('empty input closes the menu', menu.getAttribute('data-open') === null);
check('aria-expanded back to false', inp.getAttribute('aria-expanded') === 'false');

type('zzz');
check('no candidates -> menu stays closed', menu.getAttribute('data-open') === null);

console.log('\n-- menu owns the arrows while open --');
type('cd ');
inpKey({ key: 'ArrowDown' });
check('ArrowDown activates first option', menu.children[0].getAttribute('data-active') !== null);
check('aria-activedescendant points at it', inp.getAttribute('aria-activedescendant') === menu.children[0].id, inp.getAttribute('aria-activedescendant'));
inpKey({ key: 'ArrowDown' });
check('ArrowDown moves to second', menu.children[1].getAttribute('data-active') !== null && menu.children[0].getAttribute('data-active') === null);
inpKey({ key: 'ArrowUp' });
check('ArrowUp moves back', menu.children[0].getAttribute('data-active') !== null);
inpKey({ key: 'ArrowUp' });
check('ArrowUp from the top wraps to the end', menu.children[menu.children.length - 1].getAttribute('data-active') !== null);

console.log('\n-- accepting from the menu --');
type('cd ');
inpKey({ key: 'ArrowDown' }); inpKey({ key: 'ArrowDown' });   // -> work
LOG.length = 0;
inpKey({ key: 'Enter' });
check('Enter on "work" runs cd work', LOG.some(l => l.indexOf('work') >= 0), LOG.join(','));
check('input is cleared after accepting', inp.value === '');
check('menu closed after accepting', menu.getAttribute('data-open') === null);

type('c');
menu.children[0]._l.mousedown.forEach(f => f({ preventDefault(){} }));   // click "cd"
check('clicking a verb fills it and keeps the menu for its args', inp.value === 'cd ' && menu.getAttribute('data-open') !== null, JSON.stringify(inp.value));

console.log('\n-- escape is two-stage --');
type('cd ');
inpKey({ key: 'Escape' });
check('first Escape closes the menu only', menu.getAttribute('data-open') === null && inp.value === 'cd ', JSON.stringify(inp.value));
inpKey({ key: 'Escape' });
check('second Escape clears the input', inp.value === '');

console.log('\n-- history still reachable when no menu --');
type('');
inpKey({ key: 'ArrowUp' });
check('ArrowUp on empty input recalls history', inp.value.length > 0, inp.value);


console.log('\n-- a click must not select a whole section --');
focusIn(null);
focusIn(heroSec);                       // simulates clicking the hero whitespace
check('clicking the hero does NOT select it', heroSec.getAttribute('data-selected') === null);
focusIn(aboutSec);
check('clicking the about section does NOT select it', aboutSec.getAttribute('data-selected') === null);

focusIn(cards[0]);
check('clicking a work card still selects it', cards[0].getAttribute('data-selected') !== null);

focusIn(heroSec);
check('clicking a section clears any existing selection', cards[0].getAttribute('data-selected') === null && heroSec.getAttribute('data-selected') === null);

console.log('\n-- but j/k still selects sections --');
focusIn(null);
fire({ key: 'j' });
check('j selects the hero section', heroSec.getAttribute('data-selected') !== null);
fire({ key: 'j' });
check('j moves on to the about section', aboutSec.getAttribute('data-selected') !== null);
fire({ key: 'j' });
check('j continues into the work cards', cards[0].getAttribute('data-selected') !== null);
fire({ key: 'k' });
check('k returns to the about section', aboutSec.getAttribute('data-selected') !== null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
