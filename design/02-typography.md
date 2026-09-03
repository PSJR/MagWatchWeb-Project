# 02 · Tipografia

Três vozes tipográficas, cada uma com um trabalho exclusivo. Uma quarta é
usada apenas pelos mascotes.

| Papel | Família | Por quê |
|---|---|---|
| **Display / títulos** | `Fredoka` (400–600), fallback `Baloo 2`, `Nunito`, system-ui | Geométrica arredondada, terminações gordas, alegre sem ser infantil. É a "voz da lareira". |
| **UI / corpo** | `Plus Jakarta Sans` (400/500/600/700) | Humanista moderna, altura-x generosa, excelente em 13–16 px. Traz o rigor "Silicon Valley" que equilibra a Fredoka. |
| **Números / dados** | `Geist Mono` (400/500), fallback `JetBrains Mono` | Tabular por padrão, zero cortado, dígitos idênticos em largura — obrigatório para preços que atualizam a cada 100 ms sem tremer o layout. |
| **Mascote / handwriting** | `Caveat` (500/600) | Só em balões de fala de mascote e assinatura de "Creator Room". Nunca em UI funcional. |

Carregamento: `font-display: swap`, subset latin+latin-ext, preload dos pesos
Fredoka 600 e Jakarta 500 (os dois únicos acima da dobra). Orçamento total de
fontes: **≤ 190 KB** (WOFF2, variable onde disponível).

---

## 1. Escala tipográfica

Base 16 px, razão ~1.22 (terça menor arredondada para múltiplos de 2).
Colunas: mobile → desktop (`clamp()` obrigatório entre os dois).

| Token | Família | Tam. (mob → desk) | Line-height | Peso | Letter-spacing | Uso |
|---|---|---|---|---|---|---|
| `display-hero` | Fredoka | 40 → 72 | 1.02 | 600 | −0.03em | Hero da Home ("Acenda a sua faísca") |
| `display-lg` | Fredoka | 32 → 48 | 1.08 | 600 | −0.025em | Título de página, nome do token na Token Page |
| `display-md` | Fredoka | 26 → 34 | 1.12 | 600 | −0.02em | Cabeçalho de perfil, modal de graduação |
| `heading-lg` | Fredoka | 22 → 26 | 1.2 | 500 | −0.015em | Títulos de seção |
| `heading-md` | Fredoka | 18 → 20 | 1.25 | 500 | −0.01em | Título de card |
| `heading-sm` | Jakarta | 16 | 1.3 | 600 | 0 | Sub-seções, labels de aba |
| `body-lg` | Jakarta | 16 → 17 | 1.55 | 400 | 0 | Descrição de token, bio |
| `body` | Jakarta | 15 | 1.55 | 400 | 0 | Corpo padrão |
| `body-sm` | Jakarta | 13 | 1.5 | 400 | 0.005em | Metadados, timestamps |
| `label` | Jakarta | 13 | 1.2 | 600 | 0.01em | Labels de input, botões |
| `caption` | Jakarta | 11 | 1.35 | 500 | 0.02em | Legendas de gráfico, fee breakdown |
| `overline` | Jakarta | 11 | 1.2 | 700 | 0.09em, UPPERCASE | "MODO FOGO SELVAGEM", "GRADUADO" |
| `num-hero` | Geist Mono | 36 → 56 | 1.0 | 500 | −0.02em | PnL total, fees do criador |
| `num-lg` | Geist Mono | 22 → 28 | 1.1 | 500 | −0.01em | Preço na Token Page, market cap |
| `num-md` | Geist Mono | 16 | 1.2 | 500 | 0 | Números de card, valores de portfolio |
| `num-sm` | Geist Mono | 13 | 1.3 | 400 | 0 | Feed de trades, tabela de holders |
| `mascot` | Caveat | 18 → 22 | 1.25 | 600 | 0 | Balões de fala |

---

## 2. Regras de números (crítico para trading a 100 ms)

1. **`font-variant-numeric: tabular-nums` é global** em todo elemento `.num-*`.
   Sem isso, um preço mudando de `0.0000418` para `0.0000419` faz o layout tremer
   dezenas de vezes por segundo. Isso é inaceitável.
2. **Largura reservada**: todo slot numérico que atualiza ao vivo tem
   `min-width` calculado pelo máximo esperado de dígitos (`ch` units). Nada de
   reflow em atualização.
3. **Abreviação padrão**: `$1.2K`, `$45.7K`, `$1.24M`, `$12.4M`. Sempre 3
   dígitos significativos. Acima de `$1B` → `$1.24B`.
4. **Preços sub-centavo** usam notação com subscrito de zeros:
   `$0.0₅418` (5 zeros). Renderizado com `<sub>` em `caption` e cor `--text-secondary`.
5. **Percentuais** sempre com sinal explícito: `+142.8%` / `−18.4%`
   (usar o menos tipográfico U+2212, não hífen).
6. **Cor de número muda, tamanho nunca.** Um número que sobe não pode crescer:
   isso causa reflow. A ênfase vem de cor + micro-flash de background (ver `06-motion.md`).

---

## 3. Regras de composição

- **Medida de linha**: 60–72 caracteres em corpo. Descrição de token trava em `max-width: 62ch`.
- **Hierarquia por peso e família, não por tamanho.** Fredoka já carrega
  personalidade suficiente; evite mais de 3 tamanhos por tela.
- **Nunca justificar.** Texto sempre `text-align: start`.
- **Truncamento**: nomes de token truncam em 1 linha com `…`; descrições em
  3 linhas com `-webkit-line-clamp: 3` + botão "ver mais" (que expande com
  altura animada, ver motion).
- **Wallet truncada**: `0x7f2a…9C41` — 6 primeiros, 4 últimos, em Geist Mono 13,
  com `title` completo e clique-para-copiar.
- **Uppercase só em `overline`.** Nunca em botões (uppercase mata o aconchego).
- **Caveat nunca abaixo de 16 px** e nunca em blocos > 2 linhas.

## 4. Tipografia responsiva

Todos os tokens de display usam `clamp()` com viewport 380 px → 1280 px:

```
--font-display-hero: clamp(2.5rem, 1.2rem + 5.4vw, 4.5rem);
--font-display-lg:   clamp(2rem, 1.3rem + 2.9vw, 3rem);
--font-display-md:   clamp(1.625rem, 1.35rem + 1.15vw, 2.125rem);
--font-num-hero:     clamp(2.25rem, 1.4rem + 3.5vw, 3.5rem);
```

Corpo e labels **não** escalam com viewport (15 px é 15 px em qualquer tela);
apenas a densidade de layout muda.
