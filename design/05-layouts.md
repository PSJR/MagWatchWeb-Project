# 05 · Layouts Principais

Todo layout é especificado **mobile-first (390 px)** e depois expandido para
desktop (≥1024). Wireframes em ASCII são proporcionais, não literais.

---

## 1. Home (`/`)

### Mobile

```
┌─────────────────────────────┐
│ ⌂ spark.fun   ⬡4663 ⛽ [av] │  header glass 64
├─────────────────────────────┤
│                             │
│   Acenda a sua faísca.      │  display-hero
│   Tokens que nascem em      │
│   100 milissegundos.        │  body-lg, cocoa-600
│                             │
│   [ 🔥 Acender um token ]   │  botão 56, grad-ember
│   [ Explorar a fogueira ]   │  botão ghost
│                             │
│   ~ ilustração da cabana ~  │  260px, parallax leve
├─────────────────────────────┤
│ 🔥 PEGANDO FOGO AGORA       │  overline
│ ┌───────┐ ┌───────┐         │  carrossel horizontal
│ │ hero  │ │ hero  │  →      │  cards 280px
│ └───────┘ └───────┘         │
├─────────────────────────────┤
│ [Bombando][Selvagem][Novos] │  FilterBar sticky
│ ┌─────────────────────────┐ │
│ │      TokenCard          │ │  feed infinito
│ ├─────────────────────────┤ │  novos entram pelo topo
│ │      TokenCard          │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│  ⌂    🔍   (🔥)   👤   💳   │  BottomNav
└─────────────────────────────┘
```

**Hero:** fundo `grad-dusk` com 3 camadas de parallax (montanhas → cabana →
faíscas em primeiro plano, 0.2 / 0.5 / 0.9 de fator). A fumaça da chaminé é um
loop SVG de 6 s. Faíscas sobem continuamente (máx 12 partículas, canvas único).

**Barra "batimento da chain"**: linha de 2 px abaixo do header que pulsa com o
block time — a evidência ambiente de que a Robinhood Chain está viva.

### Desktop (≥1024)

Grid de 12 colunas, `max-width: 1440`.
- SideRail 240 px à esquerda (fixo).
- Hero ocupa 12 col com altura 520; ilustração à direita ocupando 5 col.
- "Pegando fogo agora": 3 hero cards em 12 col.
- Feed: grid de 3 colunas de TokenCard (4 em ≥1600).
- Coluna direita opcional de 300 px: **LiveTradeFeed global** ("o que está
  acontecendo agora na casa") — é a peça que vende a velocidade da chain.

---

## 2. Create (`/create`)

### Mobile — uma tela, sem steps

```
┌─────────────────────────────┐
│ ←   Acender um token        │
├─────────────────────────────┤
│ ┌─── PREVIEW AO VIVO ─────┐ │  sticky no topo, 172px
│ │  [img] $TICKER          │ │  atualiza a cada tecla
│ │  Nome · por @você       │ │
│ │  ▓▓░░░░░ 0% da fogueira │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ Mídia                       │
│ ┌── arraste ou toque ─────┐ │  MediaUploader
│ │        [Ember]          │ │
│ └─────────────────────────┘ │
│ Nome do token   [_________] │
│ Ticker       $ [_________] │
│ Descrição       [_________] │
│ Banner          [+ opcional]│
│ Links  [𝕏][✈][🔗]          │
├─────────────────────────────┤
│ Par de negociação           │
│ [  ETH  ] [ USDC ]          │  D4 PairSelector
├─────────────────────────────┤
│ ╔═ FOGO SELVAGEM ════════╗  │  D3 MayhemToggle
│ ║ [Wick dormindo]   ( ○) ║  │
│ ║ Sobe mais rápido.      ║  │
│ ║ Cai mais rápido.       ║  │
│ ╚════════════════════════╝  │
├─────────────────────────────┤
│ Custo: só o gas ⛽ ~$0.001  │
│ [  🔥 Acender  ]            │  botão 64, full-width
└─────────────────────────────┘
```

### Desktop

Duas colunas: 7/12 formulário à esquerda, 5/12 preview sticky à direita.
O preview mostra **três contextos simultâneos**: card no feed, card no perfil e
Share Card — o criador vê exatamente como o token vai aparecer em todo lugar.

**Estados especiais**
- Ticker já existente: sugestão inline ("$PIZZA já está aceso. Que tal
  $PIZZA2 ou $PIZZAZ?"), sem bloquear.
- Sem gas: banner âmbar com botão "adicionar ETH".
- Publicando: o botão vira a sequência de nascimento (§ 5 de `06-motion.md`).

---

## 3. Token Page (`/t/[address]`)

### Mobile

```
┌─────────────────────────────┐
│ ←  [img] $TICKER      ⋯ ♡   │  header colapsável
├─────────────────────────────┤
│ $0.0₅418      ▲ +128.4%     │  num-lg + PnLDisplay
│ MC $42.8K · Vol 24h $310K   │  num-sm
├─────────────────────────────┤
│                             │
│     BondingCurveChart       │  240px
│     [Curve][Preço][Volume]  │
│                             │
├─────────────────────────────┤
│ 🔥 ▓▓▓▓▓▓▓▓▓░░░░  62%       │  CurveProgressBar
│ faltam $18.2K para graduar  │
├─────────────────────────────┤
│ [Sobre][Trades][Holders][💬]│  Tabs
│ ...conteúdo da aba...       │
├─────────────────────────────┤
│ criador @nome  🥇 Gold      │  card do criador
│ fees gerados $842  [Seguir] │
├─────────────────────────────┤
│ ╔═ BUY ═╦═ SELL ═╗          │  TradePanel
│ ║ 0.05 ETH        ║          │  bottom sheet fixo
│ ║ 25 50 75 MAX    ║          │
│ ║ fees ▸ $0.63    ║          │
│ ║ [ Comprar ]     ║          │
│ ╚═════════════════╝          │
└─────────────────────────────┘
```

### Desktop

Grid 12: **8 col** (gráfico + curve + abas) | **4 col** sticky (TradePanel +
card do criador + LiveTradeFeed do token).
Header expandido com banner do token (200 px) e mídia grande.

**Abas**
- **Sobre**: descrição, links sociais, contrato (copiável), par, data de criação,
  supply, e o "diário do token" (marcos: nascimento, 25%, 50%, 75%, graduação).
- **Trades**: LiveTradeFeed completo com filtros (compras / vendas / baleias).
- **Holders**: HoldersList + gráfico de distribuição.
- **Chat**: CommentThread básico com reações.

**Estado graduado:** o header ganha moldura dourada, a CurveProgressBar é
substituída pelo **card da Chama Eterna** (pool Uniswap V3, liquidez travada,
link do contrato), e o TradePanel troca para "Negociar no Uniswap V3".

---

## 4. Explore / Trending (`/explore`)

```
┌─────────────────────────────┐
│ 🔍 buscar tokens, criadores │
├─────────────────────────────┤
│ [Bombando][Selvagem][Novos] │  FilterBar rolável
│ [MCap][Último trade][Agents]│
│ [Graduados][Quase lá]       │
├─────────────────────────────┤
│ ordenar ▾   grid ▦ / lista ☰│
├─────────────────────────────┤
│ ┌─────┐ ┌─────┐             │  grid 2 col (mobile)
│ │card │ │card │             │  3–4 col (desktop)
│ └─────┘ └─────┘             │
│         ...                 │
└─────────────────────────────┘
```

- **"Quase lá"** (curve > 85%) é um filtro-assinatura: mostra tokens prestes a
  graduar, com a barra tremendo. É o filtro mais adrenalina do produto.
- Trocar filtro nunca mostra tela vazia: o grid antigo sai com stagger enquanto
  o novo entra (sobreposição de 120 ms).
- Cada card no feed atualiza ao vivo; um trade em qualquer card visível dispara
  o flash de direção.
- Densidade: `grid` (padrão), `lista` (informação máxima, 1 linha por token).

---

## 5. Meu Perfil (`/me`) — privado

Detalhamento completo em [`08-profiles.md`](./08-profiles.md).

```
┌─────────────────────────────┐
│  ~ banner com tema escolhido ~
│      [avatar 96 + Pip]      │
│      @nick  0x7f2a…9C41 ⧉   │
│      na casa desde mar/2026 │
│      [🏆][🌱][🔥][💎]        │  BadgeShelf
│      humor de hoje: 😌      │  MoodPicker
├─────────────────────────────┤
│ ┌───────┐ ┌───────┐         │  StatCards 2×2 mobile
│ │Investido│ │ PnL   │        │  4×1 desktop
│ │ $2.4K  │ │+$812 ▲│        │
│ ├───────┤ ├───────┤         │
│ │Tokens │ │ Rank  │         │
│ │  38   │ │  #142 │         │
│ └───────┘ └───────┘         │
├─────────────────────────────┤
│[Portfolio][Histórico][♡][⚡]│
│  ...                        │
└─────────────────────────────┘
```

## 6. Perfil Público (`/u/[handle]`)

Mesma estrutura, sem: valores absolutos de investimento, histórico completo e
configurações. Ganha: botão Seguir, contagem de seguidores, e o recorte
"conquistas" em destaque. Toggle de privacidade controla se PnL % aparece.

## 7. Creator Dashboard (`/creator`)

Detalhamento completo em [`08-profiles.md § B`](./08-profiles.md).

```
┌────────────────────────────────────────────┐
│ ~ banner ~   [avatar+LevelRing 💎 Diamond] │
│ Nome · bio · 1.2K seguidores  [Seguir]     │
│ ╔════════════════════════════════════════╗ │
│ ║ LENHA ACUMULADA                        ║ │
│ ║ $12.482,10          ao vivo ●          ║ │  num-hero, conta ao vivo
│ ║ +$142,80 hoje       [ Sacar 🪵 ]       ║ │
│ ╚════════════════════════════════════════╝ │
│ [24 tokens] [$4.2M volume] [38% graduação] │
├────────────────────────────────────────────┤
│ [Ativos][Graduados][Todos]                 │
│ ┌────────┐┌────────┐┌────────┐             │
│ │ token  ││ token  ││ token  │             │
│ └────────┘└────────┘└────────┘             │
├────────────────────────────────────────────┤
│ Melhor token │ Holders únicos │ Taxa grad. │
├────────────────────────────────────────────┤
│ Creator Room · Feed · Comentários · Ranking│
└────────────────────────────────────────────┘
```

---

## 8. Regras de layout transversais

1. **Nada de tela em branco.** Toda navegação tem skeleton com mascote ou
   transição sobreposta.
2. **Sticky inteligente:** no mobile, TradePanel e FilterBar são sticky; ao
   rolar para baixo eles encolhem, ao rolar para cima reaparecem inteiros.
3. **Safe area** respeitada em iOS (`env(safe-area-inset-bottom)`) no BottomNav
   e no TradePanel.
4. **Largura máxima de leitura** 720 px para blocos de texto longo (bio, sobre).
5. **Densidade adaptativa:** ≥1600 px adiciona uma coluna ao grid, não aumenta
   o tamanho dos cards.
6. **Ordem de foco** segue a ordem visual em todos os layouts; o TradePanel
   sticky vem depois do conteúdo no DOM, com skip-link.
