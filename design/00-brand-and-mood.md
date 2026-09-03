# 00 · Marca, Mood e Personalidade

## 1. Posicionamento

**spark.fun** é o launchpad de tokens da Robinhood Chain. Todo concorrente do setor
escolheu o mesmo caminho estético: fundo preto, verde-neon, gráficos de terminal,
tipografia de hacker, urgência ansiosa. spark.fun escolhe deliberadamente o oposto,
e é exatamente isso que o torna memorável e defensável.

> **Se o resto do mercado é um cassino às 3h da manhã, spark.fun é uma cabana de
> montanha às 19h — lareira acesa, chá quente, chuva na janela — onde por acaso
> acontece o trading mais rápido do planeta.**

A tensão criativa central do produto é **cozy × velocity**:

- **Cozy** vem da *superfície*: madeira, lã, luz âmbar, cantos gordos, mascotes, sombras suaves.
- **Velocity** vem do *tempo*: 100 ms de bloco, resposta instantânea, contadores que sobem ao vivo, faíscas que percorrem a tela quando um trade fecha.

Nunca resolva essa tensão. Um produto só-cozy é lento e infantil. Um produto
só-veloz é ansioso e genérico. spark.fun é uma **fogueira**: quente e parada
por fora, violenta e rápida por dentro.

---

## 2. Moodboard textual

### 2.1 A cena mestra (referência única para todo ilustrador)

> É fim de tarde num vale. Uma cabana de madeira clara, com telhado arredondado como
> massa de pão, tem uma janela redonda de onde escapa luz cor de damasco. Lá dentro,
> uma fogueira pequena queima dentro de uma lareira de pedra rosada. Ao redor dela,
> criaturinhas redondas — feitas de chama, de faísca e de marshmallow — estão
> empoleiradas em almofadas, olhando para o fogo com olhos enormes e brilhantes.
> Cada vez que alguém joga um graveto no fogo, uma faísca sobe rápido demais para
> o olho acompanhar e some pelo cano da chaminé, virando estrela. Lá fora, o céu é
> um gradiente pêssego→lavanda. Não há nada assustador nessa imagem. Mas há algo
> acontecendo muito, muito rápido dentro daquela chaminé.

### 2.2 Palavras-âncora

| Sim | Não |
|---|---|
| aconchegante, macio, gordinho, quente, luminoso, redondo, felpudo, âmbar, caseiro, tátil, brincalhão, generoso, respirável | agressivo, neon, sombrio, cyberpunk, corporativo, ansioso, denso, plano, cinza, "sério", brutalista, matrix |

### 2.3 Texturas e materiais

- **Madeira clara** com veios sutis (opacidade ≤ 6%) em painéis e headers de seção.
- **Lã / feltro** em cards de badge e em estados vazios (borda pontilhada estilo costura).
- **Vidro fosco quente** (glassmorphism) SEMPRE com tint âmbar, nunca branco puro:
  `background: rgba(255, 247, 236, 0.62)` + `backdrop-filter: blur(20px) saturate(140%)`.
- **Papel-manteiga** (grain overlay) a 3% de opacidade sobre o body inteiro — é o
  detalhe que impede o design de parecer "vetor limpo demais".
- **Luz volumétrica**: todo elemento de destaque tem um `radial-gradient` quente
  atrás dele, como se a fogueira o iluminasse.

### 2.4 Formas

- Nada tem canto vivo. O raio mínimo do sistema é **6 px**; cards usam **28 px**.
- Silhuetas são **squircle** (superelipse), não círculo perfeito nem retângulo arredondado
  comum. Progressive enhancement com `corner-shape: squircle` onde suportado.
- **Blobs** orgânicos como fundo de seção (SVG com 6–8 pontos de controle, morphing lento).
- Ícones com traço **2 px, terminação arredondada, cantos arredondados** — família custom
  "Sparky Icons" derivada da Lucide com raio de junta aumentado.

### 2.5 Referências de estilo (para calibragem, não para cópia)

- **Pixar / *Soul* e *Luca*** — iluminação quente, subsurface scattering, personagens redondos com olhos grandes e bochechas coradas.
- **Studio Ghibli / *Kiki***— aconchego doméstico, luz de janela, objetos com alma.
- **Animal Crossing** — UI que é objeto físico; tudo é fofo mas o sistema econômico é sério.
- **Duolingo (2023+)** — mascote com estados emocionais reais, celebração exagerada e recompensadora, motion tokens disciplinados.
- **Linear** — rigor de sistema, densidade de informação, hierarquia impecável. É daqui que vem o "nível Silicon Valley": spark.fun é *Animal Crossing rodando sobre a engenharia da Linear*.
- **Arc Browser / Raycast** — glassmorphism com propósito, atalhos, sensação de velocidade.

**O original que estamos inventando:** ninguém no mercado fez ainda *"warm-glass cartoon
finance"* — vidro fosco âmbar + personagens 2.5D + tipografia arredondada premium +
dados financeiros de verdade em números tabulares. Esse é o território de spark.fun.

---

## 3. Personalidade da marca

spark.fun é o **amigo que cozinha bem**. Ele te recebe, te serve algo quente,
não te julga por ter perdido dinheiro ontem, mas também não mente sobre risco.

**Arquétipos:** 70% *Caregiver* (acolhimento), 20% *Jester* (brincalhão), 10% *Magician* (a velocidade impossível).

### Voz

- **Calorosa, curta, concreta.** "Seu token está pegando fogo 🔥" > "Volume acima da média".
- **Honesta sobre risco, sem sermão.** "Isso pode ir a zero. A gente ainda acha divertido."
- **Nunca hype vazio.** Sem "TO THE MOON", sem caps-lock, sem exclamações duplas.
- **Celebra o usuário, não o produto.** "Você acendeu isso." > "spark.fun lançou".
- **Fala de velocidade com humor físico.** "Confirmado antes de você piscar." / "6 blocos por piscada."

### Anti-padrões de voz

| ❌ | ✅ |
|---|---|
| "Transaction failed: insufficient funds" | "Faltou um tiquinho de ETH pro gas. Quer adicionar?" |
| "0 results found" | "Nada por aqui ainda. Que tal acender o primeiro?" |
| "WARNING: HIGH RISK ASSET" | "Modo Fogo Selvagem ligado. Isso queima rápido nos dois sentidos." |
| "Loading..." | "Cutucando a fogueira…" |

---

## 4. Como a Robinhood Chain aparece no design

A chain não é um rodapé técnico — é uma **característica sensorial** do produto.

1. **Selo de rede permanente** (Orbit Teal) no header: `⬡ Robinhood Chain · 4663`,
   com um ponto pulsante que bate **exatamente no ritmo do block time real**
   (~100 ms → um pulso suave a cada bloco, agrupado visualmente a cada 10 blocos
   para não virar estroboscópio — ver `06-motion.md § Heartbeat da Chain`).
2. **Gas em ETH, quase zero**: exibido como "⛽ ~R$ 0,00" com um mascote soprando
   a moeda de leve, comunicando "isso não é obstáculo".
3. **Confirmação otimista**: como o bloco fecha em ~100 ms, o padrão de UI é
   *commit-first*. O botão vira ✅ em 120 ms; o hash aparece 80 ms depois.
   **Nunca** existe spinner de "aguardando confirmação" em fluxo feliz.
4. **Uniswap V3 nativo** é o destino da graduação, tratado como um lugar
   sagrado na narrativa: "A Chama Eterna". A pool criada e a liquidez travada
   ganham selo dourado com cadeado.
5. **Faísca de latência**: cada trade confirmado dispara uma faísca que sobe da
   posição do botão até o selo da chain no header. É a assinatura de movimento
   do produto — o usuário aprende a *sentir* a velocidade da Robinhood Chain.
