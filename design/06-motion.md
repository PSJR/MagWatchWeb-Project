# 06 · Motion — Animações e Micro-interações

> **Lei do movimento em spark.fun:** a animação existe para explicar
> *causa e efeito* ou para *recompensar*. Se ela não faz nenhuma das duas,
> ela é ruído e deve ser cortada.

Todos os tokens (`dur-*`, `ease-*`, `spring-*`, `stagger-*`) vêm de
[`03-design-tokens.md § 5`](./03-design-tokens.md).

---

## 1. Diretrizes de motion

1. **Origem física.** Todo elemento entra vindo de onde ele "mora": um sheet
   sobe do fundo, um dropdown desce do gatilho, um toast entra da borda. Nada
   aparece do nada.
2. **Squash & stretch em tudo que é fofo.** Mascotes, badges, botões e o ponto
   do gráfico deformam (máx. 12% de deformação) — é o que separa "animado" de
   "cartoon".
3. **Antecipação antes de ações grandes.** Antes do confete, o botão comprime
   80 ms. Antes da graduação, a tela escurece 200 ms e faz silêncio visual.
4. **Assimetria de duração.** Entrada é mais lenta que saída (220 ms vs 140 ms).
   Ganhos animam rápido e alegre; perdas animam devagar e pesado.
5. **Uma estrela por vez.** Nunca duas animações celebratórias simultâneas.
   Existe uma fila global de celebração (`CelebrationQueue`) que serializa
   confete, graduação e level-up.
6. **Latência é escondida, nunca exibida.** Com blocos de ~100 ms, spinner é
   um erro de design. O padrão é otimista: reage em 120 ms, reconcilia depois.
7. **Loops ambientes são lentos e sutis.** Nada que faça loop em menos de 2.5 s
   fica em tela permanentemente (exceto o fogo, que é o ponto focal).
8. **Só `transform` e `opacity`** em qualquer animação de 60 fps. `width`,
   `height`, `top`, `box-shadow` animados são proibidos em caminho crítico
   (use `scale`, `translate`, camadas duplicadas com crossfade).
9. **Tudo respeita `prefers-reduced-motion`** (ver `09`).

---

## 2. Micro-interações — catálogo completo

### 2.1 Botões
| # | Gatilho | Animação | Duração / curva |
|---|---|---|---|
| B-01 | hover | Y −1 px, lip 3→4 px, glow entra | 140 `ease-out-soft` |
| B-02 | hover (primário) | brilho diagonal varre a superfície | 600 `linear`, 1× |
| B-03 | press | Y +3 px, `scale .98`, lip → 0 | 90 `ease-out-soft` |
| B-04 | release | volta com overshoot | 180 `ease-pop` |
| B-05 | hold > 400 ms | faíscas contínuas saem das bordas | loop |
| B-06 | loading | label sobe e sai, "Fagulha" entra | 220 crossfade |
| B-07 | sucesso | fill → mint, ✓ desenha traço, 2 faíscas | 480 `spring-snappy` |
| B-08 | erro | shake ±4 px × 3 | 320 `ease-cozy` |
| B-09 | disabled→enabled | fade + `scale .96→1` | 220 `ease-pop` |
| B-10 | foco por teclado | anel cresce de 0 → 3 px + halo | 140 |

### 2.2 Inputs
| # | Gatilho | Animação |
|---|---|---|
| I-01 | focus | borda 1→2 px, cor varre L→R (220), label sobe 2 px e engrossa |
| I-02 | keypress | faísca de 4 px no cursor, some em 300 ms |
| I-03 | válido | ✓ mint entra com `spring-bouncy` |
| I-04 | inválido | shake ±4 × 3 + borda coral + mensagem desce com fade |
| I-05 | contador 80% | cor → ember-700 com crossfade 140 |
| I-06 | textarea auto-grow | altura via `spring-gentle` (grid-template-rows) |
| I-07 | colar link social | ícone da rede aparece com pop e o campo pisca mint |
| I-08 | limpar campo | texto desliza para a direita e some, X gira 90° |

### 2.3 Cards
| # | Gatilho | Animação |
|---|---|---|
| C-01 | hover | Y −3 px, `shadow-sm→md`, imagem `scale 1.04` | 220 `ease-out-soft` |
| C-02 | hover (desktop, ponteiro fino) | tilt 3D ±4° seguindo o cursor | rAF, lerp .12 |
| C-03 | press | Y +1 px, `scale .995` | 90 |
| C-04 | entrada no grid | fade + Y 12 px, com `stagger-base` | 220 |
| C-05 | trade ao vivo no card | flash de fundo 8% mint/coral | 300 `ease-out-soft` |
| C-06 | avanço da curve | barra + anel com `spring-gentle` | — |
| C-07 | marco 25/50/75% | chama +15% e 4 faíscas saem | 400 `ease-pop` |
| C-08 | favoritar | ♡ `scale 0→1.4→1` + 6 corações em leque | 520 `spring-bouncy` |
| C-09 | reordenação do feed | FLIP layout animation | `spring-gentle` |
| C-10 | card morre | dessatura para ash, encolhe 2%, fumacinha sobe | 900 `ease-cozy` |

### 2.4 Navegação
| # | Gatilho | Animação |
|---|---|---|
| N-01 | troca de rota | fade + Y 8 px, saída 60 ms antes da entrada | 220 |
| N-02 | card → Token Page | shared element: avatar voa para o header | 360 `ease-out-soft` |
| N-03 | troca de aba | pílula faz morph com `scaleX 1.12` no meio | `spring-snappy` |
| N-04 | scroll para baixo | header 64→52 px, blur aumenta | 220 |
| N-05 | item do BottomNav | ícone preenche + ponto ember desliza | 180 `spring-snappy` |
| N-06 | abrir ⌘K | overlay `scale .96→1` + blur do fundo | 180 |
| N-07 | troca de filtro | grid sai com stagger, entra com stagger sobreposto | 120+220 |
| N-08 | pull-to-refresh (mobile) | Ember é esticado e volta quicando | `spring-bouncy` |

### 2.5 Dados ao vivo
| # | Gatilho | Animação |
|---|---|---|
| D-01 | preço muda | dígito faz roll vertical (só o dígito alterado) | 180 `ease-out-soft` |
| D-02 | preço sobe | flash de fundo mint 6% no slot | 300 |
| D-03 | preço cai | flash coral 6%, 40% mais lento | 420 |
| D-04 | nova linha no feed | entra do topo empurrando as demais | `spring-snappy` |
| D-05 | rastro de calor | fundo da linha desvanece para transparente | 1200 `linear` |
| D-06 | contador de stat | conta até o valor com desaceleração | 600 `ease-out-soft` |
| D-07 | ponto do gráfico | Ember corre pela linha com rastro de 3 faíscas | contínuo |
| D-08 | bloco novo da chain | ponto do ChainBadge pulsa (agrupado 10×) | 300 |
| D-09 | gráfico atualiza | interpolação contínua, buffer de 250 ms | rAF |

### 2.6 Sociais e perfil
| # | Gatilho | Animação |
|---|---|---|
| S-01 | seguir | botão encolhe, ✓ desenha, contador rola, 3 corações sobem | 620 |
| S-02 | desseguir | hold 600 ms com anel preenchendo | 600 `linear` |
| S-03 | novo badge | cai do topo, quica 2×, confete pequeno | 900 `spring-bouncy` |
| S-04 | hover em badge | levanta da prateleira e gira 15° | 220 `ease-pop` |
| S-05 | mudar humor | emoji infla 1.25, mascote troca de expressão, banner recolore | 360 |
| S-06 | PnL muda de sinal | número faz flip 3D no eixo X, mascote troca de humor | 360 |
| S-07 | level up do criador | anel completa, explode, emblema desce e encaixa | 1600 |
| S-08 | gerar Share Card | "polaroid develop": desfoque+dessaturação → nitidez | 900 |
| S-09 | nova mensagem no chat | bolha entra de baixo com pop | `spring-snappy` |
| S-10 | "digitando…" | 3 faíscas quicando em sequência | loop 900 |

### 2.7 Estados de sistema
| # | Situação | Animação |
|---|---|---|
| Y-01 | skeleton | brilho âmbar atravessa o bloco | 1600 loop |
| Y-02 | empty state | mascote faz idle (respirar + piscar) | loop 4 s |
| Y-03 | erro de rede | Ember segurando um fio desconectado, balança | loop 3 s |
| Y-04 | rede errada | banner âmbar desce do topo com `spring-gentle` | 360 |
| Y-05 | offline | tudo dessatura 30% e o fogo diminui | 560 |
| Y-06 | reconectou | fogo cresce de volta + faísca sobe | 560 |

---

## 3. Animações ambientes (sempre em tela)

| Nome | Descrição | Custo |
|---|---|---|
| **Chama viva** | SVG de 3 camadas com morphing de path, 14 fps (não 60 — o "stop-motion" é intencional e mais cartoon) | baixo |
| **Faíscas do hero** | máx. 12 partículas num único `<canvas>`, sobem com deriva senoidal | baixo |
| **Fumaça da chaminé** | 3 blobs com `translateY` + `scale` + fade, 6 s, desfasados | baixo |
| **Respiração de card** | `scale` 1 → 1.004 em 4 s, só nos cards em destaque (máx 3) | baixo |
| **Heartbeat da chain** | ver § 6 | baixo |
| **Grain** | overlay estático (sem animação) | zero |

Todas pausam via `IntersectionObserver` quando fora do viewport e via
`document.visibilitychange` quando a aba está oculta.

---

## 4. Sequência: **Trade confirmado** (a mais frequente do produto)

Orçamento total: **900 ms**, mas o usuário percebe sucesso aos **120 ms**.

```
t=0      clique. Botão comprime (scale .98) — 90ms, ease-out-soft
t=60     assinatura enviada (otimista). Ripple ember sai do ponto de toque.
t=120    ✅ Botão vira mint, ✓ desenha o traço. → PERCEPÇÃO DE SUCESSO
t=140    Faísca-cometa nasce no botão e voa até o ChainBadge no header,
         num arco Bézier, 320ms, ease-fire, com rastro de 6 pontos.
t=200    Confetti: 18 partículas (chamas, moedas, corações, marshmallows),
         emitidas em leque de 120°, gravidade 0.4, rotação aleatória,
         desaparecem em 700ms. NUNCA mais de 24 partículas.
t=220    Mascote Ember reage: BUY → pulo + braços para cima ("yeah!");
         SELL → aceno tranquilo ("valeu!"). 520ms, spring-bouncy.
t=260    Números atualizam: saldo, holdings, preço (roll de dígitos).
         CurveProgressBar avança com spring-gentle.
t=300    Faísca chega no ChainBadge → o badge pulsa 1× em orbit-300.
t=340    Toast entra com recibo + hash truncado.
t=900    Estado de repouso. Botão volta ao normal.
```

**Venda** usa a mesma estrutura com coral, sem confete (celebrar venda é
estranho) — em vez disso, uma "brasa" desce suavemente e o Ember dá um tchauzinho.

**Falha** (raro): o botão treme, um mascote aparece com um balde d'água,
mensagem em linguagem humana, e o botão volta ao estado original com o valor
preservado. Nunca limpar o formulário.

---

## 5. Sequência: **Nascimento do token** (Create)

Orçamento: **2.400 ms**. É o primeiro "wow" que o usuário vive.

```
t=0     Botão comprime.
t=100   Riscar do fósforo: uma chama corre da esquerda para a direita do botão,
        deixando um rastro; um "flash" branco-âmbar de 60ms.
t=300   O botão se transforma no card do token (shared element morph):
        as bordas viajam e o preview vira o card real. 560ms, ease-out-soft.
t=600   O card cai no centro da tela e quica 2×. spring-bouncy.
t=900   Uma fogueirinha acende embaixo do card. A CurveProgressBar aparece em 0%
        e sobe até a primeira compra do criador (se houver).
t=1200  Ember sai de dentro do card, dá uma cambalhota e senta ao lado da chama.
t=1500  Confete quente (24 partículas) + o texto "Está aceso 🔥" em display-md
        entra com stagger de letras (40ms cada).
t=1900  Card do compartilhamento desliza de baixo: [Ver token] [Compartilhar]
t=2400  Repouso. A tela já é a Token Page (transição foi contínua).
```

---

## 6. Sequência: **Graduation** (o momento mais importante da marca)

Orçamento: **6.000 ms**, com opção de pular após 1.5 s (`Esc` ou toque).
Dispara para todos os espectadores da Token Page em tempo real.

```
FASE 1 — TENSÃO (0–1200ms)
t=0     A CurveProgressBar chega a 100%. Todo som ambiente visual PARA:
        faíscas congelam, o fogo encolhe, a tela escurece 12% com vinheta.
        (silêncio visual = antecipação)
t=400   A barra inteira vibra ±1px e brilha em branco-quente.
t=900   Um estalo: a barra "quebra" ao meio e as duas metades caem.

FASE 2 — EXPLOSÃO (1200–3000ms)
t=1200  Overlay full-screen com grad-bonfire entra por wipe radial do centro.
t=1300  Onda de choque: anel dourado expande do centro até fora da tela,
        600ms, ease-fire. Todo o conteúdo atrás sofre scale .96 (recuo).
t=1500  Ember cresce e se transforma em BONFIRE (mascote graduado):
        maior, com coroa de brasas, olhos brilhantes. Morph de 800ms.
t=1700  120 partículas douradas em explosão radial + 40 faíscas subindo
        continuamente. (único momento do produto com >24 partículas)
t=2200  Título entra: "$TICKER GRADUOU" em display-hero, letra por letra,
        stagger 45ms, cada letra com scale 1.3→1 e overshoot.

FASE 3 — A CHAMA ETERNA (3000–5000ms)
t=3000  Cartão dourado sobe de baixo com spring-gentle:
          ✅ Pool criada no Uniswap V3 · Robinhood Chain
          🔒 Liquidez travada para sempre
          🧾 0x9a3f…21bd  [ver contrato ↗]
t=3400  Uma lanterna ilustrada desce; um cadeado dourado se fecha nela com
        um "click" visual (scale bump) e passa a emitir luz constante.
        Este é o símbolo permanente da liquidez travada.
t=4000  A curve antiga (linha do gráfico) se dissolve em partículas que
        se reagrupam formando o logo do Uniswap V3 — a transição visual
        explícita de "bonding curve → pool".

FASE 4 — REPOUSO (5000–6000ms)
t=5000  Botões entram: [Negociar no Uniswap V3] [Compartilhar] [Voltar]
t=5600  Overlay desvanece; a Token Page volta, agora com moldura dourada
        permanente e o card da Chama Eterna no lugar da CurveProgressBar.
```

**Versão espectador (feed):** quem está no Explore vê uma versão de 1.2 s —
o card do token brilha, sobe acima dos outros, solta faíscas douradas e
mostra o chip `GRADUOU`. Sem overlay full-screen (seria abusivo).

---

## 7. Sequência: **Level Up do criador**

```
t=0     Anel do avatar completa a volta com brilho crescente. 800ms.
t=800   Explosão de 20 partículas na cor do novo nível.
t=1000  Emblema do novo nível desce do topo, gira, e encaixa no anel
        com um bump de escala (1.4 → 1). spring-bouncy.
t=1400  O mascote Cinder do criador ganha o acessório do novo nível
        (ver 07-mascots.md) com um pop.
t=1600  Toast: "Você virou Gold 🥇 — fees do criador agora com bônus."
```

---

## 8. Orquestração e regras técnicas

- **Fila de celebração:** `CelebrationQueue` serializa graduação > level-up >
  novo badge > confete de trade. Máx 1 por vez; as demais entram na fila com
  timeout de 4 s (depois são descartadas com um toast discreto).
- **Orçamento de partículas global:** 24 simultâneas (exceto graduação: 160).
  Um único `<canvas>` compartilhado, com pool de objetos — nunca DOM nodes.
- **Layout animations** (FLIP) apenas em listas com < 60 itens visíveis.
- **`will-change`** aplicado apenas durante a animação (adicionado no início,
  removido no fim). Nunca permanente.
- **Sincronia com a chain:** a UI faz *commit* otimista imediatamente; se a
  transação reverter (raro), o estado volta com uma animação de "desfazer"
  (200 ms, `ease-cozy`) + toast explicativo. Nunca um salto brusco.
- **Curvas de easing são tokens**, nunca valores literais em componentes.
- **Timeline de referência**: toda sequência acima deve ser prototipada em
  Rive ou Lottie antes de virar código, e revisada em 3 dispositivos
  (iPhone SE, Pixel médio, MacBook) a 60 fps travados.
