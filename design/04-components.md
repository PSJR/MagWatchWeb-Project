# 04 · Biblioteca de Componentes

Cada componente é especificado como: **anatomia → variantes → estados →
micro-interação → acessibilidade**. Todo componente pressionável herda a
**Squish Lip** (`03-design-tokens.md § 3.1`).

---

## A. Fundamentais

### A1. Button

**Anatomia:** `[ícone-esq] [label] [ícone-dir] [badge opcional]`, altura 48
(lg) / 40 (md) / 32 (sm), padding `space-5` horizontal, `radius-lg`, label em
`label` token.

**Variantes:** `primary` (grad-ember, texto cocoa-900), `buy` (grad-buy, texto
branco), `sell` (grad-sell, texto branco), `secondary` (cream-100, borda
sand-300, texto cocoa-900), `ghost` (transparente → hover ember-50),
`mayhem` (grad-mayhem animado), `gold` (graduação), `danger-soft` (coral-100 +
coral-800). Modificadores: `iconOnly` (quadrado, radius-pill), `fullWidth`.

**Estados & micro-interação**
| Estado | Visual | Motion |
|---|---|---|
| hover | −1px Y, lip 4px, glow da família, brilho varre a superfície | 140 ms `ease-out-soft` |
| active | +3px Y, lip 0, escala 0.98 | 90 ms |
| focus-visible | anel ember 3px + halo 6px | 140 ms |
| loading | label desliza para cima e sai; entra "Fagulha" (3 pontos que viram chama) | 220 ms crossfade |
| success | fill vira mint, ícone ✓ desenha o traço (stroke-dashoffset), 2 faíscas saem das bordas | 480 ms |
| disabled | 45% opacidade, sem lip, cursor `not-allowed`, sem hover | — |

**Detalhe assinatura:** ao segurar (`pointerdown` > 400 ms) um botão primário,
ele emite faíscas contínuas — recompensa por explorar, sem função.

### A2. Input / TextField

**Anatomia:** label acima (13/600) · campo 48 px `radius-md` fundo `cream-200`
com `shadow-inner-warm` · ícone opcional à esquerda · contador de caracteres à
direita · texto de ajuda ou erro abaixo (reserva de altura fixa 18 px, para não
haver salto de layout ao errar).

**Micro-interações**
- **Foco:** a borda cresce de 1 → 2 px e a cor viaja de sand-300 até ember-500
  varrendo da esquerda para a direita (`background-position`), 220 ms.
  O label sobe 2 px e ganha peso 700.
- **Digitação:** a cada caractere, uma faísca minúscula (4 px) aparece no cursor
  e desaparece em 300 ms. Máx. 1 partícula ativa (performance).
- **Válido:** ✓ mint entra com `spring-bouncy` no canto direito.
- **Erro:** shake horizontal de ±4 px, 3 oscilações, 320 ms + borda coral +
  mensagem descendo com fade. **Nunca** cor vermelha pura, nunca ícone de perigo.
- **Contador:** muda para ember-700 em 80% do limite e coral-800 em 100%.

**Variantes:** `text`, `textarea` (auto-grow animado, `spring-gentle`),
`ticker` (uppercase forçado, máx 10, prefixo `$` fixo em cocoa-600),
`amount` (Geist Mono, botões de atalho 25/50/75/MAX abaixo),
`url-social` (ícone da rede detectado automaticamente ao colar).

### A3. Toggle / Switch

Pílula 52×30, thumb 26 px. Off: `sand-300`. On: `grad-ember`.
Ao ligar, o thumb faz overshoot (`ease-pop`) e o trilho tem um flash de brilho
que corre da esquerda para a direita. **Toggle do Mayhem Mode** é especial (ver D3).

### A4. Chip / Tag / Badge

`radius-pill`, altura 26, padding 10, `caption` 600. Famílias: neutro,
mint (alta), coral (baixa), wild (mayhem), gold (graduado), orbit (chain),
ash (morto). Badges de conquista têm ícone preenchido + micro-brilho contínuo
(1 varredura a cada 6 s, apenas quando visível no viewport).

### A5. Card (base)

`radius-xl`, `--bg-surface`, `shadow-sm`, borda 1px `sand-300`, padding
`space-4`/`space-5`. **Hover:** sobe 3 px, `shadow-md`, borda → sand-400, e a
imagem interna sofre `scale(1.04)` com `overflow: hidden` (efeito Ken Burns
sutil). **Press:** afunda 1 px. Tilt 3D opcional (±4°, `perspective: 900px`)
apenas em desktop com ponteiro fino e `prefers-reduced-motion: no-preference`.

### A6. Tabs

Pílula deslizante: o indicador é um único elemento que faz **layout morph**
(FLIP) entre as abas com `spring-snappy`, esticando levemente na direção do
movimento (squash & stretch: `scaleX` 1.12 no meio do trajeto, volta a 1).
Aba ativa em Fredoka 500 cocoa-900; inativa Jakarta 500 cocoa-600.

### A7. Modal / Sheet

Desktop: modal centralizado `radius-2xl`, entra com `scale .94 → 1` + fade,
360 ms `ease-pop`. Backdrop: `rgba(46,32,25,.42)` + `blur-glass-lg`, 220 ms.
Mobile: **bottom sheet** `radius-3xl` no topo, com "grabber" de 40×5 px,
arrastável, snap points 45%/92%, física de spring com resistência elástica
(rubber-band) além dos limites.

### A8. Toast (Sonner-style)

Canto inferior-direito (desktop) / topo (mobile). Glass md, `radius-lg`,
entra deslizando 24 px + fade, 220 ms; pilha até 3 com escala decrescente
(1, .96, .92) e desfoque progressivo. Toast de trade traz mini-avatar do token
e a faísca de confirmação. Auto-dismiss 4 s, com barra de progresso fina na
base na cor da família.

### A9. Tooltip / Popover

Fundo cocoa-900 (light) com texto cream-50, `radius-md`, seta arredondada.
Entra com `scale .92 → 1` + 4 px de deslocamento, 140 ms. Delay de abertura
400 ms, fechamento 80 ms. Popovers de conteúdo rico usam glass.

### A10. Skeleton / Loading

**Nunca** um shimmer cinza. Skeletons são **blocos creme com um brilho âmbar
que atravessa** em 1.6 s (`linear-gradient` 120°, `background-position`).
Cards em skeleton têm um mini-Ember dormindo (zZz) no canto.

### A11. Empty State

Ilustração de mascote + título Fredoka + 1 linha de corpo + 1 CTA.
Nunca uma caixa vazia. Catálogo em `10-content-and-microcopy.md`.

### A12. Avatar

Squircle (usuário) ou círculo (token). Anel de status opcional:
gold = criador verificado, wild = em Mayhem, orbit = online.
Fallback: mascote **Pip** gerado deterministicamente a partir do endereço da
wallet (cor de corpo + acessório derivados do hash — 4.096 combinações).

### A13. Progress (genérico)

Trilho `cream-200` `radius-pill` 10 px; preenchimento com `grad-ember` e um
**brilho que corre** dentro dele (2.4 s loop). Ver B3 para a variante da curve.

### A14. Data Table

Linhas de 52 px, zebra com `cream-100` a 40%, header sticky com glass, ordenação
com seta que gira 180° em 220 ms. Em mobile vira lista de cards.
Números sempre `num-sm` tabular alinhado à direita.

---

## B. Componentes de Trading

### B1. TokenCard ⭐ (componente mais importante do produto)

**Anatomia (mobile 358×172):**
```
┌───────────────────────────────────────────────┐
│ [img 64 squircle]  $TICKER          [♡]       │
│                    Nome do Token              │
│                    por @criador · 4 min       │
│                                               │
│ MC $42.8K   ▲+128%          [chip MAYHEM]     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  62% da fogueira 🔥      │
└───────────────────────────────────────────────┘
```
- Imagem com anel de progresso da curve ao redor (conic-gradient) — o anel é a
  leitura periférica: o usuário vê "quão quente" sem ler número.
- Sparkline de 24 h atrás do conteúdo, a 12% de opacidade, na cor do trend.
- Chips condicionais: `MAYHEM`, `GRADUADO`, `NOVO` (< 10 min), `AGENT`.
- Estado morto: `grad-ash`, saturação 20%, mascote com brasa apagada.

**Micro-interações**
| Gatilho | Resposta |
|---|---|
| hover | eleva 3 px, imagem `scale 1.04`, chama do canto anima 12 fps, botões rápidos `BUY` deslizam de baixo |
| trade acontecendo em tempo real | flash de background 8% na cor da direção (mint/coral) por 300 ms, borda pulsa 1× |
| curve avança | barra e anel animam com `spring-gentle`; ao cruzar 25/50/75%, uma faísca sai do card |
| favoritar | coração faz `scale 0 → 1.4 → 1` + explosão de 6 corações minúsculos |
| press | afunda 1 px |
| entrada no feed | novo card entra pelo topo com `spring-bouncy` e empurra os demais (layout animation) |

**Variantes:** `grid` (padrão), `list` (72 px, denso), `hero` (destaque na Home,
2× com vídeo em loop), `mini` (portfolio/perfil, 56 px).

### B2. BondingCurveChart

Área + linha, cartunizada: linha de 3 px com terminação arredondada,
gradiente mint→ember ao longo do eixo X, área preenchida com `mint-300` a 35%
e um **padrão de ondinha** na borda superior (não uma linha reta).

- **Ponto ao vivo:** um pequeno Ember correndo sobre a linha, com rastro de 3
  faíscas. Ele "pula" a cada trade novo (squash & stretch).
- **Marcador de graduação:** bandeirinha dourada no ponto de 100% com um leve
  balanço perpétuo (±3°, 3 s).
- **Zona de Mayhem:** faixa violeta translúcida no fundo quando ativo.
- **Crosshair:** linha pontilhada cocoa-600 com pill de preço em Geist Mono
  seguindo o dedo/cursor; haptics (`vibrate(4)`) a cada cruzamento de vela no mobile.
- **Atualização a 100 ms:** o gráfico **não** re-renderiza a cada bloco.
  Buffer de 250 ms + interpolação; a linha se move continuamente
  (`requestAnimationFrame`), dando sensação de fluidez líquida em vez de
  saltos. Este é o detalhe que faz a velocidade da chain parecer *suave*.
- Toggle Curve / Preço / Volume com o mesmo indicador deslizante das Tabs.

### B3. CurveProgressBar (0–100%)

Componente-assinatura. Trilho de 14 px com aparência de **tora de lenha**
(textura sutil), preenchido com `grad-ember` animado; na ponta do
preenchimento existe uma **chama viva** (SVG de 3 camadas com morphing,
14 fps, cartoon). Marcos em 25/50/75% desenhados como gravetos.
Ao passar de um marco: a chama cresce 15% por 400 ms e solta 4 faíscas.
Aos 95%: a barra inteira começa a tremer levemente (±0.5 px) e o texto muda
para "quase lá…". Aos 100%: dispara a sequência de graduação (`06-motion.md`).
Label: `62% da fogueira` + `$18.2K para graduar`.

### B4. TradePanel (Buy / Sell)

Card sticky (desktop, coluna direita) / bottom sheet (mobile).
- Toggle segmentado BUY | SELL com indicador deslizante que **muda a cor de
  acento do painel inteiro** (mint ↔ coral) numa transição de 220 ms.
- Campo de valor grande (`num-lg`) + atalhos 25% / 50% / 75% / MAX + toggle da
  moeda (ETH ⇄ USDC ⇄ token).
- **Fee breakdown** sempre visível (não escondido em accordion):
  ```
  Você recebe        1.284.221 $TICKER
  ─────────────────────────────────────
  Fee do criador  1.0%      $0.42   🪵
  Fee do protocolo 0.5%     $0.21   ✨
  Gas (Robinhood Chain)     ~$0.001 ⛽
  ```
  Cada linha tem tooltip amigável. O ícone 🪵 (lenha) reforça que a fee do
  criador "alimenta a fogueira dele".
- **Slippage** em pílula discreta; abre popover com 0.5/1/3%/custom.
- Botão de ação de 56 px, full-width, com o texto do valor embutido:
  `Comprar por 0.05 ETH`.
- **Fluxo de 1 clique:** com "Turbo" ligado (opt-in), o clique executa sem
  modal de confirmação, usando o allowance pré-aprovado. O botão vira ✓ em
  120 ms — antes mesmo do recibo chegar.

### B5. TradeReceipt / FeedbackDeTrade

Sequência de 900 ms disparada no sucesso — ver `06-motion.md § 4`.
Toast com: avatar do token, quantidade, preço médio, hash truncado clicável,
e um botão "compartilhar" que gera Share Card.

### B6. LiveTradeFeed

Lista de linhas de 44 px que entram pelo topo com `spring-snappy`.
Cada linha: avatar 24, `@nick`, `comprou`/`vendeu`, valor, tempo relativo
(`agora`, `2s`, `1m`). Fundo mint-50/coral-50 a 40% que **desvanece para
transparente em 1.2 s** (o "rastro de calor"). Máx 40 linhas em DOM
(virtualização). Pausa automática no hover.

### B7. HoldersList

Barra de distribuição no topo (top 10 vs resto), depois lista com posição,
avatar, wallet truncada, %, valor. Badge 👑 para o criador, 🌱 para "comprou nos
primeiros 60 s", 🐋 para > 3%.

### B8. GraduationBanner / GraduationOverlay

Overlay full-screen com `grad-bonfire`, o mascote Ember virando **Bonfire**,
e um cartão dourado de confirmação:
```
🔥 GRADUOU!
$TICKER acendeu a fogueira grande.

✅ Pool criada no Uniswap V3 (Robinhood Chain)
🔒 Liquidez travada para sempre · verificar contrato ↗
💧 Faixa de liquidez: full-range
🧾 Pool: 0x9a3f…21bd
```
Botões: `Negociar no Uniswap V3` (primário) · `Compartilhar` · `Voltar`.

### B9. ChainBadge

Pílula orbit-100 com texto orbit-700: `⬡ Robinhood Chain · 4663` + ponto
pulsante sincronizado ao block time. Clique abre popover com block height ao
vivo, gas médio, latência do RPC e um mini-gráfico de tempo de bloco.

### B10. GasPill

`⛽ ~$0.001` com Ember soprando a moeda a cada 8 s. Se o gas subir 5× acima da
média, muda para ember-100 e o mascote abana o ar — nunca alarme.

---

## C. Componentes Sociais e de Perfil

### C1. StatCard (grande e fofo)

Card `radius-xl` de 160 px com: ícone ilustrado 40 px, label overline, valor em
`num-hero`, delta com seta. O valor **conta para cima** na entrada
(600 ms, `ease-out-soft`, com easing na taxa de dígitos). Fundo com blob suave
da família correspondente.

### C2. PnLDisplay

Número em `num-hero` + seta triangular arredondada. Positivo: mint-800, seta
para cima com um pequeno pulo (`spring-bouncy`) a cada atualização.
Negativo: coral-800, seta desce com peso (`ease-cozy`, mais lenta — a queda é
*pesada*, não *violenta*). Mudança de sinal: o número faz um flip 3D no eixo X
(360 ms) e o mascote do perfil troca de humor.

### C3. BadgeShelf

Prateleira de madeira (literalmente, ilustrada) com badges apoiados nela.
Badges conquistados: coloridos, com brilho lento. Não conquistados: silhueta
em ash-100 com cadeado. Hover: o badge levanta da prateleira, gira 15° e mostra
tooltip com critério e data. Novo badge: cai do topo, quica 2× e solta confete.

### C4. LevelRing (Creator Level)

Anel de progresso ao redor do avatar do criador, com cor do nível
(Bronze `#C88A5A` → Silver `#B9C2CC` → Gold `#FFC24D` → Platinum `#8FE2DC` →
Diamond `#B6A8FF` com brilho iridescente animado). Ao subir de nível: o anel
completa a volta, explode em partículas e o novo emblema desce e se encaixa
com um "clunk" visual.

### C5. FollowButton

`Seguir` → `Seguindo ✓`. Ao clicar: o botão encolhe para pílula, o ✓ desenha,
o contador incrementa com roll de dígitos, e 3 corações guava sobem.
Ao desseguir: confirmação inline (hold-to-confirm de 600 ms com anel
preenchendo) — evita desseguir por acidente sem usar modal.

### C6. MoodPicker

Fileira de 6 emojis-mascote. O selecionado infla (`scale 1.25`) e recebe um
brilho; os demais recuam. A escolha muda a expressão do mascote do perfil e o
gradiente do banner.

### C7. ShareCard Generator

Modal com preview 1200×675 do card gerado (perfil ou trade), 3 temas
(Hearth, Dusk, Night) e toggle de dados. Botões: baixar PNG / copiar / abrir X.
Durante a geração, o card faz um "polaroid develop": entra desfocado e
dessaturado e ganha nitidez em 900 ms.

### C8. CreatorRoomPanel

Painel com aparência de sala: parede de madeira, quadro de avisos com bilhetes
(mensagens do criador em Caveat, presos com fita adesiva), e um mini-chat de
holders. Cada bilhete tem rotação aleatória de ±2°.

### C9. CommentThread

Bolhas `radius-xl` com cauda arredondada, avatar 32, reações em emoji com
contador. Nova mensagem entra com `spring-snappy` de baixo. "Digitando…" é
representado por 3 faíscas quicando.

### C10. LeaderboardRow

Posição em Fredoka (1º/2º/3º com medalhas ilustradas), avatar, nick, métrica,
delta de posição (▲2 / ▼1). Reordenação usa layout animation `spring-gentle` —
as linhas deslizam fisicamente para as novas posições, nunca dão cut.

---

## D. Componentes de Criação e Onboarding

### D1. CreateForm (wizard de 1 tela)

Coluna esquerda = campos; coluna direita = **preview ao vivo do TokenCard**
(sticky). Cada tecla digitada atualiza o preview em ≤ 16 ms.
Campos: Nome · Ticker · Mídia (imagem/vídeo) · Descrição · Banner ·
Links sociais (X, Telegram, Website) · Par (ETH | USDC) · Mayhem Mode.

### D2. MediaUploader

Zona de drop `radius-2xl` com borda tracejada estilo costura. Ao arrastar por
cima, a zona infla 2%, a borda gira lentamente (marching ants suave) e o Ember
levanta os braços. Upload: a imagem cai dentro com `spring-bouncy` e é cortada
em squircle. Vídeo: preview em loop mudo com badge `VÍDEO`. Erro de tamanho:
o Ember segura a imagem com esforço e o texto sugere comprimir.

### D3. MayhemToggle ⭐

Bloco dedicado, não um switch de linha. Card com `wild-100`, borda `wild-300`.
- **Desligado:** o card está calmo, o mascote **Wick** dorme no canto.
- **Ao ligar:** o card inteiro faz um "surto" — `grad-mayhem` começa a correr,
  micro-relâmpagos violeta nas bordas, Wick acorda de sobressalto e ri, e o
  card treme com `spring-jelly` por 500 ms. O restante da UI ganha um leve
  vinheta violeta por 1 s.
- **Explicação amigável sempre visível** (nunca escondida em tooltip):
  > **Fogo Selvagem** 🔥 Sem limite de compra por carteira, fees maiores para
  > o criador e uma curva mais íngreme. Sobe mais rápido. Cai mais rápido.
  > Não dá para desligar depois de acender.
- Confirmação: hold-to-confirm de 800 ms com o anel preenchendo em violeta.

### D4. PairSelector

Duas cartas grandes lado a lado: **ETH** (ícone diamante, "gas nativo da
Robinhood Chain") e **USDC** (ícone moeda, "preço estável, market cap legível").
A carta selecionada levanta, ganha anel ember e a não selecionada dessatura.

### D5. CreateButton + celebração

Botão de 64 px com `grad-ember` e uma chama viva na esquerda.
No clique: o botão comprime, vira o "riscar de um fósforo" (a chama corre da
esquerda para a direita), e explode na sequência de nascimento do token
(`06-motion.md § 5`).

### D6. WalletConnect (RainbowKit-style)

Modal com carteiras em cards grandes com ícone 48, hover que levanta.
Aba secundária: **e-mail / social** (estilo Privy) com campo grande e
"enviamos um código". Ao conectar: o avatar desce no header com `spring-bouncy`,
o ChainBadge acende, e um toast diz "Bem-vindo à casa 🏠".
Se a rede estiver errada: banner âmbar (não vermelho) — "Você está em outra
casa. Trocar para a Robinhood Chain?" + botão que troca em 1 clique.

### D7. FilterBar (Explore)

Chips roláveis horizontalmente: `Bombando` · `Fogo Selvagem` · `Novos` ·
`Market Cap` · `Último trade` · `Agents` · `Graduados` · `Quase lá`.
O chip ativo tem fundo ember-500 e o indicador desliza com `spring-snappy`.
Trocar de filtro faz o grid inteiro sair com stagger e voltar com stagger
(120 ms de sobreposição, nunca uma tela em branco).

### D8. SearchCommand (⌘K)

Overlay glass com campo grande, resultados agrupados (Tokens · Criadores ·
Wallets), navegação por teclado, preview à direita. Abre com `scale .96 → 1`,
180 ms. Digitação filtra com highlight animado nos trechos que casam.

---

## E. Layout / Chrome

### E1. AppHeader

Glass md sticky, 64 px. Esquerda: logo spark.fun (a estrela-faísca pisca a cada
10 s). Centro: busca (desktop). Direita: ChainBadge · GasPill · avatar/conectar.
Ao rolar para baixo, encolhe para 52 px e aumenta o blur (220 ms).

### E2. BottomNav (mobile)

5 itens: Início · Explorar · **Acender** (FAB central elevado, ember, 60 px) ·
Perfil · Carteira. O item ativo tem o ícone preenchido e um ponto ember abaixo
que desliza entre os itens. O FAB pulsa muito sutilmente a cada 12 s.

### E3. SideRail (desktop ≥1024)

Barra de 240 px com navegação, atalhos, e um widget de "Fogueira do dia"
(token mais quente) na base.

### E4. PageTransition

Transição entre rotas: fade + 8 px de deslocamento vertical, 220 ms, com o
conteúdo antigo saindo 60 ms antes do novo entrar. Nunca tela branca.
Navegação para Token Page usa **shared element transition**: o avatar do token
no card voa até a posição do header da página.
