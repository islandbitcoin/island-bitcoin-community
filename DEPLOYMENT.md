# Deployment Instructions for kotc Server

## Prerequisites

- SSH access to kotc server (206.189.139.60)
- Docker and Docker Compose installed on server
- Permissions to modify `/opt/stack/community/`

## Deployment Steps

### 1. Build and Export Docker Image Locally

```bash
# Build the image
docker build -t island-bitcoin:latest .

# Save image to tar file
docker save island-bitcoin:latest | gzip > island-bitcoin.tar.gz
```

### 2. Copy Files to Server

```bash
# Copy Docker image
scp island-bitcoin.tar.gz kotc@206.189.139.60:/tmp/

# Copy deployment files
scp docker-compose.yml kotc@206.189.139.60:/opt/stack/community/
scp nginx.conf kotc@206.189.139.60:/opt/stack/community/
scp apps/api/.env.example kotc@206.189.139.60:/opt/stack/community/.env.api
scp apps/web/.env.example kotc@206.189.139.60:/opt/stack/community/.env.web
```

### 3. Deploy on Server

```bash
# SSH into server
ssh kotc@206.189.139.60

# Navigate to deployment directory
cd /opt/stack/community

# Load Docker image
docker load < /tmp/island-bitcoin.tar.gz

# Archive old deployment (if exists)
if [ -d "old" ]; then
  mv old old.$(date +%Y%m%d_%H%M%S)
fi
mkdir -p old
docker compose down
mv docker-compose.yml old/ 2>/dev/null || true

# Set up new deployment
# Edit .env.api and .env.web with production values
nano .env.api  # Set DATABASE_PATH, etc.
nano .env.web  # Set API_URL, etc.

# Start services
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

### 4. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3001/health
# Expected: {"status":"ok"}

# Check web app
curl http://localhost:8080
# Expected: HTML content

# Check from external
curl https://community.islandbitcoin.com
# Expected: Web app loads
```

### 5. Monitor

```bash
# View logs
docker compose logs -f

# Check container status
docker compose ps

# Check resource usage
docker stats
```

## Environment Variables

### API (.env.api)

```bash
DATABASE_PATH=/data/island-bitcoin.db
MIGRATIONS_PATH=/app/apps/api/drizzle
NODE_ENV=production
PORT=3001
```

### Web (.env.web)

```bash
VITE_API_URL=https://community.islandbitcoin.com/api
```

## Rollback Procedure

If deployment fails:

```bash
cd /opt/stack/community

# Stop new deployment
docker compose down

# Restore old deployment
cp old/docker-compose.yml .
docker compose up -d

# Verify
curl http://localhost:3001/health
```

## Health Checks

The deployment includes automatic health checks:

- **API**: `wget --spider -q http://localhost:3001/api/health` every 30s
- **Web**: `wget --spider -q http://localhost:80` every 30s

Containers will restart automatically if health checks fail.

## Troubleshooting

### API Container Won't Start

```bash
# Check logs
docker compose logs api

# Common issues:
# - Database path not writable
# - Missing environment variables
# - Port 3001 already in use
```

### Web Container Returns 404

```bash
# Check nginx config
docker compose exec web cat /etc/nginx/nginx.conf

# Check if files exist
docker compose exec web ls -la /usr/share/nginx/html
```

### Database Issues

```bash
# Check database file
docker compose exec api ls -la /data/

# Run migrations manually
docker compose exec api node apps/api/dist/migrate.js
```

## Post-Deployment Checklist

- [ ] `https://community.islandbitcoin.com` loads
- [ ] Login with Nostr works
- [ ] Games are playable
- [ ] Admin panel accessible
- [ ] Leaderboard displays
- [ ] Events and gallery load
- [ ] No errors in `docker compose logs`
- [ ] Health checks passing
- [ ] Database persists across restarts
- [ ] Old deployment archived

## Maintenance

### Update Deployment

```bash
# Pull new image
scp island-bitcoin.tar.gz kotc@206.189.139.60:/tmp/
ssh kotc@206.189.139.60
cd /opt/stack/community
docker load < /tmp/island-bitcoin.tar.gz
docker compose up -d --force-recreate
```

### Backup Database

```bash
# Backup SQLite database
docker compose exec api sqlite3 /data/island-bitcoin.db ".backup /data/backup-$(date +%Y%m%d).db"

# Copy backup to local
docker cp island-bitcoin-api:/data/backup-$(date +%Y%m%d).db ./
```

### View Logs

```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web

# Last 100 lines
docker compose logs --tail=100
```
