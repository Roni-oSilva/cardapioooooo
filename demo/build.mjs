// Gera demo/demo.html (arquivo único, sem dependências externas) embutindo fontes e o padrão ondulado.
import fs from 'node:fs';
const nm = '../node_modules';
const b64 = (p) => fs.readFileSync(p).toString('base64');
const face = (family, file, weight, extra = '') =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;${extra}src:url(data:font/woff2;base64,${b64(file)}) format('woff2')}`;
const fonts = [
  face('Archivo Variable', `${nm}/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2`, '100 900', 'font-stretch:62% 125%;'),
  face('Poppins', `${nm}/@fontsource/poppins/files/poppins-latin-400-normal.woff2`, 400),
  face('Poppins', `${nm}/@fontsource/poppins/files/poppins-latin-600-normal.woff2`, 600),
  face('Poppins', `${nm}/@fontsource/poppins/files/poppins-latin-700-normal.woff2`, 700),
].join('\n');
const wave = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync('../public/wave.svg', 'utf8'));
const html = fs.readFileSync('demo.src.html', 'utf8').replaceAll('/*FONTS*/', fonts).replaceAll('/*WAVE*/', wave);
fs.writeFileSync('demo.html', html);
console.log('demo.html', (html.length / 1024).toFixed(0), 'KB');
