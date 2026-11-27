# Roteiro de desenvolvimento

## Versão 1.2.0 — Redesign completo da interface

- [x] Substituir o painel inicial por uma entrada editorial, compacta e orientada ao estado real da cena.
- [x] Refazer a barra superior, a navegação lateral, as ferramentas contextuais e os estados vazios/erro do visualizador.
- [x] Remover gradientes, brilho, glassmorphism, blur, sombras decorativas, botões-pílula e animações gratuitas.
- [x] Estabelecer paleta neutra com acento quente único, tipografia hierárquica e escala de espaçamento consistente.
- [x] Trocar emojis e caracteres decorativos por ícones vetoriais próprios.
- [x] Incluir estados de foco, hover, ativo, desabilitado, carregamento, erro e ausência de mapa.
- [x] Melhorar rótulos, microcopy e estados acessíveis dos painéis.
- [x] Atualizar identidade do ícone, manifesto e documentação.

## Versão 1.1.1 — Correções de precisão e estabilidade

- [x] Normalizar dimensões de imagens pelo DPI da cena e DPI individual da imagem.
- [x] Tornar as prévias de triângulos, hexágonos, círculos e pincel congruentes com a geometria criada.
- [x] Renderizar traços com espessura configurável usando linhas compatíveis com WebGL.
- [x] Compartilhar requisições de textura e eliminar carregamentos duplicados simultâneos.
- [x] Tornar a velocidade de câmera independente da taxa de quadros e restaurar o atalho R.
- [x] Evitar consultas de Fog/role em toda atualização de movimento de token.
- [x] Respeitar CHARACTER_OWNER_ONLY e permissões de anexos durante a exclusão.
- [x] Validar permissões e bloqueios dos anexos antes de arrastar grupos de tokens.
- [x] Cancelar criações/edições assíncronas quando a cena mudar.
- [x] Encerrar animação, listeners, geometrias, materiais e texturas ao fechar o modal.
- [x] Ajustar anotações para quebrar linhas sem truncar o texto após 40 caracteres.
- [x] Adicionar testes de DPI e geometria das prévias.

## Versão 1.1.1 — Ferramentas integradas ao espaço 3D

- [x] Dock lateral de ferramentas no modal 3D
- [x] Seleção e navegação da câmera separadas por modo
- [x] Medição temporária e régua persistente usando a grade do Owlbear
- [x] Marcador livre, pincel preenchido, linha, retângulo, círculo, triângulo e hexágono com configurações de estilo
- [x] Inserção de anotações de texto na cena
- [x] Criação de área de fogo compartilhada com chamas animadas no visualizador 3D
- [x] Renderização de itens compatíveis das camadas DRAWING, RULER e TEXT
- [x] Painel de integrações explicando os limites de extensões de terceiros
- [x] Histórico curto para desfazer a última criação


## Versão 1.0.1 — Estabilização de interação

- [x] Arraste direto de miniaturas com toque, caneta e mouse no canvas 3D
- [x] Iniciar interação somente após movimento real, sem penalizar toques usados apenas para selecionar
- [x] Preservar o ponto final quando o ponteiro é liberado durante a inicialização do SDK
- [x] Consultar permissões por tipo em paralelo
- [x] Tratar cancelamento, perda de foco e perda de captura do ponteiro
- [x] Verificar consistência de versão entre pacote e manifesto
- [x] Testar os estados da máquina de gesto e as transformações do mapa

## Marco 0.1 — Prova de renderização 3D

- [x] Estrutura Vite + TypeScript
- [x] Manifest e ação de extensão
- [x] Modal de tela cheia
- [x] Leitura de imagens MAP/CHARACTER/MOUNT/PROP
- [x] Texturização de mapa e miniaturas
- [x] Câmera orbit, zoom, teclado e presets
- [x] Movimentação com OBR.interaction
- [x] Sincronização passiva via onChange
- [x] Bloqueio de segurança para Fog of War, paredes e luzes de visão
- [x] Testes de transformação de coordenadas

## Marco 0.2 — Robustez de integração

- [ ] Testar com mapa base e itens MAP reais em Owlbear hospedado
- [ ] Validar comportamento de múltiplos mapas rotacionados e escalados
- [ ] Validar permissões de personagens próprios e de terceiros
- [ ] Corrigir e medir latência de sincronização em duas contas
- [ ] Adicionar seleção visual e painel de informações do token
- [ ] Adicionar ajuste de altura por metadata namespaced
- [ ] Adicionar limites de memória e limpeza de texturas por cena

## Marco 0.3 — Construção modular

- [ ] Importação de modelos GLB/GLTF
- [ ] Sistema de objetos 3D persistentes com metadata namespaced
- [ ] Paredes, portas e escadas
- [ ] Elevações e múltiplos níveis
- [ ] Ferramentas exclusivas do mestre

## Marco 0.4 — Visibilidade e atmosfera

- [ ] Mapear dados de Dynamic Fog e geometria de paredes
- [ ] Implementar visão individual por jogador
- [ ] Testar vazamento de informação com cenas de neblina
- [ ] Fontes de luz, sombras e pós-processamento
- [ ] Somente liberar o modo para jogadores após validação de visibilidade

## Marco 1.0 — Ambiente de jogo

- [ ] Física e colisões
- [ ] Biblioteca e carregamento controlado de ativos
- [ ] Otimização para dispositivos modestos
- [ ] Testes de sessão multiplayer prolongada
- [ ] Documentação de publicação e distribuição
