#!/usr/bin/env bash
# Extrai os dados da ISO e compila as duas versões web (JSPI e Asyncify) em port/build/web/.
# Cada etapa é pulada se o resultado já existir; rode de novo para continuar após um erro.
set -euo pipefail
cd /src
export PATH="/src/docker/bin:$PATH"  # 7z lendo a parte ISO9660 da imagem

ISO=/src/jogo.iso
[ -f "$ISO" ] || { echo "ISO não encontrada: coloque jogo.iso na raiz do projeto"; exit 1; }

# Só as etapas 2-4 do install.py (disco, dados do jogo, split do executável).
# O install.py inteiro recusa rodar fora do Linux desktop e exige SDL3/Vulkan, que o build web não usa.
python3 - "$ISO" <<'EOF'
import sys, types, install
install.LOG.write_text("install.py (docker/build-web.sh)\n")
install.Step.total = 3
args = types.SimpleNamespace(iso=sys.argv[1], force=False)
try:
    iso = install.step_disc(args)
    install.step_gamedata(args, iso)
    install.step_split(args)
except install.Failed as e:
    print(f"\nFalhou: {e}\nDetalhes em install.log")
    sys.exit(1)
EOF

echo "==> Compilando (build.py)"
python3 port/web/build.py

# gen_data_web.py e o link refazem tudo sempre (minutos): só rodam se algo mudou desde o último build.
# (Não olha os data_*.o, que o próprio gen_data_web.py regrava a cada execução.)
OUT=port/build/web
newer() { [ -n "$(find "$@" -newer "$OUT/bt3-async.wasm" -print -quit)" ]; }
if [ -f "$OUT/bt3-jspi.wasm" ] && [ -f "$OUT/bt3-async.wasm" ] && \
   ! newer port/build/obj_web -name '*.o' ! -name 'data_*' && \
   ! newer port/web config asm assets -type f; then
    echo "==> Nada mudou, mantendo $OUT"
else
    echo "==> Tabelas de dados (gen_data_web.py)"
    python3 port/web/gen_data_web.py
    echo "==> Link: bt3-jspi (Chrome/Edge)"
    python3 port/web/link.py web
    echo "==> Link: bt3-async (Safari/iPhone)"
    python3 port/web/link.py webasync
fi

echo
echo "Pronto: port/build/web/"
ls -lh port/build/web/
