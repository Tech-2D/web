# Repository conventions

- Recent commit subjects use short English imperative sentences (for example, `Show recent Agenda users and access blocks`). Earlier commits also use a `feat:` prefix; follow the current style unless the project adopts a different convention.
- The existing non-main branch observed is named `codex/render-storage-endpoints`; use `codex/` followed by a short, descriptive kebab-case name for agent-created branches.
- No pull request template or prior pull requests were found when these observations were recorded. Use a concise English title and describe the change and validation in the PR body.

## Desenvolvimento no Detwo

- Ao trabalhar no workspace Detwo, siga também o `AGENTS.md` da pasta de checkouts. O índice e os modelos ficam em `docs/detwo/` no repositório `Tech-2D/api`. No layout local do Detwo, o guia está em `../api/docs/detwo/README.md` a partir de `.detwo-worktrees/web`. Em outro checkout, localize a API pelo remote e confirme a branch.
- Para uma tarefa de desenvolvimento, crie ou retome `specs/<slug>/spec.md`, `plan.md` e `tasks.md` no repo dono do comportamento. Se a tarefa já tiver spec em outro repo, faça referência a ela em vez de duplicar. Em um clone isolado, mantenha o mesmo trio: comportamento e aceite na spec, arquivos e verificação no plano, execução e evidência nas tasks.
- Confira a versão da API ou do Worker do Assistente para mudanças em contratos. As regras de escrita e autorização vivem no backend. Parta do README e das fontes de código da branch alvo.
- Depois de concluir, atualize README ou documentação oficial da área quando mudar um comportamento, contrato ou procedimento relevante. Registre o motivo em `tasks.md` quando o texto oficial já corresponder ao resultado.
