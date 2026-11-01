<!-- Escrito na finalização da tarefa. -->

## O que mudou

Antes, o conteúdo das telas rolava dentro de uma área fixa da página, e a janela do navegador não rolava. Agora a rolagem é única, a da própria janela. A barra de navegação lateral e a barra do topo ficam sempre no lugar, e só o conteúdo se move.

O título de cada tela cola logo abaixo da barra do topo. Quando a pessoa desce a página, o título diminui para ocupar menos espaço, e volta ao tamanho normal ao subir.

Nas telas do Financeiro, as abas de navegação entre as seções ficam presas junto com o título, então continuam ao alcance durante a rolagem.

O fundo do título passou a ser sólido e cobre o conteúdo que passa por trás dele, com uma linha separando o título da área de conteúdo. Antes, em alguns navegadores, como o Zen (baseado no Firefox), o efeito de transparência não aparecia, e os textos da página se misturavam ao título.

Em páginas curtas, a barra lateral ocupa exatamente a altura da tela, sem rolagem sobrando.

Nos formulários, o campo que a pessoa está preenchendo aparece abaixo da barra do topo e do título, sem ficar escondido atrás deles.

As telas que já tinham rolagem própria, como o leitor de livros, o quadro de Projetos e a paleta de comandos, não foram alteradas.

## Valor

- Navegação mais estável: a barra lateral e a barra do topo não saem da tela ao rolar.
- Menos perda de contexto em telas longas, porque o título e as abas continuam visíveis.
- Títulos e abas legíveis também no navegador Zen, onde antes o conteúdo aparecia por trás do título.
- Páginas curtas sem rolagem desnecessária.

## Ajustes feitos durante o trabalho

Durante a execução, o usuário pediu três ajustes:

- uma pequena folga de medição nas verificações automáticas do Firefox, porque o navegador arredonda a posição no fim da página;
- as abas do Financeiro passaram para dentro do título fixo;
- o fundo do título ficou sólido, de ponta a ponta, com uma linha sob as abas.

## Situação

Tarefa concluída. Os testes automáticos passaram. Uma diferença visual esperada na verificação de regressão foi aceita pelo usuário. O usuário conferiu o vídeo da rolagem e o print da página curta.
