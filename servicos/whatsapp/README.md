# Serviço WhatsApp do SOA

Serviço companheiro que **envia WhatsApp** pelo número dedicado do SOA, usando [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js) (WhatsApp Web + Chromium). Ele roda **num VPS**: não roda na Vercel, que é serverless e não mantém o Chromium aberto 24 h. O SOA só **chama** o serviço, pelo `enviar()` em `lib/whatsapp/index.ts`.

> ⚠️ **WhatsApp não-oficial = risco de ban.** Use um número **dedicado**, nunca o pessoal da Naty. Comece com um piloto pequeno e aumente o volume aos poucos. Se o número for banido, troque o provedor (Cloud API oficial, Z-API…) reimplementando só o `enviar()` do SOA; nenhum gatilho muda.

## O que o serviço faz

| Rota | Proteção | Para quê |
|---|---|---|
| `POST /send` `{ para, mensagem }` | `x-ws-secret` | Põe a mensagem na **fila** e responde `202 { ok, id, posicao }` |
| `GET /send/:id` | `x-ws-secret` | Status do envio: `na-fila`, `enviando`, `enviado` ou `erro` (`numero_sem_whatsapp`…) |
| `GET /health` | aberta | `{ conectado, ultimaConexao, fila, aguardandoQr }`; com o segredo, mostra também o número |
| `GET /qr` | `x-ws-secret` | Página com o QR para escanear (1ª vez, ou quando a sessão cai) |

- **Fila anti-ban:** um envio por vez, com espera **aleatória** de 5 a 15 s entre eles. O número é conferido no WhatsApp antes do envio (`getNumberId`), o que também acerta o 9º dígito.
- **Opt-out:** quando alguém responde **PARAR**, o serviço repassa para o SOA (`SOA_ENTRADA_URL` → `/api/whatsapp/entrada`). O SOA grava em `WhatsappOptOut`, e o serviço responde confirmando. A partir daí, o SOA não manda mais nada para aquele número.
- **Reconexão:** se cair, tenta de novo em 10 s. O PM2 reinicia o processo se ele morrer.

## Deploy (VPS Linux, ~2 GB de RAM)

```bash
# 1) Node 20+ e as libs do Chromium (Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs chromium fonts-noto-color-emoji \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libgtk-3-0
sudo npm i -g pm2

# 2) Só esta pasta do repositório
git clone --depth 1 --filter=blob:none --sparse https://github.com/juniordel-artesetal/vps-gestao.git soa
cd soa && git sparse-checkout set servicos/whatsapp && cd servicos/whatsapp
npm ci || npm install

# 3) Configuração (NUNCA commitar o .env)
cp env.exemplo .env
openssl rand -hex 32      # cole em WHATSAPP_SERVICE_SECRET (o MESMO valor vai na Vercel)
nano .env                 # CHROME_PATH=/usr/bin/chromium, se usar o Chromium do sistema

# 4) Subir e escanear o QR (uma vez)
pm2 start ecosystem.config.cjs && pm2 logs soa-whatsapp   # o QR aparece no log
#    WhatsApp do número dedicado → Aparelhos conectados → Conectar aparelho
#    (ou abra GET /qr com o header x-ws-secret)
pm2 save && pm2 startup
```

**Expor com HTTPS:** coloque Caddy ou nginx na frente, por exemplo `whatsapp.usesoa.com.br` → `localhost:3080`. A URL pública vai na Vercel.

**Backup da sessão:** guarde a pasta `.wwebjs_auth/`. Sem ela, é preciso escanear o QR de novo.

## Ligando no SOA (Vercel → Environment Variables)

| Variável | Valor |
|---|---|
| `WHATSAPP_SERVICE_URL` | `https://whatsapp.usesoa.com.br` (a URL do serviço) |
| `WHATSAPP_SERVICE_SECRET` | o mesmo segredo do `.env` do VPS |
| `WHATSAPP_PILOTO` | ids das contas do piloto, separados por vírgula (vazio = todas) |
| `WHATSAPP_LIMITE` | máximo de lembretes por rodada (padrão 30) |
| `WHATSAPP_ATIVO` | **`off`** até o piloto; `on` liga os envios |

## Teste rápido

```bash
S=<segredo>; U=https://whatsapp.usesoa.com.br
curl $U/health
curl -X POST $U/send -H "x-ws-secret: $S" -H 'content-type: application/json' \
  -d '{"para":"5511999999999","mensagem":"Teste do SOA ✅"}'
# → {"ok":true,"id":"…","posicao":1}  — e depois:  curl -H "x-ws-secret: $S" $U/send/<id>
```

Depois, no SOA, rode a prévia do lembrete (não envia nada):

```bash
curl -X POST "https://www.usesoa.com.br/api/cron/lembrete-cobranca?seco=1" -H "x-master-token: <MASTER_SECRET_TOKEN>"
```
