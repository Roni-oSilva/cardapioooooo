// Dados iniciais: usuário admin, configurações, mesas e um cardápio de exemplo. Seguro para rodar mais de uma vez.
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { loadEnv, sslOption } from './env.mjs';

loadEnv();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: sslOption() });
await c.connect();

const email = (process.env.SEED_ADMIN_EMAIL || 'admin@restaurante.com').toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!password || password.length < 8) { console.error('Defina SEED_ADMIN_PASSWORD (mínimo 8 caracteres).'); process.exit(1); }

const has = await c.query('SELECT 1 FROM staff_users LIMIT 1');
if (!has.rowCount) {
  await c.query('INSERT INTO staff_users(name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Administrador', email, await bcrypt.hash(password, 11), 'admin']);
  console.log('admin criado:', email);
}

const hasCats = await c.query('SELECT 1 FROM categories LIMIT 1');
if (!hasCats.rowCount) {
  await c.query(`UPDATE restaurant_settings SET name='Restaurante Premium', tagline='Cozinha autoral · Ingredientes de verdade',
    about='Uma casa dedicada ao sabor: cortes selecionados, massas feitas à mão e uma carta de vinhos escolhida a dedo. Cada prato é preparado na hora, do jeito que deve ser.',
    address='Rua das Palmeiras, 123 — Centro', phone='(11) 3000-0000', whatsapp='(11) 99999-0000',
    hours='[{"label":"Seg a Qui","hours":"12h às 23h"},{"label":"Sex e Sáb","hours":"12h à 00h"},{"label":"Domingo","hours":"12h às 17h"}]',
    ticket_footer='Bom apetite!' WHERE id=1`);
  for (let i = 1; i <= 12; i++) await c.query('INSERT INTO dining_tables(label,seats) VALUES ($1,$2) ON CONFLICT DO NOTHING', [String(i), i <= 6 ? 4 : 6]);

  const cat = {};
  const cats = ['Entradas', 'Carnes nobres', 'Peixes e frutos do mar', 'Massas artesanais', 'Risotos', 'Pratos vegetarianos', 'Sobremesas', 'Vinhos e bebidas', 'Drinks exclusivos'];
  for (const [i, n] of cats.entries()) cat[n] = (await c.query('INSERT INTO categories(name,sort_order) VALUES ($1,$2) RETURNING id', [n, i])).rows[0].id;

  const ponto = { name: 'Ponto da carne', required: true, min: 1, max: 1, opts: [['Mal passado'], ['Ao ponto para mal'], ['Ao ponto'], ['Ao ponto para bem'], ['Bem passado']] };
  const acomp = (list) => ({ name: 'Acompanhamento', required: true, min: 1, max: 1, opts: list });
  const retirar = { name: 'Retirar', required: false, min: 0, max: 5, opts: [['Sem cebola'], ['Sem alho'], ['Sem pimenta'], ['Sem coentro']] };
  const prods = [
    ['Entradas', 'Carpaccio de wagyu', 'Lâminas finas de wagyu, alcaparras, parmesão e azeite trufado.', 'Wagyu, alcaparras, parmesão, rúcula, azeite trufado', 7800, 10, ['leite'], true, []],
    ['Entradas', 'Burrata com tomates confitados', 'Burrata cremosa, tomates confitados no azeite e pesto de manjericão.', 'Burrata, tomate, manjericão, pinoli', 6400, 8, ['leite', 'castanhas'], false, []],
    ['Carnes nobres', 'Filé-mignon', 'Medalhão de filé-mignon grelhado na brasa, no ponto de sua preferência.', 'Filé-mignon, manteiga de ervas, sal grosso', 14800, 25, ['leite'], true,
      [ponto, acomp([['Risoto de funghi', 0], ['Purê de batata trufado', 0], ['Legumes salteados', 0], ['Batata rústica', 0]]),
       { name: 'Adicionais', required: false, min: 0, max: 3, opts: [['Molho da casa', 800], ['Foie gras', 3800], ['Farofa de banana', 1200]] }, retirar]],
    ['Carnes nobres', 'Ancho na brasa', 'Corte ancho maturado, selado e finalizado na brasa.', 'Ancho, sal de parrilla, chimichurri', 13200, 25, [], false, [ponto, acomp([['Batata rústica', 0], ['Legumes salteados', 0], ['Arroz biro-biro', 0]]), retirar]],
    ['Peixes e frutos do mar', 'Salmão grelhado', 'Salmão fresco grelhado, crosta de ervas e molho de maracujá.', 'Salmão, ervas, maracujá, manteiga', 11200, 20, ['peixe', 'leite'], true,
      [acomp([['Legumes', 0], ['Arroz de limão siciliano', 0], ['Purê de mandioquinha', 0]]), retirar]],
    ['Peixes e frutos do mar', 'Polvo à lagareiro', 'Polvo macio, batatas ao murro, alho e azeite extravirgem.', 'Polvo, batata, alho, azeite, coentro', 13800, 30, ['molusco'], false, []],
    ['Massas artesanais', 'Tagliatelle ao ragu', 'Massa fresca com ragu de acém cozido lentamente.', 'Farinha, ovos, acém, tomate, vinho tinto', 7800, 18, ['glúten', 'ovo'], false, [{ name: 'Adicionais', required: false, min: 0, max: 2, opts: [['Parmesão extra', 600], ['Pimenta calabresa', 0]] }]],
    ['Massas artesanais', 'Ravioli de queijo', 'Ravioli recheado de queijos nobres, manteiga e sálvia.', 'Farinha, ovos, queijos, manteiga, sálvia', 8200, 18, ['glúten', 'ovo', 'leite'], false, []],
    ['Risotos', 'Risoto de funghi', 'Arroz arbório, mix de cogumelos e finalização com parmesão.', 'Arbório, funghi, parmesão, vinho branco', 8800, 22, ['leite'], false, []],
    ['Pratos vegetarianos', 'Abóbora assada com quinoa', 'Abóbora cabotiá assada, quinoa, castanhas e tahine.', 'Abóbora, quinoa, castanhas, tahine', 6200, 18, ['castanhas', 'gergelim'], false, []],
    ['Sobremesas', 'Petit gâteau', 'Bolo quente de chocolate belga com sorvete de baunilha.', 'Chocolate, ovos, manteiga, baunilha', 3800, 15, ['glúten', 'ovo', 'leite'], true, []],
    ['Sobremesas', 'Tiramisù', 'Clássico italiano com café e mascarpone.', 'Mascarpone, café, biscoito, cacau', 3400, 5, ['glúten', 'ovo', 'leite'], false, []],
    ['Vinhos e bebidas', 'Taça de vinho tinto', 'Seleção da casa — pergunte ao garçom pelo rótulo do dia.', 'Uva', 3200, 2, [], false, []],
    ['Vinhos e bebidas', 'Água mineral', 'Com ou sem gás, 500 ml.', '', 900, 1, [], false, [{ name: 'Tipo', required: true, min: 1, max: 1, opts: [['Sem gás'], ['Com gás']] }]],
    ['Vinhos e bebidas', 'Refrigerante', 'Lata 350 ml.', '', 1000, 1, [], false, [{ name: 'Sabor', required: true, min: 1, max: 1, opts: [['Cola'], ['Guaraná'], ['Limão']] }]],
    ['Drinks exclusivos', 'Negroni', 'Gin, vermute rosso e Campari, finalizado com laranja.', 'Gin, vermute, Campari, laranja', 3800, 5, [], false, []],
  ];
  let order = 0;
  for (const [cn, name, desc, ing, price, prep, all, feat, groups] of prods) {
    const p = (await c.query(
      'INSERT INTO products(category_id,name,description,ingredients,price_cents,prep_minutes,allergens,featured,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [cat[cn], name, desc, ing, price, prep, all, feat, order++])).rows[0].id;
    for (const [gi, g] of groups.entries()) {
      const gid = (await c.query('INSERT INTO option_groups(product_id,name,required,min_select,max_select,sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [p, g.name, g.required, g.min, g.max, gi])).rows[0].id;
      for (const [oi, [on, op]] of g.opts.entries()) await c.query('INSERT INTO options(group_id,name,price_cents,sort_order) VALUES ($1,$2,$3,$4)', [gid, on, op ?? 0, oi]);
    }
  }
  console.log('cardápio de exemplo criado');
}
await c.end();
