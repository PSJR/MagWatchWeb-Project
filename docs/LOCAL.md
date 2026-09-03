# Rodando o spark.fun na sua máquina

Você não precisa de ETH de verdade nem de contratos publicados. O caminho
local sobe uma cópia da Robinhood Chain (fork da mainnet), publica os
contratos nela e semeia alguns tokens já com trades — então você cria token,
compra, vende e gradua de verdade, com ETH de brinquedo.

## Pré-requisitos

| | Versão | Por quê |
|---|---|---|
| Node | 20+ (testado no 22) | frontend e contratos |
| Python | 3.11+ | backend e indexer |
| Docker | qualquer | só para o MongoDB |
| Yarn | 1.x | o projeto usa `yarn.lock` |

Uma carteira de navegador (MetaMask, Rabby) ajuda para testar sem
WalletConnect.

## Clonar e instalar

```bash
git clone https://github.com/PSJR/MagWatchWeb-Project.git
cd MagWatchWeb-Project
git checkout claude/sparkfun-design-system-89hs11

make setup      # contratos + backend + frontend
```

> O backend usa `backend/requirements-local.txt` (12 pacotes), não o
> `requirements.txt` de 124 linhas da imagem de hospedagem — aquele instala
> boto3, google-genai e outras coisas que o spark.fun não importa.

## Subir (quatro terminais)

```bash
make mongo      # 1x, sobe o MongoDB em container
make chain      # terminal 1 — chain local com fork da mainnet
make deploy     # terminal 2 — publica os contratos e semeia 3 tokens
make backend    # terminal 3 — API + indexer
make web        # terminal 4 — abre em localhost:3000
```

O `make deploy` escreve `frontend/.env.local` e `backend/.env` sozinho, com o
endereço da factory e o bloco de deploy. Ele também imprime uma chave privada
de teste do Hardhat para você importar na carteira.

> O fork precisa de internet — é o que traz o Uniswap V3 real, e é por isso
> que a **graduação funciona localmente**. Sem rede, use
> `cd contracts && FORK=0 npx hardhat node`: trading funciona, graduação
> reverte por falta do Uniswap.

## Conectar a carteira

A chain local é a 31337, não a 4663. Adicione manualmente:

- RPC `http://127.0.0.1:8545`
- Chain ID `31337`
- Símbolo `ETH`

Importe a chave que o `make deploy` imprimiu. Ela é a chave de teste pública
do Hardhat — **nunca** use em rede real.

Sem `REACT_APP_WALLETCONNECT_PROJECT_ID`, o botão do WalletConnect fica
desabilitado com a explicação na tela; use "carteira do navegador". Para
habilitar, pegue um Project ID grátis em `dashboard.reown.com` e coloque em
`frontend/.env.local`.

## Testes

```bash
make test              # tudo
make test-contracts    # 17 testes, graduação contra Uniswap V3 real
make test-python       # paridade de 3 vias + indexer contra chain real
```

## Quando algo não sobe

| Sintoma | Causa provável |
|---|---|
| `Cannot connect to the network localhost` | o `make chain` não está rodando, ou ainda está baixando estado do fork (leva ~15s no primeiro boot) |
| Tokens não aparecem na Home | o indexer não achou a factory — confira `SPARK_FACTORY_ADDRESS` em `backend/.env` e reinicie o backend |
| `uniswap V3 MISSING` no deploy | o nó subiu sem fork; reinicie `make chain` com internet |
| Carteira recusa a rede | adicione a 31337 manualmente, como acima |
| Backend sobe mas `/api/sf/tokens` vem vazio | MongoDB não está no ar (`make mongo`) |

Confira o que o backend acha que está acontecendo:

```bash
curl -s localhost:8001/api/sf/chain | python3 -m json.tool
```

Isso mostra chain, factory, se o indexer está rodando e até que bloco ele leu.
