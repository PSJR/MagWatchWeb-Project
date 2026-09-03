# 03 · Design Tokens

Fonte única de verdade. Nomenclatura: `--sf-<categoria>-<escala>`
(`sf` = spark.fun). Primitivos nunca são usados direto em componentes — só
tokens semânticos são consumidos pela UI.

---

## 1. Spacing — base 4 px

| Token | px | Uso típico |
|---|---|---|
| `space-0` | 0 | reset |
| `space-1` | 4 | gap ícone↔texto |
| `space-2` | 8 | padding interno de chip |
| `space-3` | 12 | gap entre linhas de lista |
| `space-4` | 16 | **padding padrão de card (mobile)** |
| `space-5` | 20 | padding de card (desktop) |
| `space-6` | 24 | gap entre cards |
| `space-8` | 32 | padding de seção (mobile) |
| `space-10` | 40 | gap entre blocos |
| `space-12` | 48 | padding de seção (desktop) |
| `space-16` | 64 | separação de seções maiores |
| `space-20` | 80 | respiro do hero |
| `space-24` | 96 | respiro máximo |

**Ritmo vertical:** todo bloco de conteúdo é múltiplo de 4; blocos de seção
são múltiplos de 8. Altura mínima de alvo tocável: **44 px** (48 px em ações primárias).

## 2. Radius

| Token | px | Uso |
|---|---|---|
| `radius-xs` | 6 | tag, badge pequeno |
| `radius-sm` | 10 | input pequeno, chip |
| `radius-md` | 14 | input, botão pequeno |
| `radius-lg` | 20 | botão padrão, modal pequeno |
| `radius-xl` | 28 | **card padrão** |
| `radius-2xl` | 36 | painel grande, modal |
| `radius-3xl` | 48 | hero, sheet mobile |
| `radius-pill` | 999 | pílula, avatar-chip, toggle |
| `radius-squircle` | `28px` + `corner-shape: squircle` | cards em navegadores suportados |

**Regra do raio aninhado:** raio interno = raio externo − padding.
Card 28 px com padding 16 → mídia interna 12 px. Nunca aninhe raios iguais.

## 3. Sombras — sempre com matiz de cacau, nunca cinza

| Token | Valor |
|---|---|
| `shadow-xs` | `0 1px 2px rgba(74,54,43,.06)` |
| `shadow-sm` | `0 2px 6px rgba(74,54,43,.08)` |
| `shadow-md` | `0 6px 16px -4px rgba(74,54,43,.12), 0 2px 4px rgba(74,54,43,.06)` |
| `shadow-lg` | `0 16px 32px -12px rgba(74,54,43,.18), 0 4px 8px rgba(74,54,43,.06)` |
| `shadow-xl` | `0 32px 64px -24px rgba(74,54,43,.24), 0 8px 16px rgba(74,54,43,.08)` |
| `shadow-inner-warm` | `inset 0 2px 4px rgba(74,54,43,.06)` (inputs) |
| `glow-ember` | `0 0 0 4px rgba(255,122,47,.18), 0 10px 28px -10px rgba(255,122,47,.55)` |
| `glow-mint` | `0 0 0 4px rgba(52,201,138,.18), 0 10px 28px -10px rgba(22,169,113,.5)` |
| `glow-mayhem` | `0 0 0 4px rgba(139,107,255,.22), 0 12px 32px -10px rgba(139,107,255,.6)` |
| `glow-gold` | `0 0 0 5px rgba(255,194,77,.25), 0 16px 40px -12px rgba(233,166,43,.6)` |

### 3.1 A "Squish Lip" — assinatura tátil do sistema

Todo elemento pressionável recebe uma **borda inferior sólida de 3 px** na cor
600 da sua família (via `box-shadow: 0 3px 0 <cor-600>`), simulando a espessura
de um botão de brinquedo.

- Repouso: `translateY(0)` + lip 3 px
- Hover: `translateY(-1px)` + lip 4 px + glow da família
- Active/press: `translateY(3px)` + lip 0 px (o botão "afunda" e encosta)
- Duração: 90 ms `ease-out-soft` para baixo, 180 ms `ease-spring-pop` na volta

Isso, aplicado consistentemente, é o que faz a UI inteira parecer um objeto
físico fofo em vez de retângulos coloridos.

## 4. Blur / Glass

| Token | Valor |
|---|---|
| `blur-glass-sm` | `blur(12px) saturate(130%)` |
| `blur-glass-md` | `blur(20px) saturate(140%)` — header, sheets |
| `blur-glass-lg` | `blur(32px) saturate(150%)` — overlay de modal |
| `glass-tint-light` | `rgba(255,247,236,.62)` |
| `glass-tint-dark` | `rgba(43,33,27,.66)` |
| `glass-border` | `1px solid rgba(255,255,255,.55)` (light) / `rgba(255,220,180,.10)` (dark) |

Glass é usado em no máximo **3 superfícies simultâneas** por tela (custo de GPU).
Nunca use glass sobre glass.

## 5. Motion tokens

### Durações

| Token | ms | Uso |
|---|---|---|
| `dur-instant` | 80 | mudança de cor, opacidade de ícone |
| `dur-fast` | 140 | hover, press, toggle |
| `dur-base` | 220 | entrada de card, tooltip, tab |
| `dur-slow` | 360 | modal, sheet, expand |
| `dur-slower` | 560 | transição de página, morph de layout |
| `dur-celebrate` | 900 | confetti de trade, pop de sucesso |
| `dur-epic` | 2400 | sequência de graduação |

### Curvas

| Token | cubic-bezier | Sensação |
|---|---|---|
| `ease-out-soft` | `(.22, 1, .36, 1)` | chegada suave — padrão de entrada |
| `ease-in-soft` | `(.64, 0, .78, 0)` | saída |
| `ease-cozy` | `(.65, 0, .35, 1)` | in-out equilibrado |
| `ease-pop` | `(.34, 1.56, .64, 1)` | overshoot fofo — botões, badges |
| `ease-squish` | `(.5, -0.4, .5, 1.4)` | antecipação + overshoot — mascotes |
| `ease-fire` | `(.16, 1, .3, 1)` | aceleração violenta e freio — faísca de trade |

### Springs (para Framer Motion / Motion One)

| Token | stiffness | damping | mass | Uso |
|---|---|---|---|---|
| `spring-snappy` | 420 | 32 | 1 | feedback de trade, toggle |
| `spring-bouncy` | 280 | 18 | 1 | mascote, badge, celebração |
| `spring-gentle` | 160 | 22 | 1 | layout, reordenação de lista |
| `spring-jelly` | 500 | 14 | 0.8 | Mayhem Mode |

### Stagger

| Token | ms | Uso |
|---|---|---|
| `stagger-tight` | 24 | itens de lista longa |
| `stagger-base` | 45 | cards de grid |
| `stagger-loose` | 80 | seções de página |

## 6. Z-index

| Token | Valor |
|---|---|
| `z-base` | 0 |
| `z-raised` | 10 |
| `z-sticky` | 100 |
| `z-header` | 200 |
| `z-dropdown` | 300 |
| `z-sheet` | 400 |
| `z-modal` | 500 |
| `z-toast` | 600 |
| `z-confetti` | 700 |
| `z-graduation` | 800 |
| `z-tooltip` | 900 |

## 7. Breakpoints e grid

| Token | min-width | Grid | Gutter | Margem |
|---|---|---|---|---|
| `bp-xs` | 0 | 4 col | 12 | 16 |
| `bp-sm` | 480 | 4 col | 16 | 20 |
| `bp-md` | 768 | 8 col | 20 | 32 |
| `bp-lg` | 1024 | 12 col | 24 | 40 |
| `bp-xl` | 1280 | 12 col | 24 | 56 |
| `bp-2xl` | 1600 | 12 col, `max-width: 1440px` centralizado | 28 | auto |

**Mobile-first absoluto:** cada layout em `05-layouts.md` é especificado
primeiro em 390 px e só depois expandido.

## 8. Ícones

- Família **Sparky Icons** (derivada de Lucide, raio de junta aumentado para 2 px).
- Grid 24×24, traço 2 px, `stroke-linecap: round`, `stroke-linejoin: round`.
- Tamanhos: 16 / 20 / 24 / 32 / 48.
- Ícones nunca aparecem sozinhos como ação sem `aria-label`.
- Ícones de marca (chama, fogueira, lenha, cadeado dourado) são **preenchidos**
  e coloridos; ícones de UI são **traço** e monocromáticos.

## 9. Elevação — mapa completo

| Nível | Componente | Light | Dark |
|---|---|---|---|
| 0 | canvas | `--bg-canvas` | `--bg-canvas` + glow radial |
| 1 | card em repouso | `--bg-surface` + `shadow-sm` | `--bg-surface` + borda subtle |
| 2 | card hover | `#FFF` + `shadow-md` + `translateY(-3px)` | `--bg-surface-raised` + glow 12% |
| 3 | dropdown / popover | `#FFF` + `shadow-lg` + glass | `night-700` + `shadow-lg` + borda strong |
| 4 | modal / sheet | `#FFF` + `shadow-xl` + backdrop blur | `night-700` + glow ember 8% |
| 5 | toast | glass md + `shadow-lg` | glass dark + borda strong |
| 6 | graduação (full-screen) | overlay `grad-bonfire` a 92% | idem |

---

## 10. Export JSON (W3C Design Tokens — resumo)

```json
{
  "$schema": "https://tr.designtokens.org/format/",
  "sf": {
    "color": {
      "ember": { "500": { "$type": "color", "$value": "#FF7A2F" }, "600": { "$value": "#F05F14" } },
      "cream": { "50": { "$value": "#FFFBF4" }, "100": { "$value": "#FFF4E6" } },
      "cocoa": { "600": { "$value": "#8A6A55" }, "900": { "$value": "#2E2019" } },
      "mint":  { "600": { "$value": "#16A971" }, "800": { "$value": "#0A6B48" } },
      "coral": { "600": { "$value": "#EE4F3D" }, "800": { "$value": "#A82F21" } },
      "wild":  { "500": { "$value": "#8B6BFF" } },
      "gold":  { "500": { "$value": "#FFC24D" } },
      "orbit": { "500": { "$value": "#38C6C0" } }
    },
    "space":  { "4": { "$type": "dimension", "$value": "16px" }, "6": { "$value": "24px" } },
    "radius": { "xl": { "$type": "dimension", "$value": "28px" }, "pill": { "$value": "999px" } },
    "duration": { "fast": { "$type": "duration", "$value": "140ms" }, "base": { "$value": "220ms" } },
    "easing": { "pop": { "$type": "cubicBezier", "$value": [0.34, 1.56, 0.64, 1] } }
  }
}
```

O arquivo completo (`tokens.json`) será gerado na fase de implementação a partir
destas tabelas — nenhum valor deve ser inventado fora deste documento.
