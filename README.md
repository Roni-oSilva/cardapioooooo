# Cardápio Digital

Sistema completo de cardápio digital para restaurante: cardápio público com carrinho, pedidos salvos em PostgreSQL, painel administrativo, monitor de cozinha, mesas e contas, financeiro e **impressão de comandas** (navegador + agente local para impressão automática).

Identidade visual: paleta e tipografia da arte de referência — verde-floresta ondulado, creme, vinho (`#6c170b`), títulos em **Archivo** (peso 900, caixa alta) e textos em **Poppins**. Tudo está em `tailwind.config.ts` e `src/app/globals.css`.

## O que está implementado

| Área | O que faz |
|---|---|
| **Cardápio público** (`/`) | Apresentação, horários, endereço/contato, categorias, busca, destaques, produto com ingredientes, alergênicos, tempo de preparo, grupos de opções (ponto da carne, acompanhamentos, adicionais com valor), observações por prato, carrinho, mesa/retirada/entrega, confirmação com nº do pedido e página de acompanhamento (`/pedido/1001?t=…`). |
| **Pedidos** | Preço **sempre recalculado no servidor** a partir do banco; validação de opções obrigatórias/máximas, disponibilidade e janela de horário; idempotência (clique duplo/queda de rede não duplica pedido). |
| **Painel** (`/admin`) | Dashboard (faturamento, pedidos, ticket médio, em preparo, concluídos, mais vendidos, gráfico por hora/dia), pedidos com filtros e histórico, cardápio (CRUD, upload de foto, categorias, opções, indisponível/destaque/arquivar, horário), mesas e contas, financeiro + CSV, impressão, configurações, equipe, auditoria. |
| **Cozinha** (`/kitchen`) | Tela em tempo real, pedidos novos em destaque com alerta sonoro (desligável), mesa grande, itens/observações legíveis, tempo de espera, iniciar/finalizar preparo, prioridade configurável. |
| **Mesas** | Mesas livres/ocupadas, conta aberta por mesa (vários pedidos), adicionar itens, histórico, fechamento com **divisão de conta** e várias formas de pagamento, desconto com motivo e responsável. |
| **Financeiro** | Separa **registrado** (pedidos), **recebido** (pagamentos lançados) e **a receber** (contas abertas). Cancelamentos com motivo, descontos autorizados, por forma de pagamento, mais vendidos, exportação CSV. |
| **Comandas** | Via cozinha (sem preços) e via atendimento (com valores); 58 mm, 80 mm e A4; reimpressão com selo **REIMPRESSÃO**; CSS de impressão próprio. |
| **Impressão automática** | Fila no banco + agente local (`agent/print-agent.mjs`) com tentativas controladas, backoff, histórico e botão “tentar novamente”. |

## Arquitetura

```
Navegador ──► Next.js 14 (App Router, TypeScript, Tailwind)
               ├─ páginas (cardápio, painel, cozinha, comanda)
               └─ /api/*  (validação com zod, permissões, regras de negócio)
                     │
                     ▼
               PostgreSQL ── LISTEN/NOTIFY ──► SSE (/api/realtime) ──► telas da equipe
                     ▲
                     │  HTTPS + token
        Agente local de impressão ──► impressora (TCP 9100 | CUPS | /dev/usb/lp0)
```

```
db/migrations/        esquema SQL (migração versionada)
scripts/              migrate, seed, e2e (teste de integração)
agent/                agente local de impressão (Node, sem dependências)
src/lib/              regras: pedidos, preços, impressão, ESC/POS, auth, finanças
src/app/api/          rotas de API (públicas, /admin/*, /print/* do agente)
src/app/admin|kitchen|comanda|login|pedido   telas
src/components/       interface (menu/, admin/)
```

### Decisões e diferenças em relação às sugestões do briefing

* **PostgreSQL direto (driver `pg`)** em vez de Supabase: roda em qualquer lugar (VPS, Docker, Neon, Supabase Postgres via `DATABASE_URL`). Como todo acesso passa pelo servidor, não há chave de banco no navegador; **não foi usado RLS**.
* **Autenticação própria**: senha com bcrypt, cookie `httpOnly` com JWT assinado + tabela `sessions` (logout e troca de senha revogam sessões imediatamente), limitação de tentativas de login.
* **Tempo real** com `LISTEN/NOTIFY` + Server-Sent Events (precisa de servidor Node de longa duração: Docker/VPS/Railway/Render). Em ambiente *serverless* o SSE não se sustenta; as telas continuam funcionando por *polling* (10–30 s).
* **Imagens** gravadas em disco (`UPLOAD_DIR`). Em hospedagem sem disco persistente, use um volume ou troque `src/app/api/admin/upload` por S3/Supabase Storage.

## Como rodar localmente

Requisitos: Node 18.18+ e PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # preencha DATABASE_URL, AUTH_SECRET (>=32 chars), SEED_ADMIN_PASSWORD, PRINT_AGENT_TOKEN
createdb cardapio             # ou use um Postgres existente
npm run db:setup              # migrações + admin + cardápio de exemplo + 12 mesas
npm run dev                   # http://localhost:3000
```

Login da equipe: `/login` (e-mail e senha do `SEED_ADMIN_*`). **Troque a senha** criando seu usuário em *Equipe* e desativando o de exemplo.

Produção local: `npm run build && npm start`.

### Variáveis de ambiente (`.env.example`)

| Variável | Para quê |
|---|---|
| `DATABASE_URL` / `DATABASE_SSL` | Conexão PostgreSQL (`DATABASE_SSL=require` em provedores gerenciados). |
| `AUTH_SECRET` | Segredo de assinatura das sessões (≥ 32 caracteres, `openssl rand -hex 32`). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Usuário admin criado por `npm run db:seed`. |
| `PRINT_AGENT_TOKEN` | Token compartilhado com o agente de impressão (`openssl rand -hex 24`). |
| `UPLOAD_DIR` | Pasta persistente das fotos. |
| `COOKIE_SECURE` | `false` só para uso em rede local sem HTTPS (padrão em produção: `true`). |

Nenhuma chave secreta vai para o navegador; `.env` está no `.gitignore`.

## Perfis de acesso

| Perfil | Acesso |
|---|---|
| Administrador | Tudo, inclusive usuários e configurações. |
| Gerente | Cardápio, financeiro, impressão, descontos, cancelamentos, auditoria. |
| Garçom | Pedidos, mesas e contas (não autoriza desconto). |
| Cozinha | Monitor da cozinha e andamento dos pedidos (não cancela). |

As permissões são checadas **no servidor** em cada rota (`src/lib/permissions.ts`); o middleware só barra quem não tem sessão.

## Fluxo de um pedido

1. Cliente confirma → `POST /api/orders` com IDs/quantidades/opções (nunca preços) e uma chave de idempotência.
2. Servidor valida tudo, calcula o total, grava pedido, itens, opções e histórico em **uma transação**, vincula à conta da mesa.
3. Se há impressoras ativas, enfileira uma via por impressora e o pedido fica **Aguardando impressão**; sem impressoras fica **Recebido** e a comanda sai pelo botão “Imprimir comanda”.
4. O pedido aparece na hora no painel e na cozinha (SSE).
5. O agente imprime e informa o resultado. Só com confirmação o job vira **Impresso** e o pedido volta de “Aguardando impressão” para “Recebido”. Falhas ficam registradas, são reagendadas (10 s, 30 s, 1 min, 2 min, 5 min; 5 tentativas) e, esgotadas, ficam como **Falha** com botão “Tentar novamente”.
6. Cozinha: Recebido → Em preparação → Pronto → Entregue (ou Cancelado, com motivo).
7. Pagamento: fechamento da conta registra os pagamentos; só isso conta como faturamento recebido.

## Impressão de comandas

### 1) Pelo navegador (sempre disponível)
No pedido, **🖨 Imprimir comanda** abre `/comanda/<id>?via=cozinha|atendimento&paper=58|80|a4`, com CSS de impressão próprio (`@page`), sem menus nem botões. Escolha a impressora no diálogo do navegador. Para impressão sem diálogo, abra o Chrome com `--kiosk-printing` no computador do caixa (opcional).

### 2) Impressão automática (agente local)
Impressão silenciosa exige um programa na máquina/rede da impressora — o navegador não pode fazer isso sozinho. O agente (`agent/print-agent.mjs`, Node 18+, sem dependências) consulta o servidor, imprime e reporta.

```bash
# no computador do restaurante
mkdir cardapio-agent && cp agent/print-agent.mjs cardapio-agent/ && cd cardapio-agent
cp ../.env.agent.example .env.agent     # SERVER_URL, PRINT_AGENT_TOKEN (igual ao do servidor)
node print-agent.mjs
```

Cadastre a impressora em **Painel → Impressão** (via cozinha/atendimento, 58/80 mm/A4, destino):

| Destino | Quando usar |
|---|---|
| `tcp://192.168.0.50:9100` | Térmica de rede (Epson, Elgin, Bematech, Daruma… porta 9100). |
| `cups:NOME_DA_FILA` | Impressora instalada no CUPS (Linux/macOS), inclusive A4. |
| `file:/dev/usb/lp0` | Térmica USB no Linux (usuário no grupo `lp`). |

Para manter o agente sempre ligado use `docs/agente-impressao.service` (systemd), pm2 ou o Agendador de Tarefas do Windows.

**O que significa “impresso” (confirmação confiável).** O sistema não marca como impresso sem confirmação do agente:

* **TCP**: antes de imprimir consulta o status ESC/POS (`DLE EOT 1` offline e `DLE EOT 4` papel). Offline ou sem papel ⇒ falha, nada é enviado e o job é reagendado. Depois envia os dados e só reporta sucesso se a impressora/conexão aceitou tudo sem erro. Impressoras que não respondem a status são aceitas no modo padrão (registrado como “sem resposta de status”); use `PRINT_CONFIRM=status` para exigir resposta.
* **CUPS**: o job precisa sair da fila **e** constar como concluído; se travar em 60 s é cancelado (evita impressão duplicada tardia) e conta como falha.
* **/dev/usb/lp0**: confirma a gravação no dispositivo.

Nenhum desses métodos prova que o papel saiu fisicamente (isso nenhuma impressora térmica comum informa); eles garantem aceitação e ausência de erro. O nível de confirmação fica gravado em cada tentativa.

Segurança do agente: autentica com token; destinos `file:` só são aceitos em `/dev/` (ou na pasta de `ALLOW_FILE_DIR`, para testes), pois o conteúdo da comanda inclui texto digitado por clientes.

**Impressoras térmicas**: o texto é enviado em CP850 (acentos em português). Se sair caractere errado, a impressora usa outra página de código — ajuste `ESC t n` em `src/lib/escpos.ts`.

## Testes

```bash
npm run build
npm test      # cria o banco cardapio_test, sobe o servidor e roda ~110 verificações
```

O teste (`scripts/e2e.mjs`) cobre: autenticação/permissões, criação de pedido (total do servidor ignora preço do cliente, opções obrigatórias, 8 envios simultâneos ⇒ 1 pedido), fila de impressão, **o agente real** gravando ESC/POS em arquivo, falha → backoff → esgotar → tentar de novo, reimpressão, **impressora TCP simulada** (online/offline/sem papel/sem resposta), **CUPS simulado**, páginas de comanda, status, cozinha, mesa com conta compartilhada, divisão de pagamento, desconto, cancelamento, financeiro e dashboard calculados do banco, CSV, upload (recusa arquivo falso), disponibilidade por horário, auditoria, SSE e logout.

Não foi possível testar com uma impressora física neste ambiente: TCP/CUPS foram validados contra simuladores do protocolo. Faça um pedido de teste na sua impressora antes de abrir o restaurante.

## Publicação

**Docker (recomendado)**

```bash
cp .env.example .env     # defina POSTGRES_PASSWORD, AUTH_SECRET, SEED_ADMIN_PASSWORD, PRINT_AGENT_TOKEN
docker compose up -d --build
docker compose exec app node scripts/seed.mjs   # uma vez
```

Coloque atrás de um proxy HTTPS (Caddy/Nginx/Traefik). O contêiner aplica migrações ao iniciar. Faça backup do volume `pgdata` e de `uploads`. (O `Dockerfile` e o compose não puderam ser executados neste ambiente de desenvolvimento.)

**VPS sem Docker**: `npm ci && npm run build && npm run db:migrate && npm start` com `pm2`/systemd e proxy HTTPS.

**Importante em proxy**: desative buffering para `/api/realtime` (o app já envia `X-Accel-Buffering: no`).

## Segurança (resumo)

Validação com zod em toda entrada; consultas parametrizadas; preços do servidor; senhas bcrypt; sessões revogáveis; cookie `httpOnly`+`SameSite=Lax`+JSON obrigatório (anti-CSRF); limite de tentativas de login e de pedidos por IP; upload validado por conteúdo (assinatura do arquivo) e nome aleatório; CSV protegido contra injeção de fórmulas; log de auditoria (login, preço alterado, cancelamento, desconto, reimpressão, usuários, configurações).

## Limitações conhecidas

* O pedido de mesa é público por número da mesa (padrão de cardápio por QR): quem souber a URL pode lançar itens naquela mesa. A equipe vê todos os pedidos e pode cancelar. Para endurecer, gere um token por mesa.
* Limites de taxa ficam em memória do processo (use Redis/proxy se rodar várias instâncias).
* Entrega: taxa fixa; sem cálculo por distância nem rastreio.
* Não há integração de pagamento online; o pagamento é registrado pela equipe.
* O logotipo aparece nas comandas do navegador; nas térmicas via agente é impresso apenas o nome do restaurante (imagens ESC/POS dependem do modelo).
* Descrições e fotos do cardápio de exemplo são fictícias; envie as fotos reais pelo painel.
