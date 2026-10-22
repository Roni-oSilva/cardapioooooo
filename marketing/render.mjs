// Gera feed.png (1080x1350) e os arquivos de logo a partir de criativo.src.html e logo/carvex-icone.svg
import fs from 'node:fs';
import { chromium } from '/tmp/claude-0/-home-user-cardapioooooo/df0d96d0-663d-5985-8428-be76261933b6/scratchpad/pw/node_modules/playwright-core/index.mjs';
const demo = fs.readFileSync('../demo/demo.html', 'utf8');
const fonts = demo.slice(demo.indexOf('@font-face'), demo.indexOf(':root{'));
const wave = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync('../public/wave.svg', 'utf8'));
const icon = fs.readFileSync('logo/carvex-icone.svg', 'utf8').replace(/<\?xml.*?\?>/, '');
const img = (n) => `assets/${n}.png`;
const logo = (h, color = '#f8ebd0') => `<span style="display:inline-flex;align-items:center;gap:${h * 0.22}px"><span style="display:block;width:${h}px;height:${h}px">${icon}</span><span class="t" style="font-size:${h * 0.78}px;letter-spacing:.02em;color:${color};line-height:1">Carvex</span></span>`;

const feed = `
<div class="abs" style="left:56px;top:48px;right:56px;display:flex;justify-content:space-between;align-items:center">${logo(78)}<span class="pill" style="font-size:21px;padding:11px 24px">Para restaurantes</span></div>
<h1 class="t abs" style="left:56px;top:180px;font-size:84px;line-height:1;white-space:nowrap">Pedido no celular,</h1>
<div class="abs t" style="left:44px;top:276px;font-size:80px;line-height:1;white-space:nowrap;background:#f8ebd0;color:#6c170b;padding:12px 24px 8px;border-radius:22px;transform:rotate(-1.2deg)">comanda na cozinha.</div>
<p class="abs" style="left:56px;top:424px;width:760px;font-size:31px;font-weight:600;line-height:1.3;opacity:.95">O cardápio digital completo do seu restaurante, do pedido por QR code ao caixa.</p>
<img class="abs shadow" src="${img('phone')}" style="right:36px;top:520px;width:400px;transform:rotate(4deg);clip-path:inset(0 0 22% 0)">
<img class="abs shadow" src="${img('kitchen')}" style="left:40px;top:640px;width:430px;transform:rotate(-4deg);border-radius:24px">
<div class="badge" style="left:372px;top:850px;transform:rotate(-8deg)"><div><b>Comanda<br>automática</b><small>na impressora</small></div></div>
<div class="panel abs" style="left:44px;right:44px;top:1070px;padding:30px 38px 0;height:236px">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 24px">
    <div class="feat" style="font-size:27px"><i>✓</i>Cardápio por QR code</div><div class="feat" style="font-size:27px"><i>✓</i>Monitor de cozinha</div>
    <div class="feat" style="font-size:27px"><i>✓</i>Mesas e divisão de conta</div><div class="feat" style="font-size:27px"><i>✓</i>Dashboard e financeiro</div>
  </div>
</div>
<div class="abs" style="left:0;right:0;top:1226px;text-align:center"><span class="cta t" style="font-size:40px;line-height:1">Peça uma demonstração <span style="font-size:42px">→</span></span></div>
`;

const exe = '/opt/pw-browsers/' + fs.readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium-')) + '/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--allow-file-access-from-files'] });
{
  const html = fs.readFileSync('criativo.src.html', 'utf8').replace('/*FONTS*/', fonts).replaceAll('/*WAVE*/', wave).replace('/*MODE*/', 'feed').replace('/*BODY*/', feed);
  fs.writeFileSync('feed.html', html);
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto('file://' + process.cwd() + '/feed.html'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'feed.png' }); await p.close();
}
// logos (PNG com fundo transparente, 2x)
for (const [name, body, w, h, bg] of [
  ['carvex-icone', `<div style="width:512px;height:512px">${icon}</div>`, 512, 512, 'transparent'],
  ['carvex-logo-escuro', logo(160), 760, 200, '#143a2c'],
  ['carvex-logo-claro', logo(160, '#6c170b'), 760, 200, '#f8ebd0'],
]) {
  const html = `<!doctype html><meta charset=utf-8><style>${fonts}*{margin:0}body{background:${bg};width:${w}px;height:${h}px;display:grid;place-items:center}.t{font-family:'Archivo Variable',Impact,sans-serif;font-stretch:86%;font-weight:900;text-transform:uppercase}</style>${body}`;
  fs.writeFileSync(`logo/_${name}.html`, html);
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('file://' + process.cwd() + `/logo/_${name}.html`); await p.waitForTimeout(300);
  await p.screenshot({ path: `logo/${name}.png`, omitBackground: bg === 'transparent' }); await p.close();
  fs.rmSync(`logo/_${name}.html`);
}
await b.close();
