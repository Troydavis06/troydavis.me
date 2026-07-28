# troydavis.me

Personal site. A terminal interface, set on paper.

**Live:** [troydavis.me](https://troydavis.me)

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies —
one stylesheet, one script, and IBM Plex Mono. Deployed on Vercel, which serves
the repo root as-is.

## Running it

```sh
python -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly works too. `site.js` is a classic script rather
than a module specifically so that `file://` keeps working.

```sh
node test/keys.test.js         # behaviour tests, no dependencies
```

## Layout

```
index.html          the site
css/main.css        every style: tokens, both themes, all components
js/site.js          theme, scroll-spy, clipboard, help dialog, key nav, prompt
test/keys.test.js   behaviour tests for site.js
writing/            two finished articles, not yet linked from the front page
resume.html         placeholder
assets/             favicon, apple touch icon, og card
albums.html         older page, unlinked but still reachable by URL
instacleanser/      separate hosted site — do not touch
```

## Things that will bite you

These are the non-obvious constraints. Most of them look like arbitrary style
choices until they break.

**The font does not have box-drawing characters.** IBM Plex Mono's latin subset
covers `U+0000–00FF`, `U+2000–206F` and a short list of singletons — but not
`U+2500–257F` (`┌ ─ │`), not `U+2580–259F` (block elements), and not `→`
(`U+2192`). Any of those falls back per-glyph to a different font with a
different advance width, which breaks the character grid it is supposed to sit
on and renders as tofu on Android. So: the panes are drawn with CSS borders, the
corner ticks are gradient slivers on a pseudo-element, the blinking cursor is a
styled box, and arrows are written `->` in ASCII. **`↑` and `↓` are safe** —
they are explicit singletons in the subset. Check new copy against that range.

**`1ch` is exactly `0.6em`.** Verified against the TTF and in-browser, identical
at every weight. Everything aligned — the key/value blocks, the log table, the
completion menu — is a CSS grid with `ch` tracks, and that only holds if you:

- set `font-size` on the grid *container*, never on individual cells;
- use a **length** for `line-height` (`1.5rem`), never a ratio — a ratio
  re-multiplies against each cell's own font-size, so a 13px cell inside a 15px
  block lands at 20.8px and drifts off the baseline;
- never apply `letter-spacing` inside a `ch` grid, since `1ch` is the advance
  *without* tracking;
- put `minmax(0, 1fr)` on any value track — a bare `1fr` has `min-width: auto`,
  and one long unbreakable token (an email, a URL) will blow the grid past the
  viewport.

**Sections must not have `padding-top`.** `scrollIntoView` targets the border
box, so any top padding becomes dead space above the heading when you jump to a
section, and uneven padding makes each section land at a different height.
Spacing comes from the preceding block's `padding-bottom`.

**Selecting a section is a keyboard-only concept.** Sections carry
`tabindex="-1"` so that jumping to one is announced to a screen reader — which
also means clicking anywhere inside one, including empty space, focuses it. So
sections paint no focus style at all, and `site.js` sets `[data-selected]` on
them only while it is moving focus itself (the `programmaticFocus` flag). Cards
and log rows are small and deliberate, so those still track focus normally.

**Burnt orange fails contrast at text size.** `#bf5700` is 4.07:1 on paper.
It lives on as `--brand` for large type and non-text marks, where it clears the
3:1 threshold. Anything at text size — links, labels, focus rings — uses
`--accent` (`#a34700`, 5.38:1). Don't swap one for the other without checking.

**Themes never appear in the CSS.** An inline script in `<head>` resolves
`localStorage` → system preference → a concrete `data-theme` before first paint,
so the stylesheet holds exactly two color blocks and no `prefers-color-scheme`.
It must stay synchronous and inline; deferring it is a visible flash of the
wrong theme. Without JS the site is light and fully styled.

**The keyboard layer is an enhancement.** `j/k`, `enter`, `g/G`, `1`–`4`, `t`,
`c`, `?`, `:`. Everything it reaches is also reachable by mouse, touch, Tab and
a screen reader — in particular, a card's `data-nav-href` must always point at
somewhere a visible link inside that card also goes.

**`--radius` is `0` and stays `0`.**

## The prompt

`:` focuses the command line in the status bar, which is real: `cd <section>`,
`open <project>`, `ls`, `theme [light|dark]`, `help`. A menu above it lists what
can go in the current position. Tab completes to the longest common prefix; the
arrows drive the menu while it is open and walk history when it is closed;
Escape closes the menu first and clears the line second. Unknown input gets a
specific error rather than silence. It is hidden on coarse pointers, where there
is no physical keyboard, and everything it does is also reachable by clicking.

**Adding a section means touching five places** — `index.html`, the topbar nav,
`SECTIONS` in `site.js` (which also drives the `1`–`4` keys), `DESTS` /
`DEST_NAMES`, and the help dialog. Adding a project means `index.html` and
`PROJECTS`. `test/keys.test.js` will catch the `site.js` half if you forget.

## Adding a project

Copy an existing `<article class="work">`. It needs `data-nav tabindex="-1"` to
join the `j/k` cycle, a `data-nav-href` duplicating one of its visible links, a
`work__meta` line (`year · tech · status`), and a `work__lead` span for the
dotted leader. Add it to `PROJECTS` in `site.js` so `open <name>` finds it.

## History

The previous hero was a WebGL "hook 'em horns" hand — a signed distance field of
smooth-min blended capsules, meshed with marching tetrahedra and rendered as a
drifting plexus of 860 points. It never shipped, and it is kept at:

```sh
git show sphere-hand-v1:js/sphere.js
```
