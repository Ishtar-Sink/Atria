<!-- Escrito na finalização da tarefa. -->

## O que mudou

Agora é possível excluir uma recorrência, como uma despesa fixa ou uma receita que se repete todo mês. Até aqui ela só podia ser editada.

Ao excluir uma recorrência:

- As cobranças futuras que ainda não foram pagas ou recebidas saem da agenda. O saldo não muda com isso.
- Os pagamentos e recebimentos que já tinham sido confirmados continuam no histórico, como lançamentos avulsos, com o mesmo valor e a mesma data. Eles deixam de estar ligados a uma recorrência que não existe mais.
- Se alguém desfizer a confirmação de um desses lançamentos antigos, ele volta a aparecer como previsto. Não é apagado.
- Tentar excluir de novo a mesma recorrência mostra que ela já não existe.
- Uma pessoa não consegue excluir recorrências de outra.

## Por que importa

- Compromissos que acabaram deixam de poluir a agenda de previsões.
- O histórico do que já foi pago ou recebido é preservado, então a exclusão não apaga o passado.
- Os saldos continuam os mesmos antes e depois da exclusão, porque a mudança afeta só o que ainda não aconteceu.

## Como foi verificado

- Os testes automatizados da mudança passaram. Eles cobrem a exclusão de uma recorrência com e sem pagamentos já confirmados, a tentativa de excluir duas vezes e a tentativa de excluir a recorrência de outra pessoa.
- A verificação das demais partes do sistema não mostrou falhas novas em relação ao estado anterior.
- A evidência da verificação foi registrada.
