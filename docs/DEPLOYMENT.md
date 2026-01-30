# Deployment Guide

This guide covers local development setup and production deployment for the Island Bitcoin Community platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Development](#docker-development)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **Docker**: >= 20.10.0 (for containerized deployment)
- **Git**: Latest version

### Installation

```bash
# Install Node.js (via nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install pnpm
npm install -g pnpm

# Install Docker
# Follow instructions at https://docs.docker.com/get-docker/
```

## Local Development

### 1. Clone Repository

```bash
git clone https://github.com/islandbitcoin/island-bitcoin-community.git
cd island-bitcoin-community
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

#### Frontend (.env in apps/web/)

```bash
cd apps/web
cp .env.example .env
```

Edit `apps/web/.env`:

```bash
VITE_API_URL=/api

# Feature Flags (set to true to enable)
VITE_FEATURE_TRIVIA_GAME=true
VITE_FEATURE_LEADERBOARD=true
VITE_FEATURE_COMMUNITY_FEED=false
```

#### Backend (.env in apps/api/)

```bash
cd apps/api
cp .env.example .env
```

Edit `apps/api/.env`:

```bash
# Database
DATABASE_URL=./data/db.sqlite

# Server
PORT=3001
NODE_ENV=development

# Nostr Relays (comma-separated)
NOSTR_RELAYS=wss://relay.damus.io,wss://relay.nostr.band

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Initialize Database

```bash
# Run migrations
pnpm --filter @island-bitcoin/api db:migrate

# Seed database (optional)
pnpm --filter @island-bitcoin/api db:seed
```

### 5. Start Development Servers

```bash
# Start all services (frontend + backend)
pnpm dev

# Or start individually:
pnpm --filter @island-bitcoin/web dev    # Frontend on http://localhost:5173
pnpm --filter @island-bitcoin/api dev    # Backend on http://localhost:3001
```

### 6. Access Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health

## Docker Development

### Build and Run with Docker Compose

```bash
# Build images
docker-compose build

# Start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

### Access Application

- **Frontend**: http://localhost:8082
- **API**: http://localhost:3002

## Production Deployment

### Architecture Overview

```
Internet → Caddy (HTTPS) → Docker Containers
                           ├── island-bitcoin-web (Nginx)
                           └── island-bitcoin-api (Node.js)
```

### Server Requirements

- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum
- **Network**: Public IP with ports 80/443 open

### 1. Server Setup

```bash
# SSH into server
ssh root@your-server.com

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y
```

### 2. Clone Repository

```bash
# Create deployment directory
mkdir -p /opt/stack/island-community
cd /opt/stack/island-community

# Clone repository
git clone https://github.com/islandbitcoin/island-bitcoin-community.git .
```

### 3. Configure Environment

```bash
# Copy production environment files
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env

# Edit production settings
nano apps/web/.env
nano apps/api/.env
```

**Production Environment Variables:**

```bash
# apps/web/.env
VITE_API_URL=/api
VITE_FEATURE_TRIVIA_GAME=false  # Enable when ready
VITE_FEATURE_LEADERBOARD=false
VITE_FEATURE_COMMUNITY_FEED=false

# apps/api/.env
DATABASE_URL=/data/db.sqlite
PORT=3001
NODE_ENV=production
NOSTR_RELAYS=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol
```

### 4. Build Docker Images

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Or build individually:
docker build -t island-community-web -f Dockerfile --target web .
docker build -t island-community-api -f Dockerfile --target api .
```

### 5. Start Containers

```bash
# Start with production compose file
docker-compose -f docker-compose.prod.yml up -d

# Verify containers are running
docker ps | grep island-bitcoin
```

### 6. Configure Reverse Proxy (Caddy)

Add to `/opt/stack/caddy/Caddyfile`:

```caddyfile
community.islandbitcoin.com {
    encode zstd gzip
    
    # API routes
    handle /api/* {
        reverse_proxy island-bitcoin-api:3001
    }
    
    # Health check
    handle /health {
        reverse_proxy island-bitcoin-api:3001
    }
    
    # Web app (SPA)
    handle {
        reverse_proxy island-bitcoin-web:80
    }
    
    # Security headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }
}
```

### 7. Connect Containers to Caddy Network

```bash
# Connect to Caddy's network
docker network connect stack_core island-bitcoin-web
docker network connect stack_core island-bitcoin-api

# Reload Caddy
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### 8. Initialize Database

```bash
# Run migrations
docker exec island-bitcoin-api pnpm db:migrate

# Seed database (if needed)
docker exec island-bitcoin-api pnpm db:seed
```

### 9. Verify Deployment

```bash
# Check container health
docker ps | grep island-bitcoin

# Test API health
curl https://community.islandbitcoin.com/health

# Test frontend
curl -I https://community.islandbitcoin.com
```

## Environment Variables

### Frontend (apps/web/.env)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | API base URL | `/api` | Yes |
| `VITE_FEATURE_TRIVIA_GAME` | Enable trivia game | `false` | No |
| `VITE_FEATURE_LEADERBOARD` | Enable leaderboards | `false` | No |
| `VITE_FEATURE_COMMUNITY_FEED` | Enable community feed | `false` | No |

### Backend (apps/api/.env)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | SQLite database path | `./data/db.sqlite` | Yes |
| `PORT` | API server port | `3001` | Yes |
| `NODE_ENV` | Environment | `development` | Yes |
| `NOSTR_RELAYS` | Comma-separated relay URLs | - | Yes |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | No |

## Updating Production

### 1. Pull Latest Changes

```bash
cd /opt/stack/island-community
git pull origin main
```

### 2. Rebuild Containers

```bash
# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Restart containers
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Run Migrations (if needed)

```bash
docker exec island-bitcoin-api pnpm db:migrate
```

### 4. Verify Update

```bash
# Check logs
docker logs island-bitcoin-web
docker logs island-bitcoin-api

# Test endpoints
curl https://community.islandbitcoin.com/health
```

## Database Management

### Backup Database

```bash
# Create backup
docker exec island-bitcoin-api sqlite3 /data/db.sqlite ".backup '/data/backup-$(date +%Y%m%d).sqlite'"

# Copy backup to host
docker cp island-bitcoin-api:/data/backup-$(date +%Y%m%d).sqlite ./backups/
```

### Restore Database

```bash
# Copy backup to container
docker cp ./backups/backup-20260130.sqlite island-bitcoin-api:/data/restore.sqlite

# Restore
docker exec island-bitcoin-api sqlite3 /data/db.sqlite ".restore '/data/restore.sqlite'"
```

### View Database

```bash
# Open SQLite shell
docker exec -it island-bitcoin-api sqlite3 /data/db.sqlite

# Run queries
sqlite> SELECT COUNT(*) FROM users;
sqlite> .tables
sqlite> .schema users
sqlite> .quit
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs island-bitcoin-web
docker logs island-bitcoin-api

# Check container status
docker ps -a | grep island-bitcoin

# Restart container
docker restart island-bitcoin-web
docker restart island-bitcoin-api
```

### API Returns 502 Bad Gateway

```bash
# Verify containers are on same network
docker network inspect stack_core

# Connect to network if missing
docker network connect stack_core island-bitcoin-api
docker network connect stack_core island-bitcoin-web

# Restart Caddy
docker restart caddy
```

### Database Locked Error

```bash
# Check for multiple connections
docker exec island-bitcoin-api lsof /data/db.sqlite

# Restart API container
docker restart island-bitcoin-api
```

### Frontend Shows Blank Page

```bash
# Check nginx logs
docker logs island-bitcoin-web

# Verify files exist
docker exec island-bitcoin-web ls -la /usr/share/nginx/html/

# Rebuild frontend
docker-compose -f docker-compose.prod.yml build web
docker-compose -f docker-compose.prod.yml up -d web
```

### Rate Limit Errors

```bash
# Check rate limit configuration
docker exec island-bitcoin-api cat /app/.env | grep RATE_LIMIT

# Increase limits in .env
RATE_LIMIT_MAX_REQUESTS=200

# Restart API
docker restart island-bitcoin-api
```

## Monitoring

### Health Checks

```bash
# API health
curl https://community.islandbitcoin.com/health

# Container health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Logs

```bash
# View logs
docker logs -f island-bitcoin-web
docker logs -f island-bitcoin-api

# Last 100 lines
docker logs --tail 100 island-bitcoin-api

# Since timestamp
docker logs --since 2026-01-30T08:00:00 island-bitcoin-api
```

### Resource Usage

```bash
# Container stats
docker stats island-bitcoin-web island-bitcoin-api

# Disk usage
docker system df
```

## Security Best Practices

1. **Keep Software Updated**
   ```bash
   apt update && apt upgrade -y
   docker-compose pull
   ```

2. **Use Strong Firewall Rules**
   ```bash
   ufw allow 22/tcp   # SSH
   ufw allow 80/tcp   # HTTP
   ufw allow 443/tcp  # HTTPS
   ufw enable
   ```

3. **Regular Backups**
   - Automate daily database backups
   - Store backups off-server
   - Test restore procedures

4. **Monitor Logs**
   - Set up log aggregation
   - Alert on errors
   - Review access logs

5. **SSL/TLS**
   - Use Caddy for automatic HTTPS
   - Enforce HTTPS redirects
   - Keep certificates updated

## Support

For issues or questions:

- **GitHub Issues**: https://github.com/islandbitcoin/island-bitcoin-community/issues
- **Documentation**: https://github.com/islandbitcoin/island-bitcoin-community/tree/main/docs
- **Community**: https://community.islandbitcoin.com

---

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).  
For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).
