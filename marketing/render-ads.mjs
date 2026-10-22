// Gera os criativos de anúncio (Facebook/Instagram Ads) em marketing/anuncios/
import fs from 'node:fs';
import { chromium } from '/tmp/claude-0/-home-user-cardapioooooo/df0d96d0-663d-5985-8428-be76261933b6/scratchpad/pw/node_modules/playwright-core/index.mjs';
const demo = fs.readFileSync('../demo/demo.html', 'utf8');
const fonts = demo.slice(demo.indexOf('@font-face'), demo.indexOf(':root{'));
const wave = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync('../public/wave.svg', 'utf8'));
const icon = fs.readFileSync('logo/carvex-icone.svg', 'utf8');
const img = (n) => `../assets/${n}.png`;
const logo = (h) => `<span style="display:inline-flex;align-items:center;gap:${h * 0.22}px"><span style="display:block;width:${h}px;height:${h}px">${icon}</span><span class="t" style="font-size:${h * 0.78}px;letter-spacing:.02em;line-height:1">Carvex</span></span>`;
const hl = (txt, size, extra = '') => `<div class="abs t" style="${extra};font-size:${size}px;line-height:1;white-space:nowrap;background:#f8ebd0;color:#6c170b;padding:${size * .13}px ${size * .28}px ${size * .08}px;border-radius:${size * .26}px;transform:rotate(-1.2deg)">${txt}</div>`;

const ads = {
  // 1) Quadrado 1080x1080 — ângulo "benefício"
  'anuncio-1-feed-quadrado': { w: 1080, h: 1080, body: `
<div class="abs" style="left:56px;top:44px;right:56px;display:flex;justify-content:space-between;align-items:center">${logo(74)}<span class="pill" style="font-size:20px;padding:10px 22px">Para restaurantes</span></div>
<h1 class="t abs" style="left:56px;top:160px;font-size:84px;line-height:1;white-space:nowrap">Pedido no celular,</h1>
${hl('comanda na cozinha.', 80, 'left:44px;top:256px')}
<img class="abs shadow" src="${img('phone')}" style="right:40px;top:400px;width:360px;transform:rotate(4deg);clip-path:inset(0 0 30% 0);-webkit-mask-image:linear-gradient(to bottom,#000 46%,transparent 70%)">
<img class="abs shadow" src="${img('kitchen')}" style="left:44px;top:470px;width:410px;transform:rotate(-4deg);border-radius:24px">
<div class="badge" style="left:350px;top:640px;transform:rotate(-8deg)"><div><b>Comanda<br>automática</b><small>na impressora</small></div></div>
<div class="abs" style="left:0;right:0;top:900px;text-align:center"><span class="cta t" style="font-size:44px;line-height:1">Peça uma demonstração →</span></div>
<p class="abs" style="left:0;right:0;top:1006px;text-align:center;font-size:24px;font-weight:600;opacity:.9">QR code · impressão automática · mesas · financeiro</p>` },

  // 2) Quadrado 1080x1080 — ângulo "erro de anotação"
  'anuncio-2-feed-quadrado-erro': { w: 1080, h: 1080, body: `
<div class="abs" style="left:56px;top:44px;right:56px;display:flex;justify-content:space-between;align-items:center">${logo(74)}<span class="pill" style="font-size:20px;padding:10px 22px">Para restaurantes</span></div>
<h1 class="t abs" style="left:56px;top:160px;font-size:84px;line-height:1;white-space:nowrap">Chega de pedido</h1>
${hl('anotado errado.', 84, 'left:44px;top:256px')}
<img class="abs shadow" src="${img('ticket2')}" style="left:70px;top:400px;width:320px;transform:rotate(-5deg);clip-path:inset(0 0 14% 0);-webkit-mask-image:linear-gradient(to bottom,#000 62%,transparent 86%)">
<img class="abs shadow" src="${img('kitchen2')}" style="right:44px;top:420px;width:440px;transform:rotate(3deg);border-radius:24px;clip-path:inset(0 0 34% 0 round 24px);-webkit-mask-image:linear-gradient(to bottom,#000 42%,transparent 66%)">
<div class="badge" style="left:360px;top:650px;transform:rotate(-8deg)"><div><b>Ponto e<br>observação</b><small>direto na comanda</small></div></div>
<div class="abs" style="left:0;right:0;top:900px;text-align:center"><span class="cta t" style="font-size:44px;line-height:1">Peça uma demonstração →</span></div>
<p class="abs" style="left:0;right:0;top:1006px;text-align:center;font-size:24px;font-weight:600;opacity:.9">O cliente pede no celular. A cozinha vê tudo certinho.</p>` },

  // 3) Link 1200x628 (1,91:1)
  'anuncio-3-link-1200x628': { w: 1200, h: 628, body: `
<div class="abs" style="left:56px;top:40px">${logo(64)}</div>
<h1 class="t abs" style="left:56px;top:150px;font-size:66px;line-height:1;white-space:nowrap">Pedido no celular,</h1>
${hl('comanda na cozinha.', 62, 'left:46px;top:226px')}
<p class="abs" style="left:56px;top:330px;width:560px;font-size:27px;font-weight:600;line-height:1.3">Cardápio digital completo para restaurantes.</p>
<div class="abs" style="left:56px;top:446px"><span class="cta t" style="font-size:34px;line-height:1;padding:20px 36px">Peça uma demonstração →</span></div>
<img class="abs shadow" src="${img('phone')}" style="right:40px;top:50px;width:300px;transform:rotate(4deg);clip-path:inset(0 0 32% 0);-webkit-mask-image:linear-gradient(to bottom,#000 44%,transparent 68%)">
<img class="abs shadow" src="${img('kitchen')}" style="right:250px;top:330px;width:330px;transform:rotate(-4deg);border-radius:22px">` },

  // 4) Stories/Reels 1080x1920 (zonas seguras: topo 250px e rodapé 340px livres)
  'anuncio-4-stories-1080x1920': { w: 1080, h: 1920, body: `
<div class="abs" style="left:70px;top:270px">${logo(84)}</div>
<h1 class="t abs" style="left:66px;top:410px;font-size:104px;line-height:1;white-space:nowrap">Pedido no<br>celular,</h1>
${hl('comanda na<br>cozinha.', 104, 'left:52px;top:640px;white-space:normal')}
<img class="abs shadow" src="${img('phone')}" style="right:44px;top:930px;width:400px;transform:rotate(4deg);clip-path:inset(0 0 28% 0);-webkit-mask-image:linear-gradient(to bottom,#000 48%,transparent 72%)">
<img class="abs shadow" src="${img('kitchen')}" style="left:44px;top:1000px;width:440px;transform:rotate(-4deg);border-radius:24px">
<div class="badge" style="left:360px;top:1200px;transform:rotate(-8deg)"><div><b>Comanda<br>automática</b><small>na impressora</small></div></div>
<div class="abs" style="left:0;right:0;top:1480px;text-align:center"><span class="cta t" style="font-size:46px;line-height:1">Peça uma demonstração →</span></div>` },
};

const exe = '/opt/pw-browsers/' + fs.readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium-')) + '/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--allow-file-access-from-files'] });
for (const [name, { w, h, body }] of Object.entries(ads)) {
  const html = fs.readFileSync('criativo.src.html', 'utf8').replace('/*FONTS*/', fonts).replaceAll('/*WAVE*/', wave).replace('/*MODE*/', 'ad')
    .replace('</style>', `body.ad{width:${w}px;height:${h}px}</style>`).replace('/*BODY*/', body);
  fs.writeFileSync(`anuncios/_${name}.html`, html);
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('file://' + process.cwd() + `/anuncios/_${name}.html`); await p.waitForTimeout(500);
  await p.screenshot({ path: `anuncios/${name}.png` }); await p.close();
  fs.rmSync(`anuncios/_${name}.html`);
}
await b.close();
