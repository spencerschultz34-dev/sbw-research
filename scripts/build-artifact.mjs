// Builds a single-page bundle for the claude.ai preview link: dist-artifact/index.html + app.js + app.css
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = 'dist-artifact'
mkdirSync(out, { recursive: true })
await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  outfile: `${out}/app.js`,
  define: { __ARTIFACT__: 'true', 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
  legalComments: 'none',
})
writeFileSync(`${out}/index.html`, `<title>SBW Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="app.css">
<style>html,body,#root{height:100%}:root{padding:0!important;color-scheme:dark}body{margin:0;background:#0c0e11}</style>
<div id="root"></div>
<script src="app.js"></script>
`)
console.log('built', out)
