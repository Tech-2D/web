# Tech 2D

Site principal da comunidade Tech 2D. A navegação entre as áreas fica no topo de cada página. [Agenda](https://tech-2d.github.io/web/) · [Professores](https://tech-2d.github.io/web/professores/) · [Notas](https://tech-2d.github.io/web/notas/) · [Kanban](https://tech-2d.github.io/web/#kanban)

O [perfil](https://tech-2d.github.io/web/perfil/) tem uma página própria para editar os dados pessoais e consultar a comunidade. O ícone de perfil no cabeçalho abre essa rota em todas as áreas.

Todas as áreas exigem login. Os formulários de criação de conta usam `src/registration.ts` e a rota de cadastro do servidor. O domínio permitido fica em um secret privado do backend. Endereços recusados recebem uma mensagem genérica, sem informar a regra. Login e recuperação continuam aceitando as contas existentes.

Consulte [a estrutura e a transição dos links antigos](docs/unificacao-site.md). Um único `npm run build` gera todo o site: `/` abre a agenda, `/professores/` abre os horários e `/notas/` abre a calculadora de notas.

A calculadora de notas foi criada por Arakaki e integrada a partir de `Tech-2D/pegaki`. Sua [licença MIT](docs/pegaki/LICENSE) e [documentação original](docs/pegaki/README.md) estão preservadas. O código fica em `src/pegaki/`, incluindo os testes de cálculo e leitura do boletim. A página **Minhas notas** abre na turma padrão do portal e usa as disciplinas de sua grade. As notas são salvas automaticamente no caderno da conta por ano letivo. A importação das notas locais é explícita e os PDFs continuam no dispositivo.

A área de Notas usa a paleta do site e as preferências `agenda:theme` e `agenda:neon`. O menu do portal dá acesso às configurações de aparência e acessibilidade.

## Arquitetura

- **Frontend:** React, TypeScript, Vite e Tailwind, publicado no GitHub Pages.
- **Login:** Firebase Authentication (projeto `d-tech-8555e`). O Firebase não guarda mais os dados do site.
- **Dados:** API [Tech-2D/api](https://github.com/Tech-2D/api) no Cloudflare Workers, com PostgreSQL. O endereço fica em [`src/apiBase.ts`](src/apiBase.ts). O modelo de dados está documentado em [Tech-2D/database](https://tech-2d.github.io/database/).
- **Anexos, perfis, resumo semanal e recuperação de senha:** serviços do [Tech-2D/auth-email](https://github.com/Tech-2D/auth-email) na Vercel. O cadastro usa o Worker `tech-2d-consultas`.

O site ainda usa funções no formato do Firestore (`doc`, `collection`, `onSnapshot`), mas [`src/dataClient.ts`](src/dataClient.ts) envia todas as leituras e gravações para `POST /api/data`. O SDK do Firestore não é carregado.

O histórico da migração do Firestore para o PostgreSQL está em [docs/historico](docs/historico/README.md).

## Agenda da turma

Calendário mensal com tarefas, lições, trabalhos e eventos por turma. Representantes e o superadministrador criam, editam e excluem atividades.

Passe o mouse sobre um dia com atividades (ou foque nele pelo teclado) para ler o conteúdo completo sem sair do calendário. No celular, toque no dia para abrir os detalhes.

Depois de entrar como representante ou superadministrador, abra um dia no calendário e clique em **Editar atividade**. O representante pode alterar atividades da própria turma, inclusive as publicadas por outro representante da mesma turma. Somente o superadministrador pode editar outras turmas e eventos gerais. Ao salvar, a tela volta ao calendário. Editar uma ocorrência semanal não modifica o modelo das próximas semanas.

Na administração, a seção **Professores** permite ao superadministrador criar, editar e excluir aulas em **Grade de horários**, ou importar a grade em **Importar horários por JSON**. A grade abrange todas as turmas, incluindo as que ainda não têm Agenda. Para gerar esse JSON a partir da planilha da escola, use `scripts/generate-schedules.py`.

Para virar representante, a pessoa entra em **Sou representante > Solicitar acesso**, informa e-mail e turma e guarda o código da solicitação. O superadministrador aprova ou recusa na aba **Representantes**.

> **Atenção:** sem confirmação por e-mail, quem souber um endereço aprovado pode cadastrar uma senha para esse endereço antes do titular. Aprove solicitações somente quando você conhece e confia em quem as enviou.

### Tarefas que se repetem

Na área do representante, marque **Repetir toda semana** ao cadastrar uma atividade. A data escolhida vira a primeira ocorrência; o campo **Repetir até** é opcional. A aba **Repetições** mostra os agendamentos da turma e permite pausá-los, reativá-los ou excluí-los. Excluir encerra a série e remove imediatamente as ocorrências de hoje em diante, preservando o histórico anterior. O modelo fica marcado como excluído, sem opção de reativar; se a limpeza falhar, ele permanece pausado na lista para uma nova tentativa. Cada ocorrência pode ser editada individualmente em **Atividades**, mas o modelo semanal permanece igual.

As ocorrências são criadas pela API, acionada a cada seis horas pelo repositório privado [`Tech-2D/agenda-recorrencias`](https://github.com/Tech-2D/agenda-recorrencias). Ela gera até oito semanas à frente e não duplica atividades.

### Expurgo de atividades antigas

Na aba **Expurgo**, o representante define um prazo de 30 a 730 dias para a própria turma ou mantém a limpeza desligada. A regra abrange tarefas, lições, trabalhos, provas e eventos da turma; eventos gerais e outras turmas não são afetados. A tela mostra uma estimativa das atividades que já se enquadram no prazo e pede confirmação para ativar. Toda regra nova ou alterada espera 24 horas antes da primeira exclusão.

A exclusão é feita pela API, acionada diariamente pelo repositório privado [`Tech-2D/agenda-expurgo`](https://github.com/Tech-2D/agenda-expurgo). A API remove os anexos do R2 antes de excluir a atividade. Não há cópia de segurança da atividade expurgada.

### Anexos

O formulário pode anexar até cinco PDF, DOCX, PPTX, ZIP ou imagens de até 50 MB cada. Os arquivos ficam no bucket R2 privado `tech-2d-agenda`; a atividade guarda apenas os metadados. Somente o representante da turma ou o superadministrador pode enviar e remover anexos. Anexos de repetições ainda não são suportados. ZIPs não são descompactados no servidor. A interface só aparece com `VITE_ATTACHMENTS_ENABLED=true`.

### Quadro de avisos

A Agenda lê os avisos da turma em `GET /api/catalog/notices?class=…`. Representantes gerenciam os avisos da própria turma e superadministradores podem gerenciar os de qualquer turma. O e-mail do autor fica restrito à área administrativa. Cada publicação expira em sete dias.

## Rodar localmente

O [AGENTS.md](AGENTS.md) descreve o fluxo de desenvolvimento por tarefa e indica onde encontrar o índice do ecossistema.

Use Node.js 22 ou mais recente.

```bash
npm ci
npm run dev
```

O site usa a API de produção. Ela só libera CORS para `https://tech-2d.github.io`, então, em desenvolvimento, crie um `.env.local` (baseado em `.env.example`) com:

```
VITE_API_URL=/tech2d-api
```

O proxy de `vite.config.ts` repassa essas chamadas ao Worker. As leituras funcionam com a sua conta. As gravações continuam exigindo a origem do site publicado e são recusadas em desenvolvimento.

O `.env.local` também pode sobrescrever a configuração pública do Firebase, já embutida em `src/firebase.ts`. Variáveis `VITE_*` vão para o JavaScript público: nunca coloque senhas ou chaves privadas nelas.

## Configuração da publicação

O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) testa, verifica e publica o site no GitHub Pages a cada push na `main`. Em **Settings > Pages**, a fonte deve ser **GitHub Actions**.

| Nome | Tipo | Uso |
| --- | --- | --- |
| `VITE_FIREBASE_*` | Secret | Configuração pública do Firebase (opcional; há valores padrão em `src/firebase.ts`) |
| `VITE_PASSWORD_RESET_API_URL` | Secret | Endpoint de recuperação de senha do auth-email |
| `VITE_ATTACHMENTS_ENABLED` | Variável | `true` mostra os anexos de atividades |
| `VITE_PEGAKI_CLOUD_GRADES` | Variável | `true` salva as notas na conta |
| `VITE_API_URL` | Variável | Opcional; aponta o site para outra API |

## Comandos

```bash
npm run dev        # desenvolvimento
npm run test       # testes
npm run lint       # análise estática
npm run typecheck  # checagem de tipos
npm run build      # build de produção
```
