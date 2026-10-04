// Substituto do built-in "module" do Node no bundle do NAVEGADOR (next.config.ts → turbopack.resolveAlias).
// O harfbuzzjs só faz `import("module")` no ramo Node (ENVIRONMENT_IS_NODE), que nunca roda no navegador;
// sem isto o Turbopack não consegue montar o bundle do cliente.
export function createRequire(): never {
  throw new Error('createRequire não existe no navegador')
}
export default { createRequire }
