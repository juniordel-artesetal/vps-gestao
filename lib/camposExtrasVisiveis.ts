// Campos extras do pedido que a USUÁRIA vê (tela, impressão): só os de valor simples. Chaves de
// controle (_freelancers, produtos[]) e qualquer objeto/lista gravado por integração ficam de fora —
// senão o JSX/HTML imprime "[object Object]".
export function camposExtrasVisiveis(extras: Record<string, unknown> | null | undefined): [string, string][] {
  return Object.entries(extras || {})
    .filter(([k, v]) => !k.startsWith('_') && k !== 'produtos' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'))
    .map(([k, v]) => [k, String(v)])
}
