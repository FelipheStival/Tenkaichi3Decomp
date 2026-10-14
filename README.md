# Tenkaichi3Decomp

A native PC port of **Dragon Ball Z: Budokai Tenkaichi 3** (PlayStation 2, USA release, SLUS-21678), built on
the matching decompilation in **BT3-Decompiled**. It is the game's own code compiled for PC, with a new
renderer, sound and input layer underneath; it is not an emulator.

This repository contains **no game data**. You need your own disc image of that release: the setup reads the
game's data from it, and it stays on your computer.

## What works

- The whole game loop: boot, opening movie, menus, saving, fights, split screen.
- A GPU renderer (Vulkan) with the PS2's effects (outline, glow, depth tint, distance blur), each switchable.
  An OpenGL 3.3 renderer draws the same picture for machines without a working Vulkan (F1, Video, Renderer; it
  is also tried by itself when Vulkan cannot start). It is slower than Vulkan.
- Internal resolution from 1x to 8x; 4:3, 16:9, 21:9 and wider without stretching the fight.
- Smooth motion (experimental, off by default; F1, Video, or F9): the game computes a fight 30 times a second, as
  on the console; with this the renderer draws pictures in between, for 60, 120 or 240 a second. The fight itself,
  replays and online play are unchanged, and the two players of an online match need not agree on it. The newest
  picture reaches the screen 17 to 29 ms later than without. Known limits: pictures are left out at camera cuts
  and where the camera would pass through scenery; 240 is uneven; little tested with OpenGL. Works in both halves
  of a split screen.
- Music, voices and sound effects; keyboard and controllers, fully rebindable; two players.
- Clashes: Square counts as a direction (off by default; F1, Controls): in a clash of two beams or two rushes the
  game counts newly pressed directions, which is why the stick is turned; with this each press of Square counts as
  one, as a tap of the d-pad does. It changes only your own pad, so it can be used online.
- Texture packs made for PCSX2 (`.dds` or `.png`): copied into the `textures` folder next to the game, they are used as they are.
- Stages and music from outside the disc: a stage model (`.unk`) dropped into the `stages` folder next to the
  game, or a song (`.adx`) into `songs`, is added to the stage select, its name written in the game's own
  lettering (cut from the disc's name pictures while the game runs). They are not written to the save and are
  not offered in an online match. See [docs/port/adding_stages.md](docs/port/adding_stages.md) and
  [adding_songs.md](docs/port/adding_songs.md).
- In the game, **F1** opens the settings. Its Cheats tab has "Unlock everything" (a debug function the game's
  developers left in: all characters, stages, music, items and Zenni).

- **Online play, experimental** (from release 0.1.8): the main menu's hidden "Dragon Net Battle"
  entry is back and opens a small window. One player hosts on a port, the other joins with the host's address;
  both get the same roster with everything unlocked, each sees their own fighter's view full screen, and leaving
  the match puts each player back where they were with their own save. Linux and Windows play against each
  other. With rollback (the host chooses how many frames, and the input delay) your own moves come out at once
  and the game corrects itself when the other player's buttons arrive.
  The host also chooses the battle (single, team, or DP battle with a limit of 10, 15 or 20) and the time limit.
  Each player sees their own gauges on the left with the players' names under them, and hears the voice language
  chosen in their own save.

Online play is new. It has been played over the internet between a Linux and a Windows machine. The input delay
is chosen from the connection when a match starts (or set by the host), both players need the same release (the
game says so when they differ; 0.1.10 does not play against 0.1.8 / 0.1.9, and 0.1.15 does not play against
0.1.14 and earlier), and the host's port has to be
reachable from the other player (port forwarding, or a virtual network such as Tailscale; there is no relay or
match-making). F1, Video has a meter for the frame rate and, in a match, the ping, rollbacks and waits. The 32-bit
Linux build has no rollback. [docs/netplay_notes.md](docs/netplay_notes.md) is the working log of how it is built
and what was checked.

- In the browser (experimental): the game in a web page on a computer or a phone, with touch controls,
  controllers and online play with room codes and Quick Match; built from your own disc image. See
  [docs/web/README.md](docs/web/README.md), or [run it with Docker](#rodando-no-navegador-com-docker).

See [docs/port/README.md](docs/port/README.md) for the running log of what is done, what is verified and what is not.

## Requirements

- A 64-bit x86 processor and a graphics card with Vulkan support. Most of the work is on the processor (the
  game's arithmetic is reproduced exactly as on the PS2); a recent mid-range CPU is recommended.
- Linux (glibc 2.35 or newer) or Windows 10 / 11.
- About 4 GB of disc space, and your disc image as an `.iso` file.

## Installing a release

Unpack the release, start `Tenkaichi3Decomp-setup` (`Tenkaichi3Decomp-setup.exe` on Windows), choose your disc image, press Play. The
setup checks that the image is the unmodified USA release and unpacks the game's data next to the program.

On a machine without a working Vulkan the setup window and the game use OpenGL by themselves. To ask for OpenGL
from the start (a Vulkan driver that starts but is incomplete, as on Intel Ivy Bridge), set `BT3_GPU_API=gl`:
`BT3_GPU_API=gl ./Tenkaichi3Decomp-setup`, and the same for `./Tenkaichi3Decomp`. The setup also runs without a
window: `./Tenkaichi3Decomp-setup --install <disc image>`.

## Building from source

```
python3 install.py --iso <your disc image>
```

does everything on Linux: checks the tools, reads the disc, builds the 64-bit program and runs the game's demo
fight as a test. `python3 install.py --check` lists what is missing. `port/setup/build.sh && ./Tenkaichi3Decomp-setup` is
the same with a window.

The release archives for Linux and Windows are built from the repository alone, with no disc involved:
`port/release/build.sh` (needs only docker) or the GitHub workflow in `.github/workflows/release.yml`. The
repository carries the shape of the game's built-in data tables without their values (`port/data`); the
finished program fetches the values from your disc when it starts.

## Rodando no navegador com Docker

A versão web (WebAssembly) compilada e servida por um único comando, em qualquer sistema com Docker
(macOS, inclusive Apple Silicon, Linux ou Windows). Não precisa instalar Emscripten, Python nem Node na máquina.

### 1. Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Engine + Compose)
- A **sua** imagem do jogo de **PS2, versão USA (SLUS-21678)**, sem modificações. Outras regiões, a versão de Wii
  e ISOs modificadas não funcionam (o build confere o checksum)
- Cerca de **10 GB livres** em disco (a ISO e os dados extraídos dela)

### 2. Colocar a ISO

Copie a ISO para a raiz do projeto com o nome **`jogo.iso`**. O `.gitignore` já ignora `*.iso` e tudo o que é extraído dela.

### 3. Rodar

```bash
docker compose up        # compila o que faltar e sobe o servidor
docker compose up -d     # o mesmo, em segundo plano (o link aparece em: docker compose logs serve)
docker compose down      # desliga
```

A primeira vez demora bastante: o build extrai a ISO e compila o jogo inteiro. Nas próximas, só refaz o que
mudou e o servidor sobe em segundos. Quando estiver pronto, o log mostra:

```
==================================================================
  Você (Chrome):   http://localhost:4500/?k=<chave>
  Seu amigo (mesma rede / Hamachi / Tailscale):
                   http://<seu IP na rede ou no Hamachi>:4500/?k=<chave>
==================================================================
```

Abra o link no **Chrome** ou no Edge (versão JSPI, a mais rápida). O Safari também funciona (versão Asyncify).
A chave fica em `port/build/lan.key` e não muda entre execuções. Sem ela, o servidor responde 403. Depois do
primeiro acesso, o navegador guarda um cookie.

### Jogar online na mesma rede (Wi-Fi, Hamachi, Tailscale, ZeroTier)

O servidor do Docker (`docker/server.mjs`) já inclui as salas online que, no deploy oficial, ficam no Cloudflare:

1. Seu amigo abre `http://<seu IP>:4500/?k=<chave>`. Use o IP da rede local, ou o da VPN (no Hamachi, ele começa com `25.`).
2. Os dois entram em **Dragon Net Battle** no menu principal. Um clica em **Host** e passa o código de 4 letras para o
   outro, que clica em **Join**. Ou os dois usam **Quick Match**.
3. O jogo liga os dois navegadores direto (WebRTC). Se não conseguir, os pacotes passam pelo servidor.

Se o macOS perguntar, permita conexões de entrada para o Docker. No PC do amigo, o jogo abre por `http://` com um
IP, e o Chrome pode bloquear controles nesse caso (teclado e toque funcionam). Para liberar, ele pode adicionar
`http://<seu IP>:4500` em `chrome://flags/#unsafely-treat-insecure-origin-as-secure` e reiniciar o Chrome.

Quem abre o link joga com o jogo da sua ISO: compartilhe só com quem também tem o jogo original.

### Resolução e tela

- **F1**, aba **Video**: resolução interna (1x a 8x; o padrão é 2x, ~1280×896; 3x dá ~1920×1344) e formato da tela
  (4:3, 16:9, 21:9...). A escolha fica salva no navegador.
- Também dá para forçar pela URL: `&env=BT3_SCALE=3,BT3_ASPECT=16:9`
- Outras opções da URL: `&hud=1` mostra o FPS, e `&movie=1` ativa o vídeo de abertura.

### Arquivos

| Arquivo | O que faz |
|---|---|
| `docker-compose.yml` | Serviço `build` (compila) e `serve` (sobe só depois de o build terminar com sucesso) |
| `docker/Dockerfile` | Imagem `emscripten/emsdk` + 7z, Pillow (ícones) e `ws` (salas online) |
| `docker/build-web.sh` | Etapas de disco do `install.py` (checagem da ISO, extração, split), `build.py`, `gen_data_web.py` e link das duas versões. Pula o que já está pronto |
| `docker/bin/7z` | Faz o 7z ler a parte ISO9660 da imagem. ISOs regravadas (ImgBurn) também têm UDF, com nomes em minúsculas que o build não encontra |
| `docker/serve.sh` | Cria a chave e mostra os links |
| `docker/server.mjs` | Servidor local: página, disco por range requests, chave de acesso e as salas online (adaptadas de `cloudflare/src/room.js`) |

### Problemas comuns

- **`no SLUS_216.78 on it`**: a ISO não é a versão USA de PS2, ou não está na raiz com o nome `jogo.iso`.
- **`no space left on device`**: libere espaço e rode `docker system prune -f`. Depois, rode `docker compose up` de
  novo: o build continua de onde parou.
- **Imagem sem arm64**: descomente `platform: linux/amd64` no `docker-compose.yml` (fica mais lento por emulação).
- **Erro de compilação com uma versão nova do Emscripten**: o projeto foi feito com a 6.0. Fixe a versão com o
  build arg `EMSDK_VERSION` no `docker/Dockerfile`.
- **Detalhes de um erro**: veja o `install.log` (etapas da ISO) e a saída de `docker compose logs build`.

## Layout

| Path | Contents |
|---|---|
| `src/`, `include/` | The game's code, from BT3-Decompiled; changes for PC are inside `#ifdef PORT` |
| `port/src/` | The PC side: memory, files, memory card, movies; `gs/` renderer, sound, input, settings window |
| `port/tools/` | The build: pointer rewriting for 64-bit, packaging, extraction |
| `port/data/` | The game's built-in data tables as shape only (labels, sizes, pointer slots), no values |
| `port/release/` | The container and scripts that build the release archives |
| `port/setup/` | The setup window |
| `port/third_party/` | Dear ImGui (MIT), the maths library of newlib |
| `port/web/`, `cloudflare/` | The browser build and its optional private deploy ([docs/web/README.md](docs/web/README.md)) |
| `docs/` | Notes on the game (from the decompilation) and `docs/port/` on the port |

This project was made with the help of AI.

## Contributors

- [RexxColder](https://github.com/RexxColder): the OpenGL 3.3 renderer beside Vulkan (the split of the renderer
  into a shared recorder and two back ends), and stages and songs from outside the disc (the manifest, the
  install scripts, the menu changes and their documentation), in
  [pull request #1](https://github.com/z3xox/Tenkaichi3Decomp/pull/1). Both were brought onto the main line
  with changes; the documents under `docs/port/` say which.

## Licence

The port's own code (everything under `port/` except `port/third_party/`, the setup, the build tools, and the
PC changes inside `#ifdef PORT`) is under the [MIT licence](LICENSE). The libraries in `port/third_party/`
keep their own licences (Dear ImGui: MIT; newlib's maths library: its BSD-style terms, in that folder).
The game's code in `src/` and `include/` comes from the decompilation and is not ours to license: it belongs
to the game's rights holders.

## Legal

This project is not affiliated with or endorsed by the game's developers, publishers or rights holders. It
exists for preservation, study and interoperability, and distributes none of the game's assets. All rights to
the game belong to their owners. You need your own legally obtained copy of the game to use it.
