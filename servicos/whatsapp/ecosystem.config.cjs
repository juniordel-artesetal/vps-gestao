// PM2: pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
// As variáveis ficam no arquivo .env do VPS (nunca no git) — carregadas com --env-file (Node 20.6+).
module.exports = {
  apps: [{
    name: 'soa-whatsapp',
    script: 'servidor.mjs',
    node_args: '--env-file=.env',
    max_memory_restart: '1200M',
    restart_delay: 10000,
    time: true,
  }],
}
