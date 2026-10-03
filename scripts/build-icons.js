// Renders icons/icon.svg to the PNG icons the manifest and iOS need, each game's icon.svg to its shortcut icon,
// and icons/og.svg to the link preview (og.png, 1200 x 630). The fonts are embedded so the preview text uses them.
// Needs playwright. Run: node scripts/build-icons.js
const fs = require('fs');
const path = require('path');
const launch = require('./browser');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'icons');
const fonts = path.join(root, 'fonts');
const font = (family, weight, file) => `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(fonts, file)).toString('base64')}) format("woff2")}`;
const fontCss = font('Bricolage Grotesque', '500 700', 'bricolage-grotesque-latin.woff2') + font('IBM Plex Mono', 500, 'ibm-plex-mono-500-latin.woff2');
// The maskable icon is full bleed (Android crops it); iOS rounds the corners of the touch icon and wants no
// transparency, so it uses the full-bleed one too.
const out = {
  'icon-192.png': ['icons/icon.svg', 192, 192],
  'icon-512.png': ['icons/icon.svg', 512, 512],
  'icon-maskable-192.png': ['icons/icon-maskable.svg', 192, 192],
  'icon-maskable-512.png': ['icons/icon-maskable.svg', 512, 512],
  'apple-touch-icon.png': ['icons/icon-maskable.svg', 180, 180],
  'og.png': ['icons/og.svg', 1200, 630],
};
for (const g of fs.readdirSync(path.join(root, 'games'))) {
  if (fs.existsSync(path.join(root, 'games', g, 'icon.svg'))) out[`${g}-192.png`] = [`games/${g}/icon.svg`, 192, 192];
}
(async () => {
  const b = await launch();
  for (const [name, [src, w, h]] of Object.entries(out)) {
    const svg = fs.readFileSync(path.join(root, src), 'utf8');
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(`<style>${fontCss}html,body{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(dir, name) });
    await p.close();
    console.log(`${name} (${w}x${h})`);
  }
  await b.close();
})();
