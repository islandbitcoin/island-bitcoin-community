# Island Bitcoin Community

> A Bitcoin-native community platform for the Caribbean, built with Nostr and Lightning.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/islandbitcoin/island-bitcoin-community/releases/tag/v1.0.0)

## 🌴 Overview

Island Bitcoin Community is an open-source platform connecting Bitcoin enthusiasts across the Caribbean. Built on Nostr for decentralized identity and featuring Lightning Network integration for Bitcoin rewards.

**Live Site:** [community.islandbitcoin.com](https://community.islandbitcoin.com)

## ✨ Features

- **Nostr Authentication** - Login with Nostr keys (NIP-07, NIP-46, nsec)
- **Bitcoin Trivia** - Educational games with Lightning rewards
- **Event Discovery** - Find Bitcoin meetups and workshops across the islands
- **Community Gallery** - Share moments from Caribbean Bitcoin events
- **Leaderboards** - Track top contributors and earners

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## 📚 Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - System design and technical overview
- **[Deployment](docs/DEPLOYMENT.md)** - Production deployment guide
- **[Contributing](docs/CONTRIBUTING.md)** - How to contribute to the project

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Backend:** Hono, Node.js, SQLite, Drizzle ORM
- **Infrastructure:** Docker, Caddy, Nginx
- **Protocols:** Nostr (NIP-07, NIP-46, NIP-98), Lightning Network

## 📦 Monorepo Structure

```
island-bitcoin-community/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Hono API server
├── packages/
│   ├── nostr/        # Nostr utilities
│   └── shared/       # Shared types
└── docs/             # Documentation
```

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](docs/CONTRIBUTING.md) to get started.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- **Website:** [islandbitcoin.com](https://islandbitcoin.com)
- **Community:** [community.islandbitcoin.com](https://community.islandbitcoin.com)
- **GitHub:** [github.com/islandbitcoin/island-bitcoin-community](https://github.com/islandbitcoin/island-bitcoin-community)

---

Built with ₿ and 🏝️ by the Island Bitcoin community
