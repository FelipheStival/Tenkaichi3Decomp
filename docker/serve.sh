#!/usr/bin/env bash
# Sobe o servidor local do jogo (com salas online) e mostra os links com a chave.
set -euo pipefail
cd /src

# Cria a chave aqui para já poder mostrar o link; docker/server.mjs reaproveita o mesmo arquivo.
KEY_FILE=port/build/lan.key
[ -s "$KEY_FILE" ] || node -e "require('fs').writeFileSync('$KEY_FILE', require('crypto').randomBytes(18).toString('base64url'), {mode: 0o600})"
KEY=$(cat "$KEY_FILE")

echo
echo "=================================================================="
echo "  Você (Chrome):   http://localhost:4500/?k=$KEY"
echo
echo "  Seu amigo (mesma rede / Hamachi / Tailscale):"
echo "                   http://<seu IP na rede ou no Hamachi>:4500/?k=$KEY"
echo "  (online: Dragon Net Battle no menu principal -> Host / Join)"
echo "=================================================================="
echo

exec node docker/server.mjs 4500 /src/jogo.iso
