# TICKET: guarda de chave de criptografia ausente (falha silenciosa)

**Status:** aprovado, **não executar agora** — depois da fase do webhook Asaas.
**Aberto em:** 22/07/2026 · **Urgência:** baixa (mina desarmada, ver "Contexto")
**Fora do commit** de `feat/pagamento-asaas` — frente separada.

---

## 🎯 O PROBLEMA

Quando a env da chave de criptografia falta, o sistema **falha em silêncio**:

```
getKey() → null
  → encryptToken() → null
    → lib/logistica/config.ts:67  "conectado" = ${!!p.accessTokenCripto}  →  false
```

Na prática: a artesã completa o OAuth do Melhor Envio, é redirecionada de volta
com aparência de sucesso, e a conta fica **desconectada sem nenhuma mensagem**.
Ela tenta de novo, dá o mesmo "sucesso", e continua desconectada. É o pior tipo
de bug para um público leigo: nada indica o que houve nem o que fazer.

Existe uma função `temChaveCripto()` escrita exatamente para prevenir isso —
e **nenhum chamador em todo o código**. A guarda foi projetada e nunca ligada.

## 📍 ONDE

| Arquivo | Env esperada | Fallback |
|---|---|---|
| `lib/logistica/cripto.ts` | `LOGISTICA_TOKEN_KEY` | `CPF_ENCRYPTION_KEY` |
| `lib/googledrive/cripto.ts` | `GOOGLE_DRIVE_TOKEN_KEY` | `NEXTAUTH_SECRET` |
| `lib/pagamento/asaas/cripto.ts` | `ASAAS_TOKEN_KEY` | `LOGISTICA_TOKEN_KEY`, `CPF_ENCRYPTION_KEY` |

Consumidores afetados: `lib/logistica/melhorenvio.ts` (tokens OAuth),
`app/api/integracoes/config/route.ts`, `app/api/whatsapp/config/route.ts`,
`lib/googledrive/index.ts`, `lib/pagamento/asaas/config.ts`.

## 🩹 CONTEXTO — por que a urgência caiu

Diagnóstico em produção (22/07/2026, somente leitura): as cinco tabelas de
credencial estão **vazias** — `LogisticaConfig`, `IntegracaoLoja`,
`WhatsappConfig`, `GoogleDriveConfig`, `AsaasConfig`. Nenhuma conta foi conectada
em produção, então nada quebrou até hoje.

Em 22/07 foram criadas na Vercel `LOGISTICA_TOKEN_KEY` e `GOOGLE_DRIVE_TOKEN_KEY`
(Preview + Production), o que **desarma a mina**. O ticket segue valendo porque a
falha silenciosa volta a qualquer momento: chave removida, renomeada, um ambiente
novo criado sem ela, ou um provedor futuro que esqueça de configurá-la.

Nota: `lib/googledrive/cripto.ts` cai em `NEXTAUTH_SECRET`, que sempre existiu na
Vercel — o Google Drive **nunca** esteve quebrado. Com a chave dedicada criada, o
par passou a ser independente do `NEXTAUTH_SECRET` (rotacionar o secret do
NextAuth deixa de tornar os tokens do Drive ilegíveis).

## ✅ O QUE FAZER

1. Chamar `temChaveCripto()` **antes** de qualquer fluxo que vá cifrar, e devolver
   erro claro em vez de gravar `null`:
   - início do OAuth (não deixar a pessoa percorrer o fluxo inteiro para falhar no fim)
   - `PUT` das rotas de config que cifram credencial
2. Mensagem em português, para leiga, dizendo que é **configuração do sistema** e
   não erro dela — algo como *"A conexão está temporariamente indisponível. Avise
   o suporte (código: CRIPTO)."* Nunca citar nome de env na tela.
3. `console.error` com prefixo `[CRIPTO]` nomeando a env ausente (log é interno).
4. Sinalizar no `/master` que a chave está ausente, para o problema ser visto antes
   de a artesã esbarrar nele.
5. Considerar unificar as três cripto (`logistica`, `googledrive`,
   `pagamento/asaas`) num único `lib/cripto.ts` parametrizado por env — hoje são
   três cópias do mesmo AES-256-GCM com o mesmo formato `v1:iv:tag:dados`.

## ⚠️ CUIDADO

Trocar o valor de uma chave torna **ilegível** tudo que foi cifrado com a anterior.
Hoje isso é inócuo (tabelas vazias). Depois que houver credencial gravada, qualquer
rotação exige plano de recifragem — e a guarda deste ticket não cobre isso.
