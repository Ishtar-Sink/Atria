# Estudo: dashboard do Atria

Estudo de referências e recomendação para o dashboard geral do Atria (RF-22 e RF-23 da SPEC-001), feito a partir do protótipo da TASK-01.

## Pergunta

Qual é a melhor forma de organizar o dashboard de um hub pessoal que consolida tudo "sem poluir a tela" e que tem como premissa trazer calma, e não maximizar a produtividade?

## O que o protótipo faz hoje

- **Cinco blocos de peso igual:** Saldo total, Próximas movimentações, Tarefas e lembretes de hoje, Leituras em andamento e Última entrada do diário, numa grade `repeat(auto-fit, minmax(300px, 1fr))`.
- **Vãos entre os cartões:** a grade alinha as linhas, então um cartão curto ao lado de um longo deixa um buraco embaixo. No print de 30/10, "Saldo total" e "Tarefas e lembretes de hoje" terminam muito antes de "Próximas movimentações".
- **Vão à esquerda:** o conteúdo tem largura máxima de 1120 px e fica centralizado. Numa tela de 1920 px, sobram uns 400 px vazios entre a sidebar e o primeiro cartão.
- **Ordem que contradiz o propósito:** o primeiro bloco, e o maior número da tela, é o saldo em reais. O diário, que a spec chama de "um dos pontos centrais", é o último e só mostra a entrada anterior.
- **Nenhuma hierarquia:** todos os cartões têm o mesmo tamanho e o mesmo destaque, então a tela não diz o que importa primeiro.

## Referências

| Fonte | O que ensina | Como se aplica ao Atria |
|---|---|---|
| Calm technology (Weiser e Brown; Amber Case) | A tecnologia deve informar sem exigir atenção, ficando na periferia, e mostrar o mínimo necessário. Sinais fortes ficam para o que é urgente de verdade. | O dashboard mostra estado, não cobra. Nada de contadores de atraso, vermelho ou números grandes onde não há urgência ([project/frontend-14]). |
| Tela "Hoje" de planejadores calmos (Sunsama, Things) | O dia começa por um recorte pequeno e realizável. Adiar faz parte do ritual, não é uma falha. | O centro do dashboard é "hoje", com poucos itens. Tarefas não feitas aparecem como "pode ficar para amanhã", não como atraso. |
| Dashboards para leitura num relance (Stephen Few; NN/g sobre atributos pré-atentivos) | Cabe numa tela, responde à pergunta principal num relance, usa posição e tamanho para hierarquia, não usa cor para magnitude e prefere barras e linhas simples. | Um bloco principal maior e alguns secundários menores. O tamanho e a posição dizem o que importa, sem cor de alarme. |
| Bento grid x masonry | O bento usa spans fixos numa grade, com linhas alinhadas e hierarquia por tamanho. O masonry empilha alturas variáveis em colunas, sem buracos, mas a ordem de leitura fica confusa. Com mais de 12 a 15 blocos, os dois perdem a função. | O Atria tem poucos blocos e uma hierarquia clara. A recomendação é um bento em duas zonas, com uma pilha por coluna: sem buracos e com ordem de leitura previsível. |

## Recomendação

### 1. Duas zonas, uma pilha por coluna

Trocar a grade automática por duas colunas fixas, cada uma com uma pilha vertical de cartões:

- **Zona principal (cerca de 2/3):** o que é de hoje.
- **Zona lateral (cerca de 1/3):** resumos que se leem num relance.

Como cada coluna é uma pilha (`flex-direction: column`), um cartão curto não deixa buraco ao lado de um longo. Abaixo de 960 px, as duas zonas viram uma coluna só, com a principal primeiro.

```css
.dash { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: var(--s5); align-items: start; }
.dash-zone { display: flex; flex-direction: column; gap: var(--s4); }
@media (max-width: 960px) { .dash { grid-template-columns: 1fr; } }
```

### 2. Largura do conteúdo

Aumentar a largura máxima de `main` de 1120 px para cerca de 1360 px, alinhada à esquerda, logo depois da sidebar, em vez de centralizada. Num app com navegação lateral, o conteúdo encostado na navegação lê como uma continuação dela. O centralizado cria o vão que apareceu no print.

### 3. Ordem e conteúdo dos blocos

| Zona | Bloco | Conteúdo | Mudança em relação a hoje |
|---|---|---|---|
| Topo, largura total | Saudação | "Boa noite, Victor · quinta, 30 de outubro" e uma pergunta calma ("Como foi o seu dia?") que abre uma entrada nova no diário. | Novo. Põe o diário, central na spec, na porta de entrada. |
| Principal | Hoje | Tarefas e lembretes do dia numa linha do tempo (manhã, tarde, noite), com concluir em um clique. O que não foi feito ganha "deixar para amanhã". | Ganha destaque e o adiamento. Deixa de ser um cartão de peso igual. |
| Principal | Próximos dias | Movimentações previstas e lembretes dos próximos 7 dias, agrupados por dia, sem os valores em destaque. | Junta "Próximas movimentações" num horizonte curto e pede menos atenção. |
| Lateral | Diário | Última entrada (trecho e emoções) e a sequência de dias registrados, sem cobrança. | Sobe de posição. |
| Lateral | Dinheiro | Saldo total em tamanho normal, saldo por conta recolhido e o previsto do mês. Opção de esconder valores. | O número grande deixa de ser o centro da tela. |
| Lateral | Leituras | Até 3 livros ou artigos em andamento, com a barra de progresso. | Como hoje. |
| Lateral | Metas | Até 3 metas com o progresso pelos marcos. | Novo bloco: as metas não estavam no dashboard. |

### 4. Regras de exibição

- **Poucos itens por bloco:** no máximo 5 itens, com "ver tudo" levando ao módulo. O dashboard não é uma listagem.
- **Estado, não alarme:** atraso aparece como texto neutro ("era para ontem"), com `textMuted`, nunca `danger`. Cores de estado só onde o estado importa (liquidada, prevista).
- **Bloco vazio sem culpa:** "Nada para hoje. Aproveite." em vez de um estado vazio genérico.
- **Personalização:** ocultar blocos continua (RF-23). Reordenar dentro da zona fica como evolução, sem entrar no MVP.
- **Esconder valores:** um botão que troca os valores por "•••", para usar o app em público. É um pedido novo e precisa de decisão.

## O que muda na SPEC-001

A SPEC-001 está `planned`, então a spec não é ajustada. As mudanças entram pelas tarefas:

| Tarefa | Mudança | Como |
|---|---|---|
| TASK-01 (protótipo, `in_progress`) | Layout de duas zonas, saudação, bloco "Hoje" com adiar, bloco de metas e largura de `main`. | Ajuste da tarefa em execução (skill `adjust-task`) ou correção dentro do escopo, já que o protótipo serve para validar o layout. |
| TASK-21 (dashboard real, `approved`) | Mesmos blocos e regras, validados no protótipo. | Skill `adjust-task`: a tarefa volta para aprovação. |
| Novas ideias (adiar tarefa, esconder valores, bloco de metas) | Comportamentos que a spec não tem. | Decidir se entram no MVP. Se entrarem, abrir uma spec nova (skill `create-spec`), porque a SPEC-001 já está planejada. |

## Decisões em aberto

1. Aprovar o layout de duas zonas com uma pilha por coluna, no lugar da grade automática.
2. Aprovar a ordem: saudação e diário no topo, "Hoje" como bloco principal, dinheiro na lateral.
3. Decidir se "deixar para amanhã", "esconder valores" e o bloco de metas entram no MVP ou vão para uma spec seguinte.

## Fontes

- [Calm technology (Wikipedia)](https://en.wikipedia.org/wiki/Calm_technology)
- [Principles of Calm Technology (O'Reilly)](https://oreilly.com/content/principles-calm-technology-we-are-not-bad-at-technology-technology-is-bad-at-us)
- [Principles of Calm Technology (principles.design)](https://principles.design/examples/principles-of-calm-technology)
- [Sunsama: Daily Planning](https://help.sunsama.com/docs/daily-planning)
- [Sunsama: The official daily planning guide](https://sunsama.com/blog/the-official-daily-planning-guide)
- [NN/g: Dashboards and preattentive attributes](https://www.nngroup.com/articles/dashboards-preattentive/)
- [Qlik: Pre-attentive processing for dashboard design](https://community.qlik.com/t5/Design/Pre-attentive-processing-for-Dashboard-design/ba-p/1468975)
- [SaaSFrame: Designing Bento Grids That Actually Work (2026)](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide)
- [Studio Meyer: Bento grid layouts](https://studiomeyer.io/en/blog/bento-grid-layouts)
