# 10 · Conteúdo e Microcopy

O texto é parte do design. Uma interface fofa com copy corporativa quebra a
ilusão inteira. Estas strings são especificação, não sugestão.

---

## 1. Princípios

1. **Curto.** Título ≤ 5 palavras. Corpo ≤ 2 linhas.
2. **Segunda pessoa.** "Você acendeu" > "Token criado".
3. **Verbo da marca.** *Acender*, *pegar fogo*, *graduar*, *alimentar a fogueira*.
4. **Honesto sobre risco, leve no tom.** Nunca esconder, nunca assustar.
5. **Sem jargão sem tradução.** "bonding curve" aparece como "a fogueira"
   com um tooltip explicando o termo técnico para quem quiser.
6. **Sem exclamação dupla, sem CAPS, sem emoji em excesso** (máx. 1 por string).

---

## 2. Strings-chave

### Onboarding / wallet
| Contexto | PT-BR | EN |
|---|---|---|
| Conectar | `Entrar na casa` | `Come on in` |
| Modal de wallet | `Escolha como entrar` | `How do you want in?` |
| E-mail | `Ou entre com e-mail — a gente cria a carteira pra você` | `Or use email — we'll make the wallet` |
| Conectado | `Bem-vindo à casa 🏠` | `Welcome home 🏠` |
| Rede errada | `Você está em outra casa. Trocar para a Robinhood Chain?` | `Wrong house. Switch to Robinhood Chain?` |
| Selo de rede | `⬡ Robinhood Chain · 4663` | idem |
| Gas | `⛽ ~$0,001 · quase de graça aqui` | `⛽ ~$0.001 · basically free here` |

### Criação
| Contexto | PT-BR |
|---|---|
| Título | `Acender um token` |
| Botão | `🔥 Acender` |
| Custo | `Só o gas da Robinhood Chain. Nada além disso.` |
| Ticker ocupado | `$PIZZA já está aceso. Que tal $PIZZA2?` |
| Publicando | `Riscando o fósforo…` |
| Sucesso | `Está aceso 🔥` |
| Mayhem (explicação) | `Sem limite por carteira, fees maiores pra você e uma curva mais íngreme. Sobe mais rápido. Cai mais rápido. Não dá pra desligar depois.` |
| Mayhem (confirmação) | `Segure para acender o fogo selvagem` |
| Par ETH | `ETH — o gas nativo da chain` |
| Par USDC | `USDC — preço estável, market cap fácil de ler` |

### Trading
| Contexto | PT-BR |
|---|---|
| Botão comprar | `Comprar por 0,05 ETH` |
| Botão vender | `Vender 50%` |
| Enviando | `Mandando pra fogueira…` |
| Sucesso compra | `Pegou 1.284.221 $PIZZA 🔥` |
| Sucesso venda | `Vendido. $142,80 de volta na carteira.` |
| Falha | `Não rolou dessa vez. Seu valor está aqui, é só tentar de novo.` |
| Gas insuficiente | `Faltou um tiquinho de ETH pro gas. Quer adicionar?` |
| Slippage | `O preço mexeu mais que o combinado. Tentar com margem maior?` |
| Fee do criador | `1% vai pro criador — é a lenha dele 🪵` |
| Fee do protocolo | `0,5% mantém a casa aquecida ✨` |
| Turbo | `Turbo ligado: 1 clique, sem confirmação. Rápido que nem a chain.` |

### Curve e graduação
| Contexto | PT-BR |
|---|---|
| Progresso | `62% da fogueira · faltam $18,2K para graduar` |
| 95%+ | `Quase lá… 🔥` |
| Graduação | `$PIZZA GRADUOU` |
| Sub-linha | `Acendeu a fogueira grande.` |
| Pool | `Pool criada no Uniswap V3 · Robinhood Chain` |
| Liquidez | `🔒 Liquidez travada para sempre` |
| CTA | `Negociar no Uniswap V3` |

### Perfil
| Contexto | PT-BR |
|---|---|
| Entrada | `na casa desde 12 mar 2026` |
| PnL positivo | `+$812,40 · seu Pip está feliz` |
| PnL negativo | `−$142,10 · dias assim acontecem` |
| Streak | `🔥 12 dias seguidos por aqui` |
| Streak quebrado | `Senti sua falta. Bora recomeçar?` |
| Fees do criador | `🪵 Lenha acumulada` |
| Próximo nível | `Faltam $180K de volume ou 2 graduações para Platinum` |

---

## 3. Estados vazios (todos com mascote)

| Tela | Mascote | Título | Corpo | CTA |
|---|---|---|---|---|
| Portfolio vazio | Ember `idle` olhando uma prateleira vazia | `Sua carteira está fresquinha` | `Nada aceso ainda. A fogueira está logo ali.` | `Explorar tokens` |
| Favoritos vazio | Pip carregando um coração | `Nenhum favorito ainda` | `Toque no ♡ de qualquer token para guardar aqui.` | `Ver bombando` |
| Histórico vazio | Ember `sleepy` | `Nenhum trade ainda` | `Quando você comprar algo, aparece aqui.` | — |
| Busca sem resultado | Ember `carry` com uma lanterna | `Nada por aqui` | `Ninguém acendeu "%s" ainda. Quer ser o primeiro?` | `Acender $%s` |
| Criador sem tokens | Cinder com tocha apagada | `Sua primeira faísca espera` | `Leva uns 20 segundos e custa só o gas.` | `Acender um token` |
| Feed filtrado vazio | Owl | `Filtro muito apertado` | `Nenhum token bate com isso agora.` | `Limpar filtros` |
| Chat vazio | Ember `wave` | `Silêncio total` | `Diga oi para os outros holders.` | — |
| Sem badges | prateleira vazia | `A prateleira te espera` | `Badges chegam quando você negocia, segura e sobrevive.` | `Ver todos os badges` |
| Offline | Ember `worried` segurando um fio | `Perdemos a conexão` | `A casa continua aqui. Reconectando…` | `Tentar de novo` |
| Erro 500 | Ember `soot` com um extintor | `A gente derrubou alguma coisa` | `Já estamos consertando. Tente em instantes.` | `Recarregar` |
| 404 | Ember com um mapa de cabeça para baixo | `Essa página não existe` | `Mas a fogueira está acesa lá na home.` | `Voltar para casa` |

## 4. Loading (nunca "Carregando…")

`Cutucando a fogueira…` · `Assando marshmallow…` · `Contando faíscas…` ·
`Riscando o fósforo…` · `Empilhando lenha…` · `Aquecendo o chá…` ·
`Perguntando pro bloco 4663…`

Rotacionam aleatoriamente, **só após 700 ms** de espera (abaixo disso não
mostrar nada — a chain é rápida demais para justificar).

## 5. Erros — regras

1. Diga **o que aconteceu**, **por que** e **o que fazer**, nessa ordem, em ≤ 2 linhas.
2. Nunca mostre código de erro sem tradução humana (o código fica num
   "detalhes" recolhível, copiável, para suporte).
3. Nunca perca o que o usuário digitou.
4. Nunca use a palavra "inválido", "falhou" ou "erro" no título. Use o fato.
5. Nunca culpe o usuário.

## 6. Divulgação de risco

Aparece uma vez no onboarding e permanece acessível no rodapé e na Token Page,
em tom honesto e sem letra miúda escondida:

> **Antes de começar.** Tokens criados aqui não têm garantia, auditoria nem
> promessa de valor. A maioria vai a zero. Nunca coloque dinheiro que faz
> falta. A gente deixa isso divertido — mas o risco é de verdade.

Nunca escondido atrás de um accordion, nunca em cinza-claro 10 px.
