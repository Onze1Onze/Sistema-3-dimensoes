# Especificação técnica — Owlbear 3D

**Versão do produto:** 1.1.0  
**Estado:** implementação em evolução; este documento registra a arquitetura e as limitações conhecidas.  
**Objetivo:** abrir uma visualização tridimensional da cena atual do Owlbear Rodeo, usando o Owlbear como fonte oficial dos dados e um renderizador Three.js independente.

> O arraste de miniaturas no plano do tabuleiro está implementado para toque, caneta e mouse. A representação das miniaturas continua sendo 2.5D (billboards verticais); elevação vertical livre, modelos volumétricos e movimento entre andares não fazem parte desta versão.
>
> A versão 1.1.0 adiciona ferramentas no próprio modal 3D: seleção, navegação, medição por `OBR.scene.grid.getDistance`, marcador livre, linha, retângulo, círculo, texto e fogo visual. As ferramentas de desenho, anotação e régua usam builders oficiais e criam itens nas camadas nativas do Owlbear. O fogo é representado por um item de área com metadata namespaced e partículas locais no renderizador 3D; ele não cria um item `LIGHT` e não participa da iluminação/Fog of War. Ferramentas e painéis de extensões externas não podem ser enumerados nem incorporados automaticamente porque o SDK não expõe uma API pública para isso.

---

## 1. Decisão de arquitetura

A extensão não tentará substituir nem modificar o renderizador interno do Owlbear Rodeo. Ela funcionará como um segundo visualizador, aberto por uma janela modal em tela cheia, que lê a cena do Owlbear pelo SDK oficial e constrói uma representação 3D sincronizada.

O Owlbear continuará sendo a fonte oficial de:

- mapas e imagens da cena;
- tokens, posições, rotações, escalas e camadas;
- jogadores, permissões e sala;
- persistência dos objetos e histórico de movimentação.

O renderizador 3D será responsável por:

- converter os dados 2D da cena para coordenadas 3D;
- desenhar o mapa como terreno;
- desenhar tokens como miniaturas verticais na primeira versão;
- controlar câmera, seleção e interação por mouse;
- enviar ao Owlbear os movimentos feitos dentro do modo 3D.

Esta separação evita duplicar a infraestrutura de uma VTT e reduz o risco de corromper a cena original.

### Fluxo principal

Owlbear Rodeo → SDK oficial → Adaptador de cena → Modelo 3D interno → Three.js → Modal 3D

No sentido inverso:

Three.js → Raycaster / seleção → Conversor 3D para 2D → OBR.interaction → Cena oficial do Owlbear

---

## 2. O que a primeira versão deverá entregar

### Incluído no MVP

1. Um botão da extensão no Owlbear, chamado **Abrir modo 3D**.
2. Abertura do visualizador em modal de tela cheia.
3. Leitura da cena atual sem exigir que o mestre importe o mapa novamente.
4. Renderização de imagens da camada MAP como planos texturizados no chão.
5. Renderização de imagens da camada CHARACTER como miniaturas 2.5D verticais, preservando transparência e proporção.
6. Leitura de posições, escalas, rotações e visibilidade dos itens.
7. Câmera orbital com zoom, rotação, inclinação e deslocamento.
8. Seleção de miniaturas com clique.
9. Arrastar miniaturas no chão 3D e atualizar a posição correspondente no Owlbear.
10. Sincronização dos movimentos entre clientes por meio do mecanismo nativo de interação do Owlbear.
11. Atualização do visualizador quando itens são alterados no mapa 2D.
12. Botão para sair do modo 3D e voltar à cena convencional.
13. Mensagens de erro claras para cenas sem mapa, imagens inacessíveis ou incompatibilidade de navegador.

### Fora do MVP

- Paredes, portas, escadas e construções volumétricas editáveis.
- Importação de modelos GLB/GLTF pelo usuário.
- Física de objetos.
- Fog of War tridimensional.
- Iluminação dinâmica realista e sombras complexas.
- Chuva, neve, fogo, partículas e ciclos climáticos.
- Movimento vertical de personagens e múltiplos andares.
- Sincronização obrigatória da câmera de todos os jogadores.
- Conversão automática de qualquer mapa 2D em geometria 3D real.

Esses recursos ficam para versões posteriores. A primeira meta é provar que cena, mapa, miniaturas e movimentação podem funcionar em um ambiente 3D sem quebrar o Owlbear.

---

## 3. Experiência do usuário

### Entrada

1. O mestre abre uma sala normalmente.
2. A extensão aparece no menu de ações.
3. Ao clicar, abre um painel pequeno com o botão **Abrir modo 3D**.
4. O botão chama `OBR.modal.open` com `fullScreen: true` e carrega a página independente do visualizador.
5. O visualizador confirma que o SDK está pronto, aguarda uma cena válida e começa a carregar os itens.
6. Todos os clientes que queiram participar abrem o modo 3D em seus próprios dispositivos. A cena permanece compartilhada porque os objetos continuam sendo os objetos oficiais do Owlbear.

A abertura do modo 3D não deve ser forçada nos outros jogadores. Cada cliente entra deliberadamente pelo próprio botão, evitando depender de uma ação automática disparada por uma mensagem remota.

### Controles padrão

| Entrada | Ação |
|---|---|
| Botão esquerdo em miniatura | Selecionar |
| Arrastar com botão esquerdo | Mover miniatura |
| Botão direito + arrastar | Orbitar câmera |
| Botão do meio + arrastar | Deslocar câmera |
| Scroll | Aproximar / afastar |
| WASD | Deslocar câmera |
| R | Recentrar a câmera no mapa |
| Esc | Sair do modo 3D ou cancelar interação |

O arraste de miniatura e o controle de câmera precisam ter estados separados. Quando uma miniatura está selecionada e o usuário inicia um arraste sobre ela, o sistema não pode interpretar o gesto simultaneamente como rotação da câmera.

---

## 4. Tecnologias

| Componente | Escolha | Motivo |
|---|---|---|
| Integração | `@owlbear-rodeo/sdk` | API oficial para cena, itens, modal e sincronização |
| Renderização | `three` | Renderizador WebGL maduro, adequado a mapas texturizados e câmeras 3D |
| Controles orbitais | `OrbitControls` do Three.js | Câmera orbital, zoom e pan |
| Linguagem | TypeScript | Tipagem dos itens do Owlbear e dos dados 3D |
| Build | Vite | Desenvolvimento e empacotamento de páginas da extensão |
| Interface | HTML/CSS/TypeScript simples | Evitar dependências de interface desnecessárias no protótipo |

React não é necessário para a primeira prova de conceito. Pode ser adicionado posteriormente caso a interface cresça.

Rapier também não é necessário no MVP, pois ainda não haverá física. A extensão oficial de dados 3D do Owlbear demonstra que Three.js e Rapier podem ser usados em uma extensão, mas o nosso protótipo deve manter a pilha pequena.

---

## 5. Estrutura de projeto proposta

    public/
      manifest.json
      icon.svg
    src/
      main.ts                 # entrada do painel da extensão
      modal/
        viewer.html           # documento do visualizador 3D
        viewer.ts             # ciclo de vida do visualizador
        viewer.css
      obr/
        obr-client.ts         # inicialização e chamadas ao SDK
        scene-reader.ts       # leitura e assinatura dos itens
        scene-sync.ts         # sincronização de alterações
        interaction-adapter.ts# arraste 3D para OBR.interaction
        metadata.ts           # leitura e gravação de metadados
      scene/
        scene-model.ts        # tipos internos independentes do SDK
        coordinate-system.ts # conversões OBR ↔ Three.js
        map-builder.ts       # planos do mapa e texturas
        token-builder.ts     # miniaturas/billboards
        scene-reconciler.ts  # criação, atualização e remoção de meshes
      renderer/
        renderer.ts          # WebGLRenderer e ciclo de renderização
        camera.ts            # PerspectiveCamera e OrbitControls
        picking.ts           # Raycaster e seleção
        lighting.ts          # luz ambiente e direcional simples
      ui/
        toolbar.ts           # controles sobrepostos ao canvas
        status.ts            # estados e erros visíveis
      tests/
        coordinate-system.test.ts
        scene-reconciler.test.ts
        sync-guards.test.ts
    package.json
    tsconfig.json
    vite.config.ts
    README.md

Os módulos de Three.js não devem chamar diretamente todas as APIs do Owlbear. O adaptador `obr/` isola o SDK, e o renderizador trabalha com um modelo interno simples. Isso facilita testar as conversões sem precisar abrir uma sala real.

---

## 6. Leitura da cena do Owlbear

### APIs utilizadas

| API | Uso |
|---|---|
| `OBR.onReady` | Esperar o SDK carregar |
| `OBR.scene.isReady` | Verificar se há cena aberta |
| `OBR.scene.items.getItems` | Obter o estado inicial dos itens |
| `OBR.scene.items.onChange` | Receber o conjunto atualizado de itens |
| `OBR.scene.grid.getDpi` | Descobrir a resolução da grade |
| `OBR.scene.grid.getType` | Identificar grade quadrada, hexagonal, isométrica ou dimétrica |
| `OBR.scene.grid.snapPosition` | Devolver a posição de movimento à grade real do Owlbear |
| `OBR.modal.open` / `close` | Abrir e encerrar o visualizador |
| `OBR.interaction.startItemInteraction` | Transmitir arrastes com interpolação de rede |
| `OBR.scene.getMetadata` / `setMetadata` | Guardar pequenas configurações específicas da cena |
| `OBR.party.getPlayers` | Diagnóstico de clientes conectados |
| `OBR.room.getPermissions` | Consultar permissões da sala |

### Itens a importar

- `IMAGE` em `MAP`: plano do terreno.
- `IMAGE` em `CHARACTER`: miniatura vertical.
- `IMAGE` em `MOUNT`: futuro suporte para montarias e objetos elevados; não é essencial ao primeiro teste.
- Outros itens: ignorar inicialmente, mas preservar no Owlbear.
- Itens com `visible === false`: não desenhar.

O leitor deve construir um mapa por `id` do Owlbear. Não usar o índice do array como identidade, pois a ordem pode mudar.

### Atualização incremental

`OBR.scene.items.onChange` entrega o conjunto atual de itens, não apenas a lista de itens alterados. O reconciliador deve comparar o novo snapshot com o estado conhecido:

- ID novo: criar o objeto 3D.
- ID existente com transformação diferente: atualizar o mesh correspondente.
- ID que desapareceu: remover o mesh e liberar geometria, material e textura quando não forem compartilhados.
- URL de imagem alterada: substituir a textura e descartar a anterior.
- Visibilidade alterada: ocultar ou mostrar o mesh.

Não reconstruir toda a cena a cada evento. O evento deve resultar apenas em diferenças reais.

---

## 7. Sistema de coordenadas

Esta é uma das partes mais importantes do projeto. Um erro aqui faz os tokens se deslocarem em relação ao mapa.

### Convenção interna

- Owlbear trabalha em coordenadas 2D: `x` e `y`, em pixels de mundo.
- Three.js trabalhará com `x`, `y` e `z`.
- `x` do Owlbear vira `x` no Three.js.
- `y` do Owlbear vira `-z` no Three.js, para que o eixo vertical do mapa corresponda ao eixo de profundidade do chão.
- `y` do Three.js representa altura física.
- Uma célula quadrada da grade vale 1 unidade 3D.

Definir uma origem estável da cena, preferencialmente a posição do mapa principal. A origem nunca deve ser recalculada durante o arraste de uma miniatura.

### Conversão de posição

Se `D` é o DPI da grade da cena, `O` é a origem 2D e `P` é uma posição do Owlbear:

`x3D = (P.x - O.x) / D`

`z3D = -(P.y - O.y) / D`

`y3D = elevation`, inicialmente igual a zero.

A conversão inversa é:

`xOBR = O.x + x3D * D`

`yOBR = O.y - z3D * D`

O resultado inverso deve ser passado por `OBR.scene.grid.snapPosition` quando o ajuste à grade estiver habilitado.

### Tamanho e âncora de imagens

Não assumir que toda imagem tem seu ponto de ancoragem no centro. Cada Image do Owlbear contém `image.width`, `image.height` e `grid` com `dpi` e `offset`. O campo `offset` é documentado como uma coleção de vetores relativos às dimensões da imagem; portanto, o renderizador não pode presumir que exista apenas um ponto de ancoragem nem que todas as imagens estejam centralizadas. O tamanho e a âncora do plano 3D precisam ser derivados desses dados e da escala do item.

Antes de fixar a transformação final, o protótipo deve validar imagens com offset central, offset deslocado e múltiplos offsets em uma sala real. O plano não pode ser centralizado arbitrariamente se isso alterar o alinhamento que o Owlbear apresenta.

A rotação do Owlbear é em graus. O sinal da rotação deve ser validado com um teste de 0°, 90° e 180°, pois a conversão do eixo vertical 2D para o eixo Z 3D pode inverter o sentido.

### Tipos de grade

- `SQUARE`: suporte completo no MVP.
- `HEX_VERTICAL` e `HEX_HORIZONTAL`: a posição pode continuar sendo ajustada por `snapPosition`, mas o desenho da grade 3D fica para uma etapa posterior.
- `ISOMETRIC` e `DIMETRIC`: importar o mapa como textura sem tentar reinterpretar a projeção gráfica do próprio mapa. O alinhamento da movimentação deverá ser testado separadamente.
- Cena sem grade: oferecer escala padrão configurável e não prometer distância em células.

A primeira versão não deve desenhar uma grade sintética desalinhada sobre o mapa. Se o alinhamento não puder ser comprovado, a extensão deve ocultar a grade 3D própria e preservar a grade que já estiver incorporada na imagem do mapa.

---

## 8. Construção do ambiente 3D

### Terreno

Cada imagem válida da camada MAP será convertida em um plano horizontal com textura. A posição, rotação, escala, tamanho e âncora devem corresponder aos dados do Owlbear.

A textura será carregada pelo URL presente em `Image.image.url`. A documentação do Owlbear exige CORS habilitado para imagens. O carregador deve detectar falha de CORS, mostrar o nome do item que falhou e manter o restante do ambiente ativo.

O material inicial deve ser simples: textura original, sem efeitos PBR pesados, sem deslocamento de vértices e sem iluminação que altere excessivamente as cores do mapa.

### Miniaturas

No MVP, imagens da camada CHARACTER serão desenhadas como planos verticais com transparência, posicionados na coordenada do token. Isso é uma representação 2.5D, não um modelo volumétrico.

- Preservar transparência PNG.
- Preservar proporção da imagem.
- Usar a posição do token como ponto de apoio no chão.
- Usar rotação do Owlbear para orientar a miniatura em torno do eixo vertical.
- Respeitar `visible` e `locked`.
- Permitir realce visual quando selecionada.

A próxima etapa permitirá associar um modelo `.glb` / `.gltf` ao ID de um token, mantendo a posição do Owlbear como fonte de verdade. A associação será feita por metadados e não por nome do arquivo ou nome do personagem.

### Câmera

Usar `PerspectiveCamera` com `OrbitControls`.

Configuração inicial:

- posição elevada e inclinada, enquadrando o mapa principal;
- `enableDamping` para suavizar a câmera;
- zoom mínimo e máximo limitados;
- alvo inicial no centro dos limites do mapa;
- teclas WASD para translação;
- botão de recentralizar;
- botão para alternar entre vista tática elevada e vista orbital.

A câmera será local a cada jogador por padrão. O enquadramento de um jogador não deve deslocar a câmera dos outros.

---

## 9. Sincronização dos movimentos

A decisão principal é usar `OBR.interaction`, não um canal próprio de mensagens para cada frame.

### Arraste iniciado no 3D

1. O Raycaster detecta a miniatura sob o cursor.
2. O sistema confirma que o item não está bloqueado e que o usuário tem permissão para movê-lo.
3. O visualizador inicia `OBR.interaction.startItemInteraction` usando o item real do Owlbear como estado-base.
4. A cada atualização do arraste, o Raycaster projeta o cursor em um plano horizontal na altura do chão.
5. A posição 3D é convertida para coordenadas 2D do Owlbear.
6. A função `update` da interação atualiza somente `position` do item.
7. Ao soltar o botão, chamar `stop`.
8. Se o arraste for cancelado ou a janela perder foco, encerrar a interação com segurança.

O SDK transmite snapshots e interpola o movimento para outros jogadores. Interações expiram após 30 segundos; o visualizador deve sempre terminar a interação ao soltar, cancelar ou perder o foco.

### Mudanças originadas no mapa 2D

Se um jogador mover um token no Owlbear convencional, `onChange` atualizará a miniatura no modo 3D. O mesh deve interpolar visualmente entre a posição anterior e a nova, sem iniciar outra interação de retorno.

### Conflitos

Duas pessoas podem tentar mover o mesmo token ao mesmo tempo. No MVP, o comportamento será de último estado válido recebido, seguindo o estado final do Owlbear. O visualizador pode exibir um destaque de conflito, mas não deve fingir que existe bloqueio distribuído atômico.

Um sistema de reserva/lock confiável poderá ser criado numa versão posterior com serviço de coordenação próprio. Não usar room metadata como lock de alta frequência.

### Broadcast

`OBR.broadcast` fica reservado para eventos leves, por exemplo:

- sinalizar que o modo 3D está ativo;
- avisar que um cliente entrou ou saiu do visualizador;
- enviar uma solicitação de foco ou apresentação futura.

Não transmitir texturas, geometria, modelos GLB nem a posição de cada frame por Broadcast. As mensagens têm limite documentado de 16 KB e são efêmeras.

---

## 10. Persistência e metadados

Usar namespace exclusivo, por exemplo `com.iniciativa.owlbear3d`.

### Metadados da cena

Guardar somente configurações pequenas:

- versão do formato de configuração;
- modo de escala quando não há grade;
- mapa preferencial, caso haja mais de um;
- opções simples de câmera inicial;
- preferências de grade visual.

Usar `OBR.scene.getMetadata`, `setMetadata` e `onMetadataChange`. Como a configuração pertence à cena, preferir metadata da cena ao metadata da sala.

### Metadados dos itens

Reservar uma subchave pequena para futuras extensões:

- URL ou identificador de modelo 3D;
- altura/elevação;
- escala da miniatura;
- ponto de apoio personalizado.

Não duplicar ali posição, rotação ou escala 2D, pois esses dados já pertencem ao próprio item do Owlbear.

Não armazenar arquivos binários nem grandes listas de geometria em metadata. Modelos e texturas devem ser carregados de endereços de arquivo compartilháveis e com CORS configurado.

---

## 11. Segurança, visibilidade e Fog of War

Este é o maior bloqueador para uma versão pública com mapas secretos.

O novo renderizador não herda automaticamente o sistema de Dynamic Fog do Owlbear. Renderizar a imagem completa do mapa como uma textura pode revelar regiões que o mestre ainda não revelou aos jogadores, mesmo que a experiência 2D esteja corretamente coberta pelo Fog of War.

Portanto:

1. O MVP deve ser tratado como protótipo e testado primeiro pelo mestre.
2. A primeira experiência multiplayer só deve ser usada em cenas cujo mapa inteiro já possa ser visto pelos jogadores, ou em mapas sem informação secreta fora da área explorada.
3. O visualizador sempre deve filtrar itens com `visible === false`.
4. A extensão deve consultar `OBR.player` e as permissões disponibilizadas pela sala, mas nunca presumir que a leitura dessas permissões substitui a validação do próprio Owlbear ao atualizar um item.
5. A extensão não deve afirmar compatibilidade com Dynamic Fog até implementar e testar uma máscara de visibilidade própria no renderer 3D.
6. Antes de distribuir a extensão, testar explicitamente o que cada função do SDK devolve para um jogador comum quando existem itens ocultos, camadas ocultas, paredes e regiões cobertas.

A solução futura para Fog deverá reproduzir as áreas reveladas dentro do mapa 3D, considerando paredes, oclusão e iluminação. Não basta desenhar uma camada preta plana se o objetivo for permitir uma câmera orbital que enxergue atrás de paredes.

Também é necessário respeitar as permissões da sala. A interface 3D não deve dar ao jogador uma capacidade de movimentar itens que ele não teria no Owlbear convencional.

---

## 12. Desempenho

Metas iniciais de engenharia, a validar em dispositivos reais:

- 30 FPS como piso de aceitabilidade em computador modesto;
- 60 FPS como alvo em computador intermediário;
- 100 tokens visíveis sem travamentos graves;
- mapa principal carregado uma única vez por cliente;
- nenhuma reconstrução integral da cena em cada evento `onChange`;
- liberar texturas, materiais, geometrias e listeners quando o modal fechar;
- reduzir resolução do renderer em dispositivos com GPU limitada;
- limitar pixel ratio para evitar canvas excessivamente pesado em telas de alta densidade.

O modo 3D deve detectar `webglcontextlost` e apresentar uma opção de reinicialização, sem modificar ou perder dados do Owlbear.

---

## 13. Plano de implementação

### Marco 1 — Validação SDK

- Criar extensão mínima com manifest e painel de ação.
- Abrir modal full screen.
- Confirmar acesso ao SDK dentro da página modal.
- Ler `OBR.scene.items.getItems`.
- Imprimir no painel a contagem de mapas e tokens encontrados.

Critério de saída: extensão instalada manualmente no Owlbear, com o modal abrindo e identificando corretamente os itens da sala.

### Marco 2 — Primeiro render

- Inicializar Three.js.
- Carregar plano do mapa.
- Carregar tokens como billboards.
- Ajustar escala, origem, âncora, rotação e transparência.
- Enquadrar o mapa com a câmera.

Critério de saída: a composição 3D corresponde visualmente à cena 2D e nenhum token aparece deslocado de sua posição.

### Marco 3 — Sincronização de ida e volta

- Assinar `onChange`.
- Atualizar e remover meshes sem duplicação.
- Arrastar token no 3D.
- Enviar posição usando `OBR.interaction`.
- Arrastar token no Owlbear 2D enquanto o visualizador está aberto e confirmar que o mesh acompanha.
- Abrir a mesma sala em dois navegadores e verificar os dois sentidos da sincronização.

Critério de saída: movimento fluido e consistente em duas sessões, sem loops de atualização.

### Marco 4 — Robustez

- Trocar de cena enquanto o visualizador está aberto.
- Fechar e reabrir o modal repetidamente.
- Testar itens bloqueados e ocultos.
- Testar URL de imagem inválida e falha CORS.
- Testar 1, 50 e 100 tokens.
- Testar mouse, touch e viewport estreito.
- Confirmar que encerrar o visualizador remove todos os listeners e recursos gráficos.

Critério de saída: sem erros fatais, memória crescente ou alterações não intencionais na cena.

### Marco 5 — Preparação para público

Este marco fica bloqueado até a solução de visibilidade/Fog of War ser especificada e testada. Também exige verificação de permissões, mobile, compatibilidade entre navegadores e política de hospedagem dos modelos.

---

## 14. Testes obrigatórios

### Testes unitários

- conversão OBR → Three.js → OBR sem perda de posição;
- conversão de eixo vertical;
- rotação 0°, 90°, 180° e 270°;
- tamanhos com escala X/Y diferente;
- imagem com offset central e offset deslocado;
- imagem com transparência;
- posição com snap ligado e desligado;
- reconciliador para inclusão, edição, remoção e mudança de visibilidade;
- proteção contra eco de updates originados pelo próprio visualizador.

### Testes de integração no Owlbear

- sala com mapa único e grade quadrada;
- sala com dois mapas na camada MAP;
- tokens com nomes, rótulos e transparência;
- tokens bloqueados;
- item oculto;
- cena sem grade;
- grade hexagonal, isométrica e dimétrica em modo de compatibilidade;
- movimento feito no 2D refletido no 3D;
- movimento feito no 3D refletido no 2D;
- dois clientes conectados;
- jogador e mestre com permissões diferentes;
- fechamento do modal durante um arraste.

### Testes de segurança

- confirmar que região coberta pelo Fog não fica exposta no novo renderer;
- confirmar o que `getItems` devolve ao jogador em cada estado de visibilidade;
- confirmar que jogador não consegue mover item bloqueado ou sem permissão;
- confirmar que falha de sincronização nunca cria tokens duplicados;
- confirmar que não há modelos ou dados de cena enviados a serviços externos sem autorização.

---

## 15. Critérios de conclusão do MVP

O MVP só será considerado concluído quando todos os itens abaixo forem verdadeiros:

- [ ] A extensão instala e abre no Owlbear.
- [ ] O botão abre o visualizador em tela cheia.
- [ ] O visualizador lê a cena atual sem upload manual do mapa.
- [ ] O mapa aparece como plano texturizado no local correto.
- [ ] Os tokens CHARACTER aparecem como miniaturas verticais no local correto.
- [ ] A câmera gira, aproxima, afasta e desloca sem interferir no arraste.
- [ ] Mover um token no 3D atualiza a posição oficial no Owlbear.
- [ ] Mover um token no 2D atualiza sua miniatura 3D.
- [ ] Dois clientes veem as mesmas posições após movimentação.
- [ ] O fechamento do modal encerra listeners e interações.
- [ ] Itens invisíveis ou bloqueados não são manipulados indevidamente.
- [ ] O comportamento em mapas com Fog foi avaliado e a extensão não expõe áreas secretas.

---

## 16. Riscos e decisões

| Risco | Impacto | Tratamento |
|---|---|---|
| CORS da textura | Mapa não carrega no Three.js | Detectar, informar e testar URLs reais do Owlbear |
| Âncora/offset de imagem incorretos | Mapa ou token deslocado | Usar `ImageGrid.offset` e testes geométricos |
| DPI e escala mal interpretados | Tamanho errado do mapa | Converter com DPI da cena e DPI/offset da imagem; validar na sala real |
| Duas pessoas movendo o mesmo token | Estado concorrente | Aceitar último estado do Owlbear no MVP; lock robusto depois |
| Fog of War | Vazamento de áreas secretas | Não liberar para cenas secretas até ter máscara 3D validada |
| Celular com GPU fraca | Baixo FPS ou falha WebGL | Qualidade adaptativa e teste separado para mobile |
| Cena muito grande | Queda de desempenho | Atualização incremental, descarte de recursos e limite de texturas |
| Modal fechado durante movimento | Interação pendurada | Encerrar interação no fechamento, blur e cancelamento |

---

## 17. Fontes técnicas consultadas

Documentação oficial do Owlbear Rodeo:

- Getting Started: https://docs.owlbear.rodeo/extensions/getting-started/
- Manifest: https://docs.owlbear.rodeo/extensions/reference/manifest/
- Modal API: https://docs.owlbear.rodeo/extensions/apis/modal/
- Scene Items API: https://docs.owlbear.rodeo/extensions/apis/scene/items/
- Item Reference: https://docs.owlbear.rodeo/extensions/reference/items/item/
- Image Reference: https://docs.owlbear.rodeo/extensions/reference/items/image/
- Grid API: https://docs.owlbear.rodeo/extensions/apis/scene/grid/
- Interaction API: https://docs.owlbear.rodeo/extensions/apis/interaction/
- Broadcast API: https://docs.owlbear.rodeo/extensions/apis/broadcast/
- Scene Metadata: https://docs.owlbear.rodeo/extensions/apis/scene/
- Room Permissions: https://docs.owlbear.rodeo/extensions/apis/room/
- Party API: https://docs.owlbear.rodeo/extensions/apis/party/
- Assets API: https://docs.owlbear.rodeo/extensions/apis/assets/
- Example oficial de dados 3D com Three.js e Rapier: https://github.com/owlbear-rodeo/dice

Referência comunitária:

- Discussões e exemplos da comunidade Owlbear Rodeo: https://www.reddit.com/r/OwlbearRodeo/

---

## 18. Recomendação de execução

Implementar primeiro os Marcos 1 a 3. Não iniciar paredes, física, iluminação avançada nem biblioteca de modelos antes de provar a sincronização bidirecional em dois clientes reais.

A primeira demonstração deve ser deliberadamente simples: um mapa de dungeon já existente no Owlbear, alguns tokens transparentes em pé sobre o chão, câmera orbital e movimentação sincronizada. Se essa demonstração for estável, o projeto terá uma fundação correta para crescer em direção a uma experiência semelhante a uma mesa virtual 3D.
