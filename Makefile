# spark.fun — local development
#
#   make setup     install everything
#   make chain     local chain, forked from Robinhood Chain mainnet
#   make deploy    publish the contracts locally and seed some tokens
#   make backend   API + chain indexer
#   make web       the app
#   make test      every test suite
#
# Four terminals: chain, backend, web, and one for you.

.PHONY: setup setup-contracts setup-backend setup-web mongo chain deploy backend web test test-contracts test-python clean

setup: setup-contracts setup-backend setup-web
	@echo ""
	@echo "Ready. Now, in separate terminals:"
	@echo "  make mongo    (once)"
	@echo "  make chain"
	@echo "  make deploy"
	@echo "  make backend"
	@echo "  make web"

setup-contracts:
	cd contracts && npm install

setup-backend:
	cd backend && python3 -m pip install -r requirements-local.txt

setup-web:
	cd frontend && yarn install

mongo:
	docker compose up -d
	@echo "MongoDB on 27017"

# Forking gives the local chain the real Uniswap V3 deployment, so graduation
# works here exactly as it will in production. Needs network access; without
# it, run `cd contracts && FORK=0 npx hardhat node` and graduation will revert.
chain:
	cd contracts && npx hardhat node

deploy:
	cd contracts && npx hardhat run scripts/deploy-local.js --network localhost

backend:
	cd backend && python3 -m uvicorn server:app --reload --port 8001

web:
	cd frontend && yarn start

test: test-contracts test-python

test-contracts:
	cd contracts && npx hardhat test

test-python:
	python3 -m pytest tests/ -q

clean:
	rm -rf frontend/build contracts/artifacts contracts/cache
	rm -f frontend/.env.local backend/.env
