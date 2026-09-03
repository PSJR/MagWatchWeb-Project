# 09 · Acessibilidade e Performance Visual

Um produto cartoon e animado é exatamente o tipo de produto que costuma
falhar em acessibilidade. spark.fun trata isso como requisito de design,
não como ajuste posterior.

---

## 1. Contraste (WCAG 2.2 AA mínimo, AAA onde possível)

Pares aprovados e medidos:

| Combinação | Ratio | Nível |
|---|---|---|
| `cocoa-900 #2E2019` sobre `cream-50 #FFFBF4` | 13.8:1 | AAA |
| `cocoa-600 #8A6A55` sobre `cream-50` | 4.6:1 | AA |
| `cocoa-900` sobre `ember-500 #FF7A2F` | 6.4:1 | AA (grande: AAA) |
| `mint-800 #0A6B48` sobre `cream-50` | 5.4:1 | AA |
| `coral-800 #A82F21` sobre `cream-50` | 5.9:1 | AA |
| `wild-800 #4423B8` sobre `wild-100` | 7.1:1 | AAA |
| `orbit-700 #0E7F7B` sobre `orbit-100` | 4.9:1 | AA |
| `gold-800 #8F5F06` sobre `gold-100` | 5.2:1 | AA |
| `#FFF1DF` sobre `night-900 #16110E` | 14.9:1 | AAA |

**Proibições absolutas:**
- Branco sobre `ember-500` (2.9:1) — por isso o texto sobre laranja é cocoa-900.
- Qualquer texto em nível 400/500 de qualquer família sobre creme.
- Texto sobre imagem sem overlay: todo texto sobre mídia recebe um scrim
  `linear-gradient(transparent, rgba(46,32,25,.72))` com contraste verificado.

**Elementos não-textuais** (bordas de input, ícones de estado, barra da curve)
mantêm 3:1 contra o fundo adjacente.

## 2. Daltonismo

- Alta/baixa nunca dependem só de mint/coral: sempre há **seta direcional**
  (▲/▼) e **sinal** (+/−).
- Mayhem nunca depende só do violeta: sempre chip com texto e o ícone de
  chama torta.
- Graduado nunca depende só do dourado: sempre selo + label "GRADUADO".
- **Modo daltônico opcional** nas configurações: troca mint→azul `#2F8FE0` e
  coral→laranja `#E07B2F`, mantendo toda a estrutura do sistema.
- Gráficos usam **padrão além de cor** (área de baixa com hachura sutil).

## 3. Movimento e `prefers-reduced-motion`

Quando `prefers-reduced-motion: reduce` está ativo:

| Animação | Substituição |
|---|---|
| Confete de trade | flash único de cor no botão + toast |
| Sequência de graduação | card estático com selo dourado + fade de 200 ms |
| Mascotes animados | SVG estático na pose correspondente ao estado |
| Faíscas ambientes, fumaça, respiração de card | removidas |
| Parallax do hero | removido |
| Gradiente animado do Mayhem | gradiente estático |
| Transição de página | crossfade de 120 ms |
| Roll de dígitos | troca direta de valor |
| Tilt 3D de card | removido |
| Skeleton shimmer | bloco estático com opacidade pulsante lenta (2 s) |

Nada de funcionalidade é perdido. Além disso, existe um toggle próprio no
produto: **"Modo calminho"** — reduz movimento, partículas e brilhos mesmo em
sistemas sem a preferência configurada. Ele fica na primeira tela de
configurações, não escondido.

**Nunca:** flashes > 3 por segundo (risco de convulsão fotossensível). O
"heartbeat da chain" a 100 ms é **agrupado visualmente a cada 10 blocos** —
1 pulso por segundo, com opacidade máxima de 40% — precisamente por isso.

## 4. Teclado e foco

- **Todo** elemento interativo é alcançável por Tab, na ordem visual.
- Anel de foco: `ember-500` 3 px + halo `rgba(255,122,47,.25)` 6 px, sempre
  visível (`:focus-visible`), com offset de 2 px. Nunca `outline: none` sem
  substituto.
- Modais e sheets fazem **focus trap** e devolvem o foco ao gatilho ao fechar.
- Atalhos: `⌘K` busca · `B` comprar · `S` vender · `/` foco na busca ·
  `Esc` fecha/pula animação · `?` lista de atalhos. Todos desativáveis.
- Skip links: "pular para o conteúdo" e "pular para o painel de trade".
- `Esc` **sempre** pula a sequência de graduação.

## 5. Leitores de tela

- Mascotes: `aria-hidden="true"` (decorativos). O estado emocional é redundante
  com texto real.
- Preço ao vivo: `aria-live="polite"` com **throttle de 5 s** — nunca anunciar
  a cada bloco de 100 ms (seria tortura).
- Feed de trades: `aria-live="off"`, com um botão "anunciar novos trades" opt-in.
- Confirmação de trade: `role="status"` com texto completo
  ("Compra confirmada: 1.284.221 PIZZA por 0,05 ETH").
- Gráficos: `role="img"` com `aria-label` descritivo + tabela de dados
  equivalente acessível via "ver dados".
- Barra da curve: `role="progressbar"` com `aria-valuenow/min/max` e
  `aria-valuetext="62 por cento até a graduação"`.
- Ícones-ação sempre com `aria-label`. Emoji decorativo sempre `aria-hidden`.

## 6. Alvos de toque e ergonomia mobile

- Mínimo **44×44 px**; ações primárias (comprar, vender, acender) **48–56 px**.
- Espaçamento mínimo de 8 px entre alvos adjacentes.
- Ações destrutivas ou irreversíveis (Mayhem, vender 100%) exigem
  **hold-to-confirm**, não estão a um toque acidental de distância.
- Zona do polegar: TradePanel e BottomNav no terço inferior. Nada crítico no
  topo da tela em mobile.
- `env(safe-area-inset-*)` respeitado.

## 7. Orçamento de performance visual (60 fps inegociável)

| Métrica | Alvo |
|---|---|
| LCP | < 1.8 s em 4G |
| INP | < 120 ms |
| CLS | < 0.02 (números tabulares + alturas reservadas garantem isso) |
| Frame budget | 16.6 ms; nenhuma tarefa longa > 50 ms |
| Partículas simultâneas | ≤ 24 (graduação: ≤ 160, por ≤ 3 s) |
| Camadas compostas | ≤ 12 simultâneas |
| Superfícies com `backdrop-filter` | ≤ 3 por tela |
| Rigs de mascote carregados | ≤ 3 por rota, ≤ 180 KB total |
| Fontes | ≤ 190 KB WOFF2 |
| DOM nodes no feed | ≤ 800 (virtualização acima disso) |

**Regras técnicas de animação**
1. Apenas `transform` e `opacity` no caminho crítico.
2. `will-change` aplicado no início e removido no fim da animação.
3. Um único `<canvas>` compartilhado para todas as partículas, com pool de
   objetos (zero alocação por frame).
4. Atualizações de preço em lote a cada 250 ms via rAF — **nunca** um render
   por bloco de 100 ms. A percepção de fluidez vem da interpolação, não da
   frequência de render.
5. `content-visibility: auto` em cards fora do viewport.
6. Toda animação ambiente pausa fora do viewport e com a aba oculta.
7. Imagens de token: AVIF/WebP, `srcset`, `aspect-ratio` fixo, placeholder
   blur-hash. Vídeos: `muted`, `playsinline`, `preload="none"`, pausam fora da tela.
8. Degradação automática: se `requestAnimationFrame` medir < 45 fps por 2 s
   consecutivos, o app entra em **modo econômico** (partículas 50%, glass
   substituído por cor sólida, mascotes em pose estática) e mostra um toggle
   discreto para voltar.

## 8. Internacionalização

- PT-BR e EN no lançamento. Layout tolera **+35% de comprimento** de string.
- Números e moedas com `Intl.NumberFormat`; datas relativas com
  `Intl.RelativeTimeFormat`.
- Nenhum texto embutido em imagem (exceto Share Cards, gerados por locale).
- Preparado para RTL: uso de propriedades lógicas (`margin-inline`,
  `padding-block`, `inset-inline-start`) em todo o sistema.

## 9. Checklist de revisão de design (obrigatório antes de qualquer handoff)

- [ ] Contraste de todo texto verificado contra o fundo real (incluindo sobre gradiente).
- [ ] Nenhuma informação depende exclusivamente de cor.
- [ ] Todos os estados especificados: default, hover, focus, active, disabled, loading, error, empty, success.
- [ ] Versão `prefers-reduced-motion` desenhada para cada animação.
- [ ] Layout testado em 390 / 768 / 1024 / 1440 / 1600 px.
- [ ] Alvos de toque ≥ 44 px, ações primárias ≥ 48 px.
- [ ] Dark mode desenhado (não derivado automaticamente).
- [ ] Nenhum salto de layout ao atualizar números ao vivo.
- [ ] Ordem de foco por teclado percorrida manualmente.
- [ ] Todo mascote tem fallback estático e é `aria-hidden`.
- [ ] Estado vazio, de erro e de carregamento têm ilustração e microcopy próprios.
