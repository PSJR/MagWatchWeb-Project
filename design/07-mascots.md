# 07 · Bíblia de Mascotes

Os mascotes de spark.fun não são decoração: eles são o **sistema de feedback
emocional** do produto. Onde outra interface usaria um ícone de alerta ou um
texto de status, spark.fun usa uma criatura reagindo. Isso é o que transforma
dados financeiros frios em uma experiência aconchegante.

**Regra de ouro:** o mascote nunca bloqueia informação, nunca cobre um número,
e nunca aparece mais de **dois** por tela.

---

## Estilo de construção (comum a todos)

- **Proporção:** cabeça = 55% do corpo. Olhos = 30% da largura da cabeça,
  afastados. Bochechas sempre coradas (`guava-300` a 60%).
- **Construção:** silhueta feita de 2–3 formas primárias (círculo + gota).
  Deve ser reconhecível em 24 px como uma mancha sólida.
- **Traço:** contorno de 2.5 px na cor `cocoa-800` a 55% de opacidade —
  contorno preto puro é proibido (mata o aconchego).
- **Sombreamento:** 2 tons apenas (base + sombra), com uma luz de borda quente
  no topo simulando a fogueira. Sem gradiente de mais de 2 stops.
- **Sem boca detalhada:** a boca é uma curva simples; a emoção vem 70% dos
  olhos e das sobrancelhas.
- **Animação:** rig 2.5D (Rive), 6 poses base × 4 expressões. Idle sempre
  ativo (respirar 4 s + piscar a cada 3–6 s aleatório).

---

## 1. **Ember** — o mascote principal

> Uma chama gordinha do tamanho de uma maçã, cor `ember-400` com o núcleo
> `gold-400`. Formato de gota com a ponta levemente curvada, como um
> marshmallow em brasa. Tem dois bracinhos finos, sem pernas (flutua a 4 px do
> chão com um bob de 2 s). Olhos enormes e brilhantes com dois pontos de luz.
> Usa um cachecol de lã `guava-300` — o detalhe cozy que impede que ele pareça
> "perigoso".

**Personalidade:** curioso, prestativo, um pouco atrapalhado. É o anfitrião da
casa. Não fala com texto de UI — fala em balões de `Caveat`, sempre curtos.

**Onde aparece:** hero da Home, estados vazios, uploader, loading, feedback de
trade, ponto vivo do gráfico da bonding curve.

**Estados (rig obrigatório):**
| Estado | Descrição visual |
|---|---|
| `idle` | flutua, respira, pisca |
| `happy` | pulo com braços para cima, chama estica 15% |
| `cheer` | gira 360° e solta 3 faíscas — usado no BUY confirmado |
| `wave` | aceno tranquilo — usado no SELL confirmado |
| `sleepy` | encolhido, chama baixa, zZz — skeletons e madrugada |
| `worried` | inclinado, chama tremendo, olhos grandes — erro de rede |
| `soot` | cinza e apagado, fumacinha — token morto / offline |
| `carry` | segurando um objeto (imagem, moeda, fio) — uploader/erros |
| `blow` | soprando — GasPill |
| `roast` | assando marshmallow — loading longo (>2 s) |

---

## 2. **Bonfire** — a forma graduada de Ember

Aparece **exclusivamente** no momento de graduação e como selo permanente em
tokens graduados.

> Ember três vezes maior, com o corpo em `grad-bonfire`, uma coroa de brasas
> flutuando sobre a cabeça, olhos com brilho dourado e o cachecol virando uma
> capa. Abaixo dele, uma pequena lanterna com cadeado dourado — o símbolo da
> **Chama Eterna** (liquidez travada no Uniswap V3).

Só existe em duas animações: o morph da graduação (800 ms) e um idle majestoso
e lento (respiração de 6 s). Nunca é usado em contexto banal — sua raridade é o
que dá peso ao momento de graduação.

---

## 3. **Pip** — o mascote de perfil do trader ⭐

Gerado deterministicamente a partir do endereço da carteira: **4.096 variações**
(8 cores de corpo × 8 acessórios × 8 formatos de olho × 8 padrões).

> Um vaga-lume redondinho, do tamanho de uma ameixa, com um bumbum que brilha
> (a intensidade do brilho = atividade recente do usuário). Asinhas
> translúcidas que batem em 12 fps. Acessórios possíveis: gorro de lã, óculos,
> cachecol, fone, chapéu de chef, laço, bandana, coroa de flores.

**Pip é a interface emocional do PnL.** Ele fica no canto do banner do perfil e
reage continuamente:

| Condição | Estado do Pip |
|---|---|
| PnL 24h > +50% | `ecstatic` — voa em círculos, brilho máximo, confete próprio |
| PnL 24h > 0 | `happy` — flutua alto, brilho forte, sorriso |
| PnL 24h ≈ 0 | `neutral` — flutua calmo, brilho médio |
| PnL 24h < 0 | `sad` — voa baixo, asas mais lentas, brilho fraco, olha para os pés |
| PnL 24h < −50% | `cozy-comfort` — enrolado num cobertorzinho com uma xícara. **Nunca "triste demais"**: a marca abraça quem perdeu, não humilha. |
| Sem trades há 7 dias | `dusty` — pousado, dormindo, com uma teia minúscula |
| Mayhem Mode ativo | `wired` — vibra, olhos em espiral, rastro violeta |

**MoodPicker:** o usuário pode sobrescrever manualmente o humor do Pip com um
emoji do dia (😌 🔥 🤔 😤 🥳 😴). A escolha também recolore o gradiente do banner.
Isso dá agência emocional ao usuário — um detalhe pequeno com retorno enorme
em apego ao produto.

---

## 4. **Cinder** — o mascote do criador (sistema RPG)

Cada criador tem um Cinder único, que **evolui com o nível**. É o mecanismo de
retenção mais forte do produto: o criador cria tokens para ver seu bichinho crescer.

> Uma criaturinha de carvão em brasa, com formato de pinha, que segura uma
> pequena tocha. Começa pequeno, opaco e com a tocha quase apagada.

| Nível | Nome | Cor do anel | Evolução visual |
|---|---|---|---|
| 1 | **Bronze** | `#C88A5A` | Cinder pequeno, tocha com chama fraca, sem acessórios |
| 2 | **Silver** | `#B9C2CC` | Cresce 15%, ganha um cachecol prateado, chama estável |
| 3 | **Gold** | `#FFC24D` | Ganha uma capa curta e óculos, chama dourada, 2 faíscas orbitando |
| 4 | **Platinum** | `#8FE2DC` | Cresce 30%, ganha coroa fina, aura teal, 4 faíscas orbitando |
| 5 | **Diamond** | `#B6A8FF` | Corpo cristalino iridescente, capa longa, chama em prisma, 8 faíscas, e uma pequena constelação girando ao redor |

**Fórmula do nível** (exibida abertamente no dashboard — transparência é cozy):
```
score = 0.45 × log10(volume_total_usd)
      + 0.35 × taxa_de_graduacao
      + 0.20 × log10(seguidores + 1)
```
Faixas: Bronze 0–1.9 · Silver 2.0–3.4 · Gold 3.5–4.9 · Platinum 5.0–6.4 · Diamond 6.5+.
A barra de progresso para o próximo nível é sempre visível, com o "quanto falta"
em linguagem concreta: *"faltam $180K de volume ou 2 graduações"*.

**Reações do Cinder no dashboard:**
| Evento | Reação |
|---|---|
| Fee entrando ao vivo | pega uma acha de lenha e joga no fogo |
| Token dele graduou | levanta a tocha e comemora, fogo dobra de tamanho |
| Token dele morreu | senta ao lado da brasa apagada e sopra devagar |
| 24h sem atividade | cochila encostado na tocha |
| Novo seguidor | acena para fora da tela |

---

## 5. **Wick** — o mascote do Mayhem Mode

> Um duende-vela derretido, corpo de cera `wild-500` escorrida, pavio torto no
> topo com chama violeta-magenta, sorriso torto e olhos assimétricos.
> É travesso, não maligno. Nunca assustador — o produto não faz terror.

**Onde aparece:** exclusivamente no MayhemToggle, no chip `MAYHEM` dos cards e
como marca-d'água na Token Page em modo Mayhem.

**Estados:** `asleep` (modo desligado), `wake` (sobressalto ao ligar),
`cackle` (rindo, loop 2 s), `melt` (quando o token cai forte — ele derrete um
pouco e se reforma). O rig de Wick é o único autorizado a usar movimento
irregular e "sujo" (jitter), porque o caos é a mensagem.

---

## 6. Elenco de apoio (menor, ilustrativo)

| Nome | O que é | Onde |
|---|---|---|
| **Sparks** | faíscas com olhinhos, do tamanho de uma ervilha | confete, rastros, transições |
| **Logs** (🪵) | achas de lenha sorridentes | fees do criador, "lenha acumulada" |
| **Soot** | brasas cinzentas apagadas, com olhos tristes fofos | tokens mortos, offline |
| **Kettle** | uma chaleira que apita | notificações e alertas de preço |
| **Owl** | uma coruja de lã na estante | dicas e onboarding ("Você sabia?") |

---

## 7. Regras de uso

1. **Nunca mais de 2 mascotes por tela** (exceto graduação e Home hero).
2. **Nunca sobre dados.** Mascote fica em margem, canto ou fundo — jamais
   cobrindo preço, saldo ou botão.
3. **Nunca como única informação.** Se o Pip está triste, o número negativo
   também está lá, explícito. Emoção acompanha o dado, não o substitui.
4. **Nunca humilhar.** Perda nunca é ridicularizada. O tom é sempre de colo.
5. **Escala mínima 32 px** para versões animadas; abaixo disso, use o ícone
   estático simplificado (silhueta de 1 cor).
6. **Formato de entrega:** Rive (`.riv`) para rigs interativos, Lottie para
   sequências lineares, SVG estático como fallback e para `prefers-reduced-motion`.
7. **Peso:** cada rig ≤ 60 KB; total de mascotes carregados por rota ≤ 180 KB,
   carregados de forma lazy após o first paint.
8. **Acessibilidade:** todo mascote é `aria-hidden="true"` (é decorativo); o
   estado emocional que ele expressa está sempre disponível em texto para
   leitores de tela.
