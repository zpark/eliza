
# Eliza 🤖

<div align="center">
  <img src="./docs/static/img/eliza_banner.jpg" alt="Eliza Banner" width="100%" />
</div>

<div align="center">

📖 [Dokumentasyon](https://elizaos.github.io/eliza/) | 🎯 [Mga Halimbawa](https://github.com/thejoven/awesome-eliza)

</div>

## ✨ Mga Tampok

- 🛠️ Kumpletong suporta sa [Discord](https://discord.com/), [Twitter](https://twitter.com/), at [Telegram](https://telegram.org/)
- 🔗 Suporta para sa bawat modelo (Llama, Grok, OpenAI, Anthropic, atbp.)
- 👥 Suporta para sa multi-agent at kuwarto
- 📚 Madaling mag-load at makipag-ugnayan sa iyong mga dokumento
- 💾 Naaakses na memorya at imbakan ng dokumento
- 🚀 Napakabisa - maaaring gumawa ng sarili mong mga aksyon at kliyente
- ☁️ Sinusuportahan ang maraming modelo (lokal na Llama, OpenAI, Anthropic, Groq, atbp.)
- 📦 Madaling gamitin!

## Mga Tutorial sa Video

[AI Agent Dev School](https://www.youtube.com/watch?v=ArptLpQiKfI&list=PLx5pnFXdPTRzWla0RaOxALTSTnVq53fKL)

## 🎯 Gamit ito para sa

- 🤖 [Mga Chatbot](https://en.wikipedia.org/wiki/Chatbot)
- 🕵️ Mga Awtonomikong Ahente
- 📈 Pagproseso ng Negosyo
- 🎮 [Mga NPC sa Video Game](https://en.wikipedia.org/wiki/Non-player_character)
- 🧠 Trading

## 🚀 Pangkalahatang-ideya

### Mga Kinakailangan

- [Python 2.7+](https://www.python.org/downloads/)
- [Node.js 23+](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [pnpm](https://pnpm.io/installation)

> **Paalala para sa mga Gumagamit ng Windows:** Kailangan ang [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/install-manual).

### Gamitin ang Starter (Inirerekomenda)

```bash
git clone https://github.com/elizaos/eliza-starter.git
cd eliza-starter
cp .env.example .env
pnpm i && pnpm build && pnpm start
```

Basahin ang [Dokumentasyon](https://elizaos.github.io/eliza/) upang matutunan kung paano i-customize ang Eliza.

### Manwal na Pag-simula ng Eliza (Inirerekomenda lamang kung alam mo ang ginagawa mo)

```bash
# Clone the repository
git clone https://github.com/elizaos/eliza.git

# Checkout the latest release
git checkout $(git describe --tags --abbrev=0)
```

### Simulan ang Eliza gamit ang Gitpod

[![Buksan sa Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/elizaos/eliza/tree/main)

### I-edit ang .env File

Kopyahin ang `.env.example` sa `.env` at punan ang tamang mga halaga.

```bash
cp .env.example .env
```

### Awtomatikong Simulan ang Eliza

Ito ay magse-setup ng proyekto at sisimulan ang bot gamit ang default na karakter.

```bash
sh scripts/start.sh
```

### I-edit ang Character File

1. Buksan ang `packages/core/src/defaultCharacter.ts` para baguhin ang default na karakter. 
2. Mag-load ng custom na mga karakter:
    - Gamitin ang `pnpm start --characters="landas/sa/inyong/character.json"`
    - Puwedeng mag-load ng maraming character file sabay-sabay.
3. Ikonekta ang Twitter (X):
    - Baguhin ang `"clients": []` sa `"clients": ["twitter"]` sa character file upang ikonekta ang Twitter.

### Manwal na Pag-simula ng Eliza

```bash
pnpm i
pnpm build
pnpm start

# Linisin ang proyekto kung bumalik ka dito matapos ang mahabang panahon
pnpm clean
```

#### Karagdagang Mga Kinakailangan

Puwede mong kailangang mag-install ng [Sharp](https://sharp.pixelplumbing.com/). Kung may error, subukang i-install ito gamit ang:

```bash
pnpm install --include=optional sharp
```

### Komunidad at Kontak

- [GitHub Issues](https://github.com/elizaos/eliza/issues): Para sa mga bug at mungkahi sa tampok.
- [Discord](https://discord.gg/ai16z): Para sa pagbabahagi ng aplikasyon at pakikihalubilo sa komunidad.

## Mga Kontribyutor

<a href="https://github.com/elizaos/eliza/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=elizaos/eliza" />
</a>

## Kasaysayan ng mga Bituin

[![Star History Chart](https://api.star-history.com/svg?repos=elizaos/eliza&type=Date)](https://star-history.com/#elizaos/eliza&Date)
