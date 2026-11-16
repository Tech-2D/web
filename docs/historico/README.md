# Histórico do site

> **Estes documentos não descrevem o estado atual.** Eles registram como o portal funcionava antes e como foi a migração do Firestore para o PostgreSQL, em outubro de 2026. Para o funcionamento atual, comece pelo [README](../../README.md).

O código exatamente como estava antes desta limpeza está na tag [`pre-limpeza`](https://github.com/Tech-2D/web/tree/pre-limpeza).

| Documento | Assunto |
| --- | --- |
| [modelo-firestore.md](modelo-firestore.md) | Coleções, regras e configuração do Firestore usados até a virada |
| [migracao-firebase-central.md](migracao-firebase-central.md) | Junção dos projetos Firebase `d-tech-56a76` e `d-tech-8555e` |
| [auditoria-privacidade-2026-10-03.md](auditoria-privacidade-2026-10-03.md) | Auditoria das regras do Firestore em 03/10/2026 |
| [copia-firestore-sql-2026-10-17.md](copia-firestore-sql-2026-10-17.md) | Cópia conferida do Firestore para o PostgreSQL |
| [virada-sql-2026-10-17.md](virada-sql-2026-10-17.md) | Adaptação do site e ativação do SQL em 17/10/2026 |
| [firestore/](firestore/) | Regras (`firestore.rules`), `firebase.json` e scripts Python de migração e publicação de regras |

Os scripts em `firestore/scripts/` foram mantidos só para consulta. Eles esperam os caminhos antigos (por exemplo, `firestore.rules` na raiz) e só funcionam a partir da tag `pre-limpeza`.

As regras em `firestore/firestore.rules` continuam publicadas no projeto Firebase `d-tech-8555e` até que um administrador as substitua por regras que negam todo acesso. O site não lê nem grava mais no Firestore; o Firebase é usado apenas para login (Authentication).
