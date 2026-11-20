# Loja do Angola Roleplay

Site (Node + Express) com login Discord, catálogo (Diamantes e VIPs), encomendas e painel de administração.
A entrega no jogo é feita pelo resource MTA **ar_loja**, que lê a fila `store_deliveries` na mesma base de dados.

## 1. Discord (Developer Portal)
1. A tua aplicação → **OAuth2** → copia o **Client ID** e o **Client Secret**.
2. Em **Redirects** acrescenta: `https://TEU-DOMINIO/auth/callback` (tem de ser igual a `DISCORD_REDIRECT_URI`).

## 2. Railway (serviço novo, ao lado do bot)
1. New → GitHub Repo → este repositório (ou uma pasta dele).
2. Variables: preenche tudo o que está em `.env.example` (o MySQL é o MESMO do bot).
3. Settings → Networking → **Generate Domain** (ou liga o teu domínio).
4. `ADMIN_DISCORD_IDS` = o teu ID do Discord (Modo programador → botão direito no teu nome → Copiar ID).
5. Nunca ponhas o `.env` no GitHub (já está no `.gitignore`).

## 3. Servidor MTA
1. Copia a pasta `ar_loja` para `resources/`.
2. Em `config.lua`, liga os handlers `diamonds` e `vip` aos exports do teu servidor (há exemplos nos comentários).
3. `start ar_loja`. Enquanto os handlers não estiverem ligados, as compras falham com `NAO_CONFIGURADO` e podes reentregar no painel.

## 4. Pagamento
- `PAYMENT_MODE=manual` (por defeito): o jogador paga, envia a referência da transferência e um admin aprova em `/admin`.
- `PAYMENT_MODE=webhook`: o gateway chama `POST /webhook/payment` com o cabeçalho `X-Signature` (HMAC-SHA256 do corpo com `PAYMENT_WEBHOOK_SECRET`)
  e o corpo `{"reference":"AR1A2B3C4D","status":"paid","amount":2000}`. A encomenda passa a paga e a entrega começa sozinha.
  Ao escolher o gateway adapta-se `lib/payments.js` ao formato dele.

## Produtos
Criados automaticamente na primeira vez (Diamantes 100/200/500 e VIPs). Edita preços e ativa/desativa em `/admin/produtos`.
**Confirma o preço dos 500 Diamantes** (ficou 10.000 Kz como valor provisório).

## Segurança (já incluída)
Sessão assinada, proteção CSRF, consultas parametrizadas, cabeçalhos de segurança, limites de pedidos, webhook com assinatura,
aprovação de pagamento atómica (sem entregas duplicadas) e entregas interrompidas marcadas como falhadas para revisão manual.

## v0.2
- Página de produto (`/produto/<slug>`) com descrição, benefícios e "como funciona".
- Comprovativo em PDF, PNG ou JPG (até 3 MB). O tipo é verificado pelo conteúdo do ficheiro e fica guardado na base de dados
  (tabela `store_proofs`), porque o disco do Railway não é permanente. Só administradores o veem (`/admin`, "Ver ficheiro").
- Categorias: Diamantes, VIPs, Carros e Casas. Cria produtos em `/admin/produtos` → **Novo produto**
  (nome, categoria, preço, descrição, benefícios, imagem por link https e os dados de entrega em JSON).
- Dependência nova: `multer` (o Railway instala sozinho).
