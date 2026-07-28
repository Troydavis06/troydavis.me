# troydavis.me

Personal site. A terminal interface, set on paper.

**Live:** [troydavis.me](https://troydavis.me)

---

### Stack

- HTML + CSS, no framework, no build step
- IBM Plex Mono, the only typeface
- One stylesheet, one script
- Deployed on Vercel

### Structure

```
index.html          the site
css/main.css        all styles: tokens, both themes, every component
js/site.js          theme, scroll-spy, clipboard, help dialog, key nav
writing/            article pages (not linked from the front page yet)
resume.html         placeholder
assets/             favicon, touch icon, og card
albums.html         older page, still reachable by URL
instacleanser/      separate hosted site — do not touch
```

### Notes

**Themes.** Light is the primary design; dark is a tuned inversion. An inline
script in `<head>` resolves localStorage, then system preference, into a
concrete `data-theme` before first paint — so the CSS carries two color blocks
and no `prefers-color-scheme` at all. Without JS the site is light and fully
styled.

**No box-drawing characters.** IBM Plex Mono's latin subset does not cover
U+2500–257F, so any box-drawing glyph would fall back per-glyph to another font
with a different advance width and break the character grid it is meant to sit
on. CSS borders do the structure instead. Same reason `->` is written in ASCII:
U+2192 isn't in the font either. If you add copy, keep it inside the covered
ranges.

**The character grid.** `1ch` is exactly `0.6em` here. Anything using `ch`
tracks must set `font-size` on the grid container rather than on the cells, must
use a length for `line-height` (a ratio re-multiplies per cell and drifts off
the baseline), and must never apply `letter-spacing` inside the grid.

**Keyboard navigation** (`j/k`, `enter`, `g/G`, `1`–`4`, `t`, `c`, `?`) is an
enhancement. Everything it reaches is also reachable by mouse, touch, Tab, and
a screen reader.

**The prompt in the status bar is real.** `:` focuses it. It understands
`cd <section>`, `open <project>`, `ls`, `theme [light|dark]`, and `help`; Tab
completes the word you're typing (to the longest common prefix, listing the
candidates when ambiguous), the arrow keys walk history, and anything it does
not understand gets an error rather than silence. It is hidden on touch, where
there is no physical keyboard to drive it. Everything it can do is also
reachable by clicking.

### History

The previous hero was a WebGL "hook 'em horns" hand — a signed distance field
of smooth-min blended capsules, meshed with marching tetrahedra and rendered as
a drifting plexus. It never shipped, and it's kept at:

```
git show sphere-hand-v1:js/sphere.js
```
