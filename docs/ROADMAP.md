# Roteiro de desenvolvimento

## Versão 1.1.0 — Ferramentas integradas ao espaço 3D

- [x] Dock lateral de ferramentas no modal 3D
- [x] Seleção e navegação da câmera separadas por modo
- [x] Medição temporária e régua persistente usando a grade do Owlbear
- [x] Marcador livre, linha, retângulo e círculo com configurações de estilo
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
