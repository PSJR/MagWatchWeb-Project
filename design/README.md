# spark.fun — Design System & Especificação Visual

> Token Launchpad nativo da **Robinhood Chain** (chain ID **4663** · L2 Arbitrum Orbit · gas em ETH · ~100 ms de block time · Uniswap V3 nativo).

**Status:** especificação de design (v1.0) — nenhuma linha de código de aplicação foi escrita.
Este diretório é a fonte de verdade visual para o time de engenharia.

---

## Índice

| # | Documento | Conteúdo |
|---|-----------|----------|
| 00 | [Marca, mood e personalidade](./00-brand-and-mood.md) | Posicionamento, moodboard textual, voz, metáforas, referências |
| 01 | [Cor](./01-color.md) | Paleta completa com hex, escalas, semântica, dark mode, gradientes |
| 02 | [Tipografia](./02-typography.md) | Famílias, escala, pesos, números tabulares, regras |
| 03 | [Tokens](./03-design-tokens.md) | Spacing, radius, shadow, blur, z-index, motion, breakpoints, JSON |
| 04 | [Componentes](./04-components.md) | Biblioteca completa com anatomia, estados e micro-interações |
| 05 | [Layouts](./05-layouts.md) | Home, Create, Token Page, Explore, Perfis, Creator Dashboard |
| 06 | [Motion](./06-motion.md) | Catálogo de animações, diretrizes, curvas, orquestração, 60fps |
| 07 | [Mascotes](./07-mascots.md) | Ember, Pip, Cinder, Wick, Bonfire — bíblia de personagens |
| 08 | [Perfis](./08-profiles.md) | User Profile, Perfil Público, Creator Dashboard, Creator Room |
| 09 | [Acessibilidade & Performance](./09-accessibility-performance.md) | WCAG, motion reduzido, orçamento de frame, densidade |
| 10 | [Conteúdo & Microcopy](./10-content-and-microcopy.md) | Voz, strings-chave, estados vazios, erros, PT-BR/EN |

---

## O pitch em uma frase

> **spark.fun é a lareira do trading on-chain:** uma casa quentinha, de madeira e luz âmbar, onde qualquer pessoa acende um token em 20 segundos — e a chama pega em 100 milissegundos.

## Os três princípios não-negociáveis

1. **Aconchego primeiro, adrenalina depois.** O usuário nunca deve sentir que está num terminal financeiro. Nada de vermelho-alarme, nada de números piscando em pânico. A tensão do trading vem da *velocidade*, não da *agressividade*.
2. **A velocidade da chain é um sentimento, não um número.** 100 ms de bloco significa que a UI responde antes do usuário terminar de tirar o dedo do botão. Toda confirmação é otimista, toda latência é escondida atrás de uma micro-animação deliciosa.
3. **Tudo é tocável, tudo é vivo.** Nenhum elemento é uma caixa morta. Cards respiram, botões afundam, mascotes reagem, o fogo pisca. Mas nada distrai: a animação serve à compreensão.

## Vocabulário da marca (metáfora unificada: **o fogo**)

| Conceito do produto | Nome na marca | Ícone/visual |
|---|---|---|
| Criar token | **Acender** (Light it up) | Fósforo riscando |
| Bonding curve | **A Fogueira** (The Campfire) | Fogueira crescendo |
| Progresso da curve 0–100% | **Aquecimento** | Termômetro/lenha empilhada |
| Graduation | **Bonfire** (A Fogueira Grande) | Explosão de faíscas + árvore de luz |
| Liquidez travada no Uniswap V3 | **Chama Eterna** | Lanterna com cadeado dourado |
| Mayhem Mode | **Fogo Selvagem** (Wildfire) | Chama violeta caótica |
| Token morto / rug | **Brasa** (Embers) | Cinza cinzenta, sem brilho |
| Creator fees | **Lenha** (firewood) | Pilha de lenha que cresce |
| Robinhood Chain | **A Casa** / Orbit | Selo teal com órbita |

Este vocabulário é obrigatório em UI, ilustração e microcopy. Ele é o que impede o produto de virar "mais um pump.fun com cores diferentes".
