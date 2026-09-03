# 01 · Cor

Regra mestra: **nenhum cinza neutro existe neste sistema.** Todo neutro é
levemente quente (matiz 20–30°). Todo acento é saturado mas com luminosidade
alta o suficiente para nunca "gritar". Vermelho puro é proibido.

---

## 1. Escalas primitivas

### 1.1 Ember — laranja da marca (primária)

Cor da chama, do botão principal, do foco, da energia.

| Token | Hex | Uso |
|---|---|---|
| `ember-50` | `#FFF3E8` | fundo de destaque suave, hover ghost |
| `ember-100` | `#FFE3CC` | chips, badges leves |
| `ember-200` | `#FFC79B` | bordas de destaque, ilustração |
| `ember-300` | `#FFAC6E` | gradiente topo, glow |
| `ember-400` | `#FF9350` | hover do primário |
| `ember-500` | `#FF7A2F` | **primária** — fill de botão, progress, chama |
| `ember-600` | `#F05F14` | pressed, borda inferior do botão |
| `ember-700` | `#C6480B` | texto de link sobre creme (AA) |
| `ember-800` | `#9A3809` | texto pequeno sobre creme (AAA) |
| `ember-900` | `#6E2707` | ícone sobre fundo ember-100 |

> **Regra de contraste:** o texto sobre `ember-500` é **`cocoa-900` (#2E2019)**,
> não branco. Contraste 6.4:1 ✅. Marrom sobre laranja também é a assinatura
> cromática do produto — é o que faz parecer biscoito, não alerta.

### 1.2 Cream / Sand — neutros quentes de superfície

| Token | Hex | Uso |
|---|---|---|
| `cream-50` | `#FFFBF4` | **background da app (light)** |
| `cream-100` | `#FFF4E6` | superfície de card elevado |
| `cream-200` | `#FDE9D3` | superfície recuada, input |
| `sand-300` | `#F3D9BE` | bordas, divisores |
| `sand-400` | `#E7C6A4` | borda de card hover |
| `clay-500` | `#C9A484` | ícone desabilitado |
| `cocoa-600` | `#8A6A55` | **texto secundário** (4.6:1 sobre cream-50 ✅) |
| `cocoa-700` | `#6B4F3E` | texto terciário forte |
| `cocoa-800` | `#4A362B` | texto de corpo |
| `cocoa-900` | `#2E2019` | **texto primário / títulos** (13.8:1 ✅) |

### 1.3 Mint — sucesso, compra, PnL positivo

| Token | Hex | Uso |
|---|---|---|
| `mint-50` | `#EAFBF3` | fundo de linha de compra no feed |
| `mint-100` | `#CDF3E2` | badge de alta |
| `mint-300` | `#9BE7C4` | preenchimento de gráfico (área) |
| `mint-500` | `#34C98A` | linha de gráfico, ponto de dado |
| `mint-600` | `#16A971` | fill do botão BUY |
| `mint-800` | `#0A6B48` | **texto de percentual positivo** (5.4:1 ✅) |

### 1.4 Coral — venda, PnL negativo (nunca "vermelho de erro")

| Token | Hex | Uso |
|---|---|---|
| `coral-50` | `#FFF0ED` | fundo de linha de venda |
| `coral-100` | `#FFDCD5` | badge de queda |
| `coral-300` | `#FFB3A7` | área de gráfico em queda |
| `coral-500` | `#FF6B5A` | linha de queda |
| `coral-600` | `#EE4F3D` | fill do botão SELL |
| `coral-800` | `#A82F21` | **texto de percentual negativo** (5.9:1 ✅) |

> Coral (#FF6B5A) tem matiz 8° e luminosidade alta: lê-se como "queda" sem
> disparar a resposta de alarme que `#FF0000` dispara. Perder dinheiro já é
> ruim o bastante sem a interface gritando.

### 1.5 Wildfire — Mayhem Mode

Violeta elétrico + magenta. É a única família com permissão para saturação alta
e movimento caótico, porque comunica risco por *comportamento*, não por vermelho.

| Token | Hex | Uso |
|---|---|---|
| `wild-100` | `#EFE7FF` | fundo do painel Mayhem |
| `wild-300` | `#C7B0FF` | borda animada |
| `wild-500` | `#8B6BFF` | **cor Mayhem principal** |
| `wild-600` | `#6F4BF0` | pressed |
| `wild-800` | `#4423B8` | texto sobre wild-100 (7.1:1 ✅) |
| `magma-500` | `#FF5FA2` | segundo stop do gradiente Mayhem |

### 1.6 Bonfire Gold — graduação e Chama Eterna

| Token | Hex | Uso |
|---|---|---|
| `gold-100` | `#FFF2D1` | fundo de card graduado |
| `gold-300` | `#FFE09A` | partículas |
| `gold-500` | `#FFC24D` | selo de graduação, moldura |
| `gold-600` | `#E9A62B` | borda do selo |
| `gold-800` | `#8F5F06` | texto "Liquidez travada" (5.2:1 ✅) |

### 1.7 Orbit Teal — identidade da Robinhood Chain

Reservada **exclusivamente** para rede, gas, block time e status de nó.
Nunca use teal para sucesso de trade (isso é mint) — a separação evita que o
usuário confunda "a rede está ok" com "meu trade deu lucro".

| Token | Hex | Uso |
|---|---|---|
| `orbit-100` | `#D7F5F3` | fundo do selo de chain |
| `orbit-300` | `#8FE2DC` | pulso de bloco |
| `orbit-500` | `#38C6C0` | **cor da chain** |
| `orbit-700` | `#0E7F7B` | texto "Robinhood Chain · 4663" (4.9:1 ✅) |

### 1.8 Guava — social, follow, chat, comunidade

| Token | Hex |
|---|---|
| `guava-100` | `#FFE4EC` |
| `guava-300` | `#FFC0CF` |
| `guava-500` | `#FF7FA3` |
| `guava-700` | `#C93E68` |

### 1.9 Ash — token morto / brasa apagada

Único lugar do sistema onde a saturação cai perto de zero. Sinaliza morte por
*dessaturação*, não por cor de alerta.

| Token | Hex |
|---|---|
| `ash-100` | `#EDE8E4` |
| `ash-400` | `#B4A9A2` |
| `ash-600` | `#7E736D` |

---

## 2. Tokens semânticos (light)

| Semântico | Valor |
|---|---|
| `--bg-canvas` | `cream-50` `#FFFBF4` |
| `--bg-canvas-glow` | `radial-gradient(1200px 600px at 50% -10%, #FFE9D0 0%, #FFFBF4 60%)` |
| `--bg-surface` | `cream-100` `#FFF4E6` |
| `--bg-surface-raised` | `#FFFFFF` |
| `--bg-surface-sunken` | `cream-200` `#FDE9D3` |
| `--bg-glass` | `rgba(255,247,236,0.62)` + blur 20px saturate 140% |
| `--border-subtle` | `sand-300` `#F3D9BE` |
| `--border-strong` | `sand-400` `#E7C6A4` |
| `--text-primary` | `cocoa-900` `#2E2019` |
| `--text-secondary` | `cocoa-600` `#8A6A55` |
| `--text-inverse` | `cream-50` `#FFFBF4` |
| `--text-on-primary` | `cocoa-900` `#2E2019` |
| `--accent-primary` | `ember-500` `#FF7A2F` |
| `--accent-buy` | `mint-600` `#16A971` |
| `--accent-sell` | `coral-600` `#EE4F3D` |
| `--accent-mayhem` | `wild-500` `#8B6BFF` |
| `--accent-graduated` | `gold-500` `#FFC24D` |
| `--accent-chain` | `orbit-500` `#38C6C0` |
| `--focus-ring` | `ember-500` a 3px + halo `rgba(255,122,47,.25)` a 6px |

## 3. Dark mode — "Night Hearth"

Não é dark mode: é a **mesma cabana à noite**. Preto puro é proibido; os fundos
são marrons profundos com matiz 25°, e a luz âmbar da lareira continua presente
como glow radial atrás do conteúdo principal.

| Semântico | Valor |
|---|---|
| `--bg-canvas` | `night-900` `#16110E` |
| `--bg-canvas-glow` | `radial-gradient(1000px 500px at 50% -5%, #3A241480 0%, transparent 70%)` |
| `--bg-surface` | `night-800` `#1F1814` |
| `--bg-surface-raised` | `night-700` `#2B211B` |
| `--bg-surface-sunken` | `#120E0B` |
| `--bg-glass` | `rgba(43,33,27,0.66)` + blur 24px |
| `--border-subtle` | `night-600` `#3A2C24` |
| `--border-strong` | `#4C392E` |
| `--text-primary` | `#FFF1DF` |
| `--text-secondary` | `#B79C89` |
| `--accent-primary` | `#FF8F4A` (ember-450, +8% L para brilho sobre escuro) |
| `--accent-buy` | `#3FD79A` |
| `--accent-sell` | `#FF7F6D` |
| `--accent-mayhem` | `#A98CFF` |
| `--accent-graduated` | `#FFD166` |
| `--accent-chain` | `#5CD9D3` |
| `--text-on-primary` | `#2E2019` (mantém o marrom sobre laranja em ambos os temas) |

**Regra:** no dark, elevação é comunicada por **luz** (glow + borda mais clara),
nunca por sombra. Sombras existem no dark apenas como `0 0 24px rgba(255,122,47,.12)`.

---

## 4. Gradientes nomeados

| Nome | Definição | Uso |
|---|---|---|
| `grad-ember` | `linear-gradient(180deg, #FFAC6E 0%, #FF7A2F 100%)` | botão primário |
| `grad-hearth` | `linear-gradient(135deg, #FFD9A8 0%, #FF9350 55%, #FF5FA2 100%)` | hero, capas |
| `grad-dusk` | `linear-gradient(180deg, #FFE0C2 0%, #F3C7E0 50%, #C8C2F5 100%)` | fundo de página de perfil |
| `grad-mayhem` | `linear-gradient(120deg, #8B6BFF 0%, #FF5FA2 50%, #FFC24D 100%)` — **animado**, `background-size: 300%`, 8 s loop | Mayhem Mode |
| `grad-bonfire` | `conic-gradient(from 0deg, #FFC24D, #FF7A2F, #FF5FA2, #FFC24D)` — gira 12 s | anel de graduação |
| `grad-buy` | `linear-gradient(180deg, #34C98A, #16A971)` | botão comprar |
| `grad-sell` | `linear-gradient(180deg, #FF8474, #EE4F3D)` | botão vender |
| `grad-ash` | `linear-gradient(180deg, #EDE8E4, #D6CEC8)` | card de token morto |

## 5. Regras de aplicação

1. **Máximo 2 acentos por viewport.** Um card não pode ser mint + gold + wild ao mesmo tempo.
2. **Cor nunca é o único portador de significado.** Alta/baixa sempre tem seta + sinal + cor. Mayhem sempre tem ícone de chama torta + cor. Graduado sempre tem selo + cor.
3. **Estados de fundo** usam a família a 50/100; **texto** usa a mesma família a 700/800. Nunca texto 500 sobre fundo 100.
4. **Chroma máximo permitido** em superfícies grandes (>25% do viewport): equivalente a nível 200. Superfícies grandes nunca recebem 500+.
5. **Grain overlay obrigatório** no body: PNG de ruído 128×128 tileado, `opacity: .03`, `mix-blend-mode: multiply` (light) / `screen` (dark). É o que evita a aparência de "vetor plano".
