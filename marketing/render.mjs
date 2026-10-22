// Gera feed.png (1080x1350) e story.png (1080x1920) a partir de criativo.src.html
import fs from 'node:fs';
import { chromium } from '/tmp/claude-0/-home-user-cardapioooooo/df0d96d0-663d-5985-8428-be76261933b6/scratchpad/pw/node_modules/playwright-core/index.mjs';
const demo = fs.readFileSync('../demo/demo.html', 'utf8');
const fonts = demo.slice(demo.indexOf('@font-face'), demo.indexOf(':root{'));
const wave = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync('../public/wave.svg', 'utf8'));
const img = (n) => `assets/${n}.png`;
const feed = `
<div class="abs" style="left:64px;top:58px"><span class="pill">Para restaurantes</span></div>
<h1 class="t abs" style="left:60px;top:126px;font-size:158px">Cardápio<br>digital</h1>
<p class="abs" style="left:64px;top:436px;width:560px;font-size:38px;font-weight:600;line-height:1.22">Do pedido no celular até a<br><span style="background:#f8ebd0;color:#6c170b;padding:0 12px;border-radius:10px;font-weight:700">comanda na cozinha.</span></p>
<img class="abs shadow" src="${img('phone')}" style="right:44px;top:470px;width:410px;transform:rotate(4deg)">
<img class="abs shadow" src="${img('kitchen')}" style="left:44px;top:600px;width:420px;transform:rotate(-4deg);border-radius:24px">
<div class="badge" style="left:372px;top:818px;transform:rotate(-8deg)"><div><b>Comanda<br>automática</b><small>na impressora</small></div></div>
<div class="panel abs" style="left:48px;right:48px;top:1050px;padding:36px 40px 0;height:250px">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 26px">
    <div class="feat"><i>✓</i>Cardápio por QR code</div><div class="feat"><i>✓</i>Monitor de cozinha</div>
    <div class="feat"><i>✓</i>Mesas e divisão de conta</div><div class="feat"><i>✓</i>Dashboard e financeiro</div>
  </div>
</div>
<div class="abs" style="left:0;right:0;top:1240px;text-align:center"><span class="cta t" style="font-size:42px;line-height:1">Peça uma demonstração <span style="font-size:44px">→</span></span></div>
`;
const story = `
<div class="abs" style="left:70px;top:236px"><span class="pill" style="font-size:28px">Para restaurantes</span></div>
<h1 class="t abs" style="left:66px;top:318px;font-size:172px">Cardápio<br>digital</h1>
<p class="abs" style="left:70px;top:660px;width:900px;font-size:42px;font-weight:600;line-height:1.25">Seu cliente pede pelo celular.<br>A cozinha recebe e <span style="background:#f8ebd0;color:#6c170b;padding:0 12px;border-radius:10px;font-weight:700">imprime a comanda</span><br>sozinha.</p>
<img class="abs shadow" src="${img('phone')}" style="right:50px;top:880px;width:390px;transform:rotate(4deg);clip-path:inset(0 0 24% 0)">
<img class="abs shadow" src="${img('kitchen')}" style="left:44px;top:960px;width:430px;transform:rotate(-4deg);border-radius:24px">
<div class="badge" style="left:372px;top:1175px;transform:rotate(-8deg)"><div><b>Comanda<br>automática</b><small>na impressora</small></div></div>
<div class="panel abs" style="left:56px;right:56px;top:1380px;padding:34px 44px;height:196px">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 24px"><div class="feat" style="font-size:28px"><i>✓</i>QR code na mesa</div><div class="feat" style="font-size:28px"><i>✓</i>Monitor de cozinha</div><div class="feat" style="font-size:28px"><i>✓</i>Divisão de conta</div><div class="feat" style="font-size:28px"><i>✓</i>Financeiro real</div></div>
</div>
<div class="abs" style="left:0;right:0;top:1550px;text-align:center"><span class="cta t" style="font-size:44px;line-height:1">Peça uma demonstração →</span></div>
`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/' + fs.readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium-')) + '/chrome-linux/chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
for (const [mode, body, h] of [['feed', feed, 1350], ['story', story, 1920]]) {
  const html = fs.readFileSync('criativo.src.html', 'utf8').replace('/*FONTS*/', fonts).replaceAll('/*WAVE*/', wave).replace('/*MODE*/', mode).replace('/*BODY*/', body);
  fs.writeFileSync(`${mode}.html`, html);
  const p = await b.newPage({ viewport: { width: 1080, height: h } });
  await p.goto('file://' + process.cwd() + `/${mode}.html`); await p.waitForTimeout(500);
  await p.screenshot({ path: `${mode}.png` }); await p.close();
}
await b.close();
