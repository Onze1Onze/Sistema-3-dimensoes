# Sistema 3 Dimensões — extensão para Owlbear Rodeo

Protótipo de extensão do Owlbear Rodeo que abre uma visualização tridimensional da cena atual usando Three.js. O Owlbear continua sendo a fonte de verdade para mapas, tokens e permissões.

## Estado da versão 0.1.0

Leia também a [especificação técnica completa](docs/ESPECIFICACAO_TECNICA.md) e o [roteiro de desenvolvimento](docs/ROADMAP.md).

Implementado nesta primeira entrega:

- Ação da extensão no Owlbear para abrir o modo 3D em modal de tela cheia.
- Leitura de imagens da cena pelas camadas `MAP`, `CHARACTER`, `MOUNT` e `PROP`.
- Mapas da camada `MAP` como planos texturizados no chão 3D.
- Tokens de `CHARACTER` e `MOUNT` como miniaturas verticais que acompanham a câmera.
- Imagens da camada `PROP` como elementos planos sobre o tabuleiro.
- Câmera orbital com zoom, vistas isométrica/superior e centralização.
- Movimento de miniaturas autorizado pelo SDK, usando `OBR.interaction`.
- Atualização visual a partir de `OBR.scene.items.onChange`.
- Bloqueio preventivo da visualização em cenas com Fog of War preenchido ou itens visíveis nas camada `FOG` ou itens do tipo `WALL` e `LIGHT`.
- Testes unitários das transformações de coordenadas e dimensionamento.

Ainda não implementado: paredes, colisões, iluminação por fontes da cena, Fog of War 3D, vários andares, modelos GLB, superfícies de terreno e física. O protótipo não deve ser usado em uma sessão com Fog of War, paredes ou fontes de luz de visão; nesses casos ele bloqueia o visualizador para evitar revelar áreas escondidas.

## Requisitos

- Node.js 22.6 ou superior (o teste unitário usa o strip de tipos nativo do Node).
- npm.
- Uma sala/cena do Owlbear Rodeo com uma imagem na camada `MAP`.

## Desenvolvimento local

```bash
npm install
npm run dev
```

O Vite iniciará em `http://localhost:5173`. No perfil do Owlbear Rodeo, adicione uma extensão usando:

`http://localhost:5173/manifest.json`

Habilite a extensão em uma sala e clique em **Sistema 3D**.

## Compilar e testar

```bash
npm test
npm run build
npm run preview
```

O build de produção fica na pasta `dist/`. O repositório está configurado para publicação pelo GitHub Pages via GitHub Actions; depois de habilitar Pages em **Settings → Pages → Build and deployment → Source: GitHub Actions**, a URL de instalação será `https://onze1onze.github.io/Sistema-3-dimensoes/manifest.json`.

## Controles

- Botão esquerdo e arrasto no chão: deslocar a câmera.
- Botão direito e arrasto: orbitar a câmera.
- Botão do meio: zoom/pan adicional conforme dispositivo.
- Scroll: aproximar/afastar.
- WASD ou setas: deslocar a câmera.
- Arrastar uma miniatura: mover o token, caso a permissão correspondente exista no Owlbear.
- Botões no topo: vista isométrica, vista superior, centralizar e fechar.

## Decisões e limitações técnicas

- O mapa é construído a partir de itens de imagem da camada `MAP`. Se uma cena não expuser um mapa nessa camada, o visualizador informa o problema em vez de tentar adivinhar qual imagem usar.
- A imagem precisa ser carregável pelo navegador e permitir CORS. Se o host da imagem não permitir CORS, o token/mapa afetado não poderá ser texturizado.
- O sistema usa a escala inicial de `0.01` unidade 3D por pixel Owlbear; a proporção e as relações espaciais são preservadas.
- Para preservar a privacidade, qualquer cena com preenchimento de Fog ou itens visíveis nas camadas `FOG`, `WALL` ou `LIGHT` é bloqueada. O protótipo ainda não aplica a máscara de visão individual do Owlbear.
- A câmera é local por jogador. O estado da câmera não altera a viewport 2D do Owlbear.
- O movimento de tokens é escrito no item original do Owlbear. As permissões `CHARACTER_UPDATE` e `MOUNT_UPDATE` são verificadas antes de iniciar a movimentação.
- O bloqueio de Fog of War é intencional. A versão 0.1 não tenta copiar nem reconstruir a máscara de visibilidade do Owlbear.
- A sincronização visual depende dos eventos da cena e da API de interação do Owlbear; não é um servidor multiplayer paralelo.

## Privacidade e segurança

O código não envia dados da sala para servidores externos. O Three.js e o SDK são dependências de build. Texturas são buscadas diretamente nas URLs já associadas aos itens de imagem do Owlbear.

## Documentação oficial consultada

- https://docs.owlbear.rodeo/extensions/getting-started/
- https://docs.owlbear.rodeo/extensions/reference/manifest/
- https://docs.owlbear.rodeo/extensions/apis/modal/
- https://docs.owlbear.rodeo/extensions/apis/scene/items/
- https://docs.owlbear.rodeo/extensions/apis/scene/fog/
- https://docs.owlbear.rodeo/extensions/apis/interaction/
- https://docs.owlbear.rodeo/extensions/reference/items/image/
- https://docs.owlbear.rodeo/extensions/apis/player/

## Automação do repositório

- A workflow **CI** executa testes unitários, verificação TypeScript e build em cada push para `main` e pull request.
- A publicação no GitHub Pages é manual pelo workflow **Deploy GitHub Pages** depois que a fonte **GitHub Actions** estiver habilitada em Settings → Pages.

## Corrigir erro 404 no manifesto do Owlbear

O endereço do manifesto é:

`https://onze1onze.github.io/Sistema-3-dimensoes/manifest.json`

**A publicação deve usar GitHub Actions, não "Deploy from a branch".** Este projeto precisa do build do Vite: o manifesto e as páginas finais são montados em `dist/`. Quando o Pages publica a raiz do código-fonte via Jekyll, `public/manifest.json` não fica na raiz publicada e o Owlbear recebe 404.

Configuração inicial obrigatória:

1. Abra **Settings → Pages** no repositório.
2. Em **Build and deployment → Source**, selecione **GitHub Actions** (não selecione **Deploy from a branch**).
3. Abra **Actions → Deploy GitHub Pages → Run workflow** e execute na branch `main`.
4. Aguarde o workflow terminar com sucesso. Ele verifica explicitamente `dist/manifest.json`, `dist/index.html`, `dist/viewer.html` e `dist/icon.svg` antes de publicar.

Depois da primeira publicação, alterações em `src/`, `public/` ou nos arquivos de build acionam a publicação automaticamente.

A integração deste repositório consegue enviar código, mas não altera a configuração administrativa **Settings → Pages**. Essa seleção inicial precisa ser feita pelo proprietário do repositório.
