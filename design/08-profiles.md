# 08 · Perfis — Detalhamento Visual Completo

Três superfícies distintas, uma identidade compartilhada:

| Rota | Nome | Quem vê | Diferença essencial |
|---|---|---|---|
| `/me` | **Meu Perfil** | só o dono | valores absolutos, histórico completo, configurações, fees detalhados |
| `/u/[handle]` | **Perfil Público** | qualquer pessoa | prova social, conquistas, sem valores absolutos por padrão |
| `/creator` | **Creator Dashboard** | só o criador | ferramentas, analytics, saque de fees, Creator Room |

Um usuário que nunca criou um token não vê a camada de criador — ela **cresce**
no perfil dele no instante em que ele acende o primeiro token (com uma animação
de "a casa ganhou um quarto novo").

---

# A. Perfil do Usuário (Trader)

## A.1 Header

```
╔═══════════════════════════════════════════════════════╗
║  ~~~~~~~ banner com tema escolhido (grad-dusk) ~~~~~~ ║  h: 140 mob / 200 desk
║                                     [Pip flutuando]   ║  mascote no canto direito
║   ┌────────┐                                          ║
║   │ avatar │  @gabizinha                    [⚙] [⧉]  ║  avatar 96 squircle
║   │  96px  │  0x7f2a…9C41 ⧉                          ║  wallet Geist Mono 13
║   └────────┘  na casa desde 12 mar 2026 · 174 dias    ║  body-sm cocoa-600
║                                                       ║
║   humor de hoje:  😌  🔥  🤔  😤  🥳  😴              ║  MoodPicker
╚═══════════════════════════════════════════════════════╝
```

- **Avatar:** upload, NFT (com moldura hexagonal e badge de verificação de
  posse) ou **Pip gerado** a partir da wallet. O anel ao redor muda de cor com
  a atividade: cinza (inativo), ember (ativo hoje), wild (em Mayhem).
- **Banner:** 6 temas cozy pré-definidos — *Amanhecer*, *Lareira*, *Anoitecer*,
  *Neve*, *Floresta*, *Fogo Selvagem*. Todos são gradientes suaves com uma
  ilustração de paisagem em silhueta. Upload custom para quem tem badge.
- **Pip** vive no canto direito do banner reagindo ao PnL (ver `07-mascots.md § 3`).
- **Data de entrada** é mostrada com orgulho ("na casa desde…") — reforça
  pertencimento, não é metadado frio.

## A.2 Prateleira de badges

Uma prateleira de madeira ilustrada, com os badges apoiados. Conquistados:
coloridos com brilho lento. Bloqueados: silhueta `ash-100` com cadeado.

| Badge | Ícone | Critério |
|---|---|---|
| **Early Adopter** | 🌱 broto dourado | entre os 10.000 primeiros da plataforma |
| **Top Trader do Dia** | 🏆 troféu | #1 em PnL 24h |
| **Top Trader da Semana** | 👑 coroa | #1 em PnL 7d |
| **Mayhem Survivor** | 🔥 chama violeta | lucro positivo em 3 tokens Mayhem |
| **Sniper** | 🎯 alvo | comprou nos primeiros 60 s de 5 tokens que graduaram |
| **Diamond Hands** | 💎 mão de cristal | segurou um token por 30 dias+ |
| **Fogueira Cheia** | 🪵 lenha | comprou 10 tokens que graduaram |
| **Anfitrião** | 🏠 casa | 100 dias consecutivos na plataforma |
| **Boa Praça** | 🤝 aperto de mão | 50 comentários úteis (reações positivas) |
| **Paciente** | ☕ xícara | 7 dias sem vender durante uma queda de 40%+ |

Hover: o badge levanta da prateleira, gira 15° e abre tooltip com critério +
data de conquista + % de usuários que têm. Conquista nova: cai do topo, quica
2× e solta confete pequeno.

## A.3 Cards de estatística (grandes e fofos)

Grid 2×2 no mobile, 4×1 no desktop. Cada card `radius-xl` de 160 px, com blob
de cor de fundo, ícone ilustrado de 40 px e valor em `num-hero`.

| Card | Conteúdo | Detalhe |
|---|---|---|
| **Total investido** | `$2.412,80` | ícone: cofrinho de porquinho; sub-linha "em 38 tokens" |
| **PnL total** | `+$812,40` `▲ +33,7%` | seta animada; cor mint/coral; toggle $ ⇄ % |
| **Tokens comprados** | `38` | sub-linha "6 ainda na carteira" |
| **Graduados que peguei cedo** | `4` | 🔥 ícone de fogueira; sub-linha "top 5% dos traders" — **é a métrica de orgulho da plataforma** |
| **Rank no leaderboard** | `#142` `▲ 12` | medalha; delta de posição na semana |

**PnL** (componente `C2`): número em `num-hero` Geist Mono, seta triangular
arredondada. Positivo → mint-800, seta com pulo `spring-bouncy`.
Negativo → coral-800, seta descendo devagar com `ease-cozy` (a queda é pesada,
não violenta). Mudança de sinal → flip 3D 360 ms + o Pip troca de humor.
O valor conta para cima na entrada da página (600 ms).

## A.4 Abas

### Portfolio (padrão)
Lista de posições, cada linha 76 px:
```
[img 44] $TICKER            0.42 ETH      [Vender ▾]
         2.4M tokens        ▲ +142.8%
         ▓▓▓▓▓▓░░░ 62%      $1.284,10
```
- Barra da curve embutida (leitura periférica do risco de cada posição).
- **Botão rápido de vender**: abre um mini-sheet com 25/50/75/100% e executa em
  1 clique. O objetivo é sair de uma posição em menos de 3 s.
- Ordenação: valor, PnL, % da curve, mais recente.
- Resumo no topo: valor total, PnL do dia, e um mini gráfico de área de 7 dias.
- Tokens graduados têm moldura dourada; mortos ficam em `grad-ash` e vão para o fim.

### Histórico
Tabela (desktop) / cards (mobile) com todas as compras e vendas:
data-hora, tipo (compra/venda com ícone e cor), token, quantidade, preço médio,
valor em ETH/USDC, fee paga, hash.
Filtros: período, tipo, token, faixa de valor, "só Mayhem".
Exportar CSV. Agrupamento por dia com cabeçalho sticky ("Hoje", "Ontem", data).

### Favoritos
Grid de TokenCards salvos, com badge de "alerta de preço" configurável
(a Kettle apita quando dispara).

### Atividade
Feed vertical estilo linha do tempo, com uma linha ilustrada conectando os
eventos: comprou, vendeu, favoritou, comentou, seguiu, ganhou badge, token que
ele segurava graduou. Cada item tem ícone circular na linha e entra com stagger.

## A.5 Toques aconchegantes

- **Pip reativo ao PnL** — o coração emocional da página.
- **Temas de background** com transição de 560 ms ao trocar (crossfade + leve blur).
- **Mood do dia** que muda o Pip e recolore o banner.
- **"Sua fogueira"**: um widget no rodapé do perfil mostrando uma fogueira cujo
  tamanho reflete a atividade da semana. Streak de dias consecutivos com um
  contador discreto (`🔥 12 dias`). Quebrar o streak não é punido com alarme —
  o Ember só diz "senti sua falta".
- **Cartinha de aniversário de conta**: no aniversário de 1 ano, o perfil ganha
  um confete sutil e um card colecionável.

---

# B. Perfil do Criador

## B.1 Header do criador

```
╔═════════════════════════════════════════════════════════════╗
║ ~~~~~~~~~~~~~ banner personalizado (upload) ~~~~~~~~~~~~~~~ ║  h: 180/260
║                                          [Cinder + tocha]   ║
║  ┌──────────┐                                               ║
║  │  avatar  │  Zé da Fogueira  ✅          [ + Seguir ]     ║  display-md
║  │  128px   │  @zedafogueira · 1.284 seguidores             ║
║  │ ◜LevelRing│  "acendo tokens de comida desde 2026"        ║  bio curta, 1 linha
║  └──────────┘  💎 DIAMOND CREATOR                           ║  overline + emblema
╚═════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════╗
║  🪵 LENHA ACUMULADA                            ao vivo ●     ║  overline
║                                                             ║
║      $12.482,10                                             ║  num-hero 56px
║      +$142,80 hoje  ▲                    [  Sacar 🪵  ]     ║
║                                                             ║
║  ░░░░░░░░░░ pilha de lenha ilustrada crescendo ░░░░░░░░░░   ║
╚═════════════════════════════════════════════════════════════╝

┌───────────┬───────────────┬────────────────┬───────────────┐
│ 24 tokens │ $4,2M volume  │ 38% graduação  │ 8.412 holders │
└───────────┴───────────────┴────────────────┴───────────────┘
```

- **LevelRing** ao redor do avatar (Bronze → Diamond, ver `07-mascots.md § 4`),
  com o progresso para o próximo nível visível no hover.
- **Badge Verified Creator** ✅ ao lado do nome (critérios públicos e checáveis).
- **Card de fees em destaque máximo** — é o número que o criador vem ver.
  Conta ao vivo, dígito por dígito, com um ponto pulsante "ao vivo".
  Cada fee que entra faz o Cinder jogar uma acha no fogo e a pilha de lenha
  ilustrada crescer 1 px (reset visual a cada 24 h).
- **Botão Seguir** com contador que rola e 3 corações guava subindo.

## B.2 Tokens do criador

Filtros em pílulas: `Ativos` | `Graduados` | `Todos` (inclui mortos).
Grid de cards (2 col mobile, 3–4 desktop). Cada card mostra:

```
┌────────────────────────────────┐
│ [img 56]  $TICKER    [GRADUADO]│
│           Nome do token        │
│ MC $180K       Vol 24h $42K    │
│ ▓▓▓▓▓▓▓▓▓▓ 100%                │
│ ─────────────────────────────  │
│ 🪵 gerou $842 em fees          │  ← linha exclusiva do perfil de criador
└────────────────────────────────┘
```

- **Ativos**: card normal com curve em progresso.
- **Graduados**: moldura dourada, selo da Chama Eterna, link para a pool
  Uniswap V3.
- **Mortos**: `grad-ash`, dessaturado, com o mascote Soot. Não são escondidos —
  transparência é parte da confiança. Mas ficam no fim e sem destaque.

## B.3 Estatísticas de criador

Bloco de 4 cards + 1 gráfico:

| Métrica | Visual |
|---|---|
| **Fees lifetime** | `num-hero`, ícone de pilha de lenha |
| **Fees 30 dias** | `num-lg` + gráfico de barras de 30 dias (cartunizado, barras com topo arredondado) |
| **Melhor token** | card mini do token + "gerou $3.2K" + medalha |
| **Taxa de graduação** | anel de progresso (9 de 24 = 38%) com comparação: "média da plataforma: 12%" |
| **Holders únicos** | `8.412` com avatares empilhados dos top 5 |

Gráfico de **fees ao longo do tempo**: área com `grad-ember`, marcadores de
graduação como bandeirinhas douradas no eixo X.

## B.4 Outras seções

- **Sobre o criador**: bio longa (máx 600 caracteres, `body-lg`, medida 62ch),
  links sociais como cards com ícone, e "criador desde".
- **Feed de atualizações**: posts curtos do criador (texto + imagem), estilo
  bilhetes de quadro de avisos, com reações. Holders podem responder.
- **Comentários públicos no perfil**: `CommentThread` com moderação básica
  (o criador pode fixar 1 comentário e ocultar spam).
- **Leaderboard de holders**: ranking dos maiores holders somando todos os
  tokens do criador. Top 3 com medalhas ilustradas. É o mecanismo de
  fidelização — o holder quer aparecer ali.

## B.5 Creator Room 🏠

Página especial (`/creator/[handle]/room`) — a sala de estar do criador.
Só quem tem tokens dele entra (verificação on-chain do saldo).

```
╔══════════════════════════════════════════════╗
║  ~ parede de madeira, luz âmbar de abajur ~  ║
║                                              ║
║   ┌─ quadro de avisos ────────────────────┐  ║
║   │  ┌────────┐ ┌────────┐ ┌────────┐     │  ║  bilhetes em Caveat,
║   │  │ bilhete│ │ bilhete│ │ bilhete│     │  ║  rotação ±2°, fita adesiva
║   │  └────────┘ └────────┘ └────────┘     │  ║
║   └───────────────────────────────────────┘  ║
║                                              ║
║   [Cinder sentado na poltrona]               ║
║                                              ║
║   ┌─ mini-chat dos holders ───────────────┐  ║
║   │ @ana  🐋   oi galera                   │  ║  badge de tier ao lado
║   │ @bia  🌱   comprei no primeiro minuto  │  ║
║   │ [ escreva algo…                      ] │  ║
║   └───────────────────────────────────────┘  ║
╚══════════════════════════════════════════════╝
```

- Bilhetes = avisos do criador (roadmap, agradecimentos, links).
- Chat com tier badge ao lado de cada holder (🌱 novo, 🪵 fiel, 🐋 baleia, 👑 top 1).
- Ambiente com luz de abajur que **muda com a hora do dia real do usuário**.

## B.6 Share Card

Botão flutuante `⧉ Compartilhar` no header do perfil. Gera imagem 1200×675:

```
┌──────────────────────────────────────────────────┐
│  ~ grad-hearth ~                    spark.fun 🔥 │
│  ┌────────┐  Zé da Fogueira  💎 DIAMOND          │
│  │ avatar │  @zedafogueira                       │
│  └────────┘                                      │
│                                                  │
│   24 tokens  ·  $4.2M volume  ·  38% graduação   │
│                                                  │
│   🪵 $12.482 em fees de criador                  │
│                                                  │
│   [Cinder Diamond ilustrado]      ⬡ Chain 4663   │
└──────────────────────────────────────────────────┘
```
3 temas (Hearth / Dusk / Night), toggle para ocultar valores absolutos,
botões: baixar PNG · copiar · postar no X (com texto pré-preenchido).
Existe também Share Card de **trade** e de **graduação**.

---

# C. Estrutura de navegação dos perfis

```
/me                     Meu Perfil (privado)
  ├── portfolio         (padrão)
  ├── historico
  ├── favoritos
  ├── atividade
  └── config            tema, privacidade, notificações, mood

/u/[handle]             Perfil Público
  ├── conquistas        (padrão)
  ├── portfolio         (se o usuário permitir)
  ├── atividade
  └── tokens criados    (só aparece se ele for criador)

/creator                Creator Dashboard (privado, expandido)
  ├── visao-geral       (padrão) — fees, nível, gráficos
  ├── tokens            ativos / graduados / todos
  ├── analytics         holders, retenção, funil de graduação
  ├── fees              extrato detalhado por token e por dia + saque
  ├── room              Creator Room
  └── config            banner, bio, links, verificação

/creator/[handle]       Perfil Público do Criador
```

**Regra de privacidade:** por padrão, o perfil público mostra **percentuais e
contagens**, nunca valores absolutos em dólar do trader. O usuário pode optar
por revelar (alguns querem exibir). O criador é o oposto: fees totais são
públicos por padrão, porque é prova social — e ele pode ocultar se quiser.
