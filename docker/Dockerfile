# Ambiente para o build web (WebAssembly) do Tenkaichi3Decomp.
# Emscripten + Python + Node vêm da imagem oficial; 7z lê a ISO.
ARG EMSDK_VERSION=latest
FROM emscripten/emsdk:${EMSDK_VERSION}

RUN apt-get update \
 && apt-get install -y --no-install-recommends p7zip-full python3-venv python3-pip python3-pil \
 && rm -rf /var/lib/apt/lists/*

# WebSocket para as salas online do servidor local (docker/server.mjs)
RUN mkdir -p /opt/net && cd /opt/net && npm init -y >/dev/null && npm install --no-audit --no-fund ws@8.18.0

WORKDIR /src
