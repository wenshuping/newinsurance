# Docker deployment

## 1) Build and start

```bash
cd "/Users/wenshuping/Documents/New project"
docker compose -f docker-compose.prod.yml up -d --build
```

## 2) Check status

```bash
docker compose -f docker-compose.prod.yml ps
curl -sS http://127.0.0.1:4000/api/health
```

## 3) Access URLs

- C: http://127.0.0.1:3003
- B: http://127.0.0.1:3004
- P: http://127.0.0.1:3005
- API: http://127.0.0.1:4000

## 4) Stop

```bash
docker compose -f docker-compose.prod.yml down
```

## 5) Stop and delete data

```bash
docker compose -f docker-compose.prod.yml down -v
```
