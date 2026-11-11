# agent-desktop-rebuild

```text
                                    ◆
                               ·  · ◆ ◆ ·  ·
                            ·        ◆        ·
                       ·  ───────  · ◆ ·  ───────  ·
                    ·            ╱ ╲   ╱ ╲            ·
                  ·            ╱     ╲ ╱     ╲            ·
                ◆ ─────────── ◆   A ─ ◆ ─ D   ◆ ─────────── ◆
                  ·            ╲     ╱ ╲     ╱            ·
                    ·            ╲ ╱   ╲ ╱            ·
                       ·  ───────  · ◆ ·  ───────  ·
                            ·        ◆        ·
                               ·  · ◆ ◆ ·  ·
                                    ◆

                      a g e n t ─ d e s k t o p
                            r e b u i l d
```

Recriação do [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop): uma ferramenta de *computer use* para agentes de IA que **enxerga e opera** interfaces pela **árvore de acessibilidade** (como um leitor de tela), em vez de depender de screenshots e matching de pixels.

Este projeto entrega duas frentes:
- **Desktop (CLI):** interface de linha de comando no mesmo modelo do original — `snapshot` → agir em *refs* → `snapshot` para verificar — com envelope JSON estruturado.
- **Browser (sem screenshot):** versão para navegador que **lê o código/estrutura acessível da página** via Chrome DevTools Protocol (CDP), usando `Accessibility.getFullAXTree` (árvore AX). Nada de captura de pixels: a página é lida como tecnologia assistiva para pessoas com deficiência visual faz.

## O que é o agent-desktop (conceito)

O agent-desktop original expõe a árvore de acessibilidade nativa (AX no macOS, UI Automation no Windows, AT-SPI no Linux) como JSON, atribuindo um **ref qualificado por snapshot** a cada elemento acionável (ex.: `@s8f3k2p9:e8`). O agente:

1. **Observa:** `snapshot` captura a árvore e devolve refs.
2. **Age:** `click`, `type`, `focus`, `set-value`, etc. operam sobre um ref daquele snapshot.
3. **Verifica:** um novo `snapshot` confirma o resultado.

Refs pertencem ao snapshot que os gerou; quando a UI muda, ações retornam `STALE_REF`/`AMBIGUOUS_TARGET` e o agente re-observa. O loop fica no agente — a ferramenta não embute LLM.

## Como esta recriação funciona

### Browser (3d) — árvore de acessibilidade, sem screenshot
- Conecta a uma instância do Chrome/Chromium com depuração remota (CDP, porta configurável, padrão `9222`).
- Habilita `Accessibility`, `DOM` e `Runtime` e obtém a árvore completa com `Accessibility.getFullAXTree`.
- Constrói uma árvore de nós (role, name, description, value, estados) e atribui refs qualificados aos elementos interativos, persistindo o *refmap* do snapshot em `~/.agent-desktop` (ou `AGENT_DESKTOP_HOME`).
- Resolve ações pelo `backendDOMNodeId` do nó (via `DOM.resolveNode` + Runtime/Input): `click`, `focus`, `type`/insert, `set-value`, `clear`, `get`, etc. **Sem captura de imagem.**

### Desktop (2b) — CLI e contrato
- CLI `agent-desktop` com a superfície de comandos do original (observação, ações em ref, teclado/mouse, apps/janelas, clipboard, wait, sessão/trace/cursor-overlay/sandbox, skills, batch, MCP).
- **Envelope JSON (v2.6):** `{ "version", "ok", "command", "data"? , "error"? }`. Erros carregam `code`, `message`, `suggestion?`, `recovery?`, `details?` e `disposition { delivery, retry }`.
- **MCP:** servidor stdio que expõe cada comando como tool `desktop_*`, retornando o envelope do comando.
- **Adapters de desktop nativo:** estruturados para macOS (AX), Windows (UIA) e Linux (AT-SPI). Neste host o caminho plenamente funcional/validado é o browser via CDP; adapters nativos podem retornar `PLATFORM_NOT_SUPPORTED`/`ACTION_NOT_SUPPORTED` quando o backend da plataforma não está disponível aqui.

## Requisitos

- Node.js >= 18
- Google Chrome/Chromium acessível por CDP para automação de sites:
  ```bash
  google-chrome --remote-debugging-port=9222
  ```

## Instalação e build

```bash
git clone <este-repo>
cd agent-desktop-rebuild
npm install
npm run build
```

## Uso (CLI)

```bash
# status e versão
node dist/index.js status
node dist/index.js version

# snapshot da árvore de acessibilidade da página ativa (sem screenshot)
node dist/index.js snapshot --interactive
node dist/index.js snapshot --app "Título ou URL"

# agir em refs qualificados do snapshot
node dist/index.js click      @sXXXXXXXX:e4
node dist/index.js focus      @sXXXXXXXX:e3
node dist/index.js type       @sXXXXXXXX:e3 "texto"
node dist/index.js set-value  @sXXXXXXXX:e3 "valor"
node dist/index.js get        @sXXXXXXXX:e4 name

# busca, skills e MCP
node dist/index.js find --name "Submit"
node dist/index.js skills list
node dist/index.js skills get desktop
node dist/index.js mcp   # servidor MCP (stdio), tools desktop_*
```

Flags globais relevantes: `--cdp-port <n>` (default 9222), `--session`, `--agent-id`, `--headed`, `--trace`, `--wait-for`, `--wait-for-gone`, `--wait-timeout-ms`.

## Contrato de refs e erros (resumo)

- Refs são **qualificadas por snapshot**: `@s<snapshot_id>:eN`. Um ref puro `@eN` é rejeitado (`INVALID_ARGS`).
- Em `STALE_REF` ou `AMBIGUOUS_TARGET`, capture um novo snapshot e use os refs dele. Repetir uma ação só é seguro quando `error.disposition.retry` for `"safe"`.
- Códigos de erro: `PERM_DENIED, ELEMENT_NOT_FOUND, APP_NOT_FOUND, ACTION_FAILED, ACTION_NOT_SUPPORTED, STALE_REF, AMBIGUOUS_TARGET, WINDOW_NOT_FOUND, PLATFORM_NOT_SUPPORTED, TIMEOUT, INVALID_ARGS, NOTIFICATION_NOT_FOUND, SNAPSHOT_NOT_FOUND, SANDBOX_NOT_FOUND, POLICY_DENIED, APP_UNRESPONSIVE, INTERNAL`.

## Estrutura do projeto

- `src/core/response` — envelope, códigos de erro, disposition/recovery
- `src/core/refs` — tokens de ref qualificados e ref store/snapshots
- `src/core/adapter` — interface de adapter/plataforma
- `src/adapters/browser` — adapter CDP/Chrome (árvore AX, sem screenshot)
- `src/adapters/{linux,macos,windows}` — adapters desktop (estruturais)
- `src/dispatch` — roteamento de comandos
- `src/cli` — CLI
- `src/mcp` — servidor MCP (stdio)
- `dist/` — saída compilada

## Licença e origem

Recriação inspirada em [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) (Apache-2.0). Este repositório implementa o mesmo modelo de observação-ação por árvore de acessibilidade/ref, com ênfase em uma versão de browser que lê a árvore AX da página (acessibilidade) sem screenshots.
