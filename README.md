# spark.fun

Token launchpad nativo da **Robinhood Chain** (chain ID **4663** · L2 Arbitrum
Orbit · gas em ETH · ~100 ms de block time · Uniswap V3 nativo).

> A lareira do trading on-chain: uma casa quentinha onde qualquer pessoa acende
> um token em 20 segundos — e a chama pega em 100 milissegundos.

- **Especificação de design:** [`design/`](./design) — 12 documentos, fonte de
  verdade visual (paleta, tipografia, tokens, componentes, motion, mascotes,
  perfis, acessibilidade, microcopy).
- **Design system em código:** `frontend/src/index.css` + `frontend/tailwind.config.js`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 · CRA/craco · Tailwind · Recharts · react-router 7 |
| Backend | FastAPI · Motor (MongoDB) · WebSocket |
| Auth | Nonce assinado pela carteira (EIP-191) + sessão JWT |
| Carteira | EIP-1193 no provider injetado (padrão) ou carteira criada no navegador |

## Rodando

```bash
# backend
cd backend
pip install -r requirements.txt
# .env: MONGO_URL, DB_NAME, SECRET_KEY, CORS_ORIGINS
uvicorn server:app --reload --port 8001

# frontend
cd frontend
yarn install
# .env: REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

### Testes

```bash
python -m pytest tests/          # inclui a paridade JS <-> Python da curva
```

---

## Arquitetura

### A curva de bonding

Produto constante sobre reservas **virtuais**, implementada duas vezes:

- `backend/sparkfun/curve.py` — **fonte de verdade**, liquida todo trade.
- `frontend/src/sparkfun/lib/curve.js` — espelho, só para cotação instantânea
  enquanto o usuário digita.

`tests/test_curve_parity.py` prende as duas: se divergirem, o usuário veria um
número no painel e outro na carteira.

| Parâmetro | Valor |
|---|---|
| Supply total | 1.000.000.000 |
| Vendido na curva | 800.000.000 |
| Para a pool no Uniswap V3 | 200.000.000 |
| Graduação | 12 ETH ou 36.000 USDC arrecadados |
| Fees | criador 1,0% · protocolo 0,5% |
| Mayhem | criador 2,5% · curva mais íngreme · sem limite por carteira |

`virtual_quote_0` é **derivado** para que a curva chegue exatamente no alvo de
graduação no instante em que os 800M são vendidos. Compra que ultrapassa o
restante recebe reembolso do excedente e gradua no mesmo trade.

### Concorrência

Trades usam concorrência otimista: a escrita é condicional ao `base_sold`
contra o qual a cotação foi feita. Um trade concorrente muda esse valor, a
escrita não casa, e a operação é recotada — nunca liquida a preço velho.

### Live feed

WebSocket com fan-out em processo (`Hub`). Eventos são bufferizados em 250 ms
no cliente: com blocos de 100 ms, renderizar por bloco deixaria o gráfico
picotado. A fluidez vem da interpolação, não da frequência de render.

> ⚠️ O `Hub` é **single-worker**. Rodar mais de um worker do uvicorn exige um
> pub/sub (Redis ou change streams do Mongo) atrás da mesma interface.

---

## O que ainda não existe

Honestidade sobre o estado da plataforma:

1. **Feed de preço ETH/USD.** Tokens pareados com ETH têm market cap, volume e
   fees denominados em ETH e são exibidos assim. Totais que somam pares
   diferentes assumem ETH e ficam ligeiramente altos até o feed existir.
2. **Recuperação de conta.** A carteira criada no navegador é não-custodial: a
   frase de 12 palavras é gerada e cifrada no cliente (PBKDF2-SHA256 600k →
   AES-GCM-256) e o servidor só aprende o endereço, depois de a carteira provar
   posse da chave assinando o nonce. Isso é deliberado — o backend não pode
   mover fundo de ninguém — e o preço é que não existe "esqueci minha senha".
   Perder senha e frase perde a carteira. Custódia real (Privy/Turnkey) é
   decisão de produto e de conformidade, não um detalhe de implementação.
3. **Upload de mídia.** A criação aceita URL de imagem; falta o storage.
4. **Creator Room, Share Card, badges dinâmicos e leaderboard na UI** — a API
   já expõe leaderboard e badges; as telas ainda não foram construídas.
5. **Rate limiting e moderação** nos comentários.
