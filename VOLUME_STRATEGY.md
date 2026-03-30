# Volume Strategy

## Overview

Each client gets a single PersistentVolumeClaim (`client-storage`) sized to their hosting plan quota. Workloads mount subdirectories of this PVC using Kubernetes `subPath`, with the path determined by `exposes.volumes[].local_path` in each workload manifest.

## How It Works

```yaml
volumes:
  - name: client-storage
    persistentVolumeClaim:
      claimName: client-storage      # One PVC per client

containers:
  - name: my-website                 # e.g. nginx-php84
    volumeMounts:
      - name: client-storage
        mountPath: /var/www/html     # From exposes.volumes[].container_path
        subPath: web                  # From exposes.volumes[].local_path
```

Volume mapping from the manifest's `exposes` section:
- **`local_path`** → Kubernetes `subPath` (where on the PVC)
- **`container_path`** → Kubernetes `mountPath` (where inside the container)
- **`description`** → Displayed in the UI

## Exposes Section

Every workload declares an `exposes` section with ports, volumes, environment variables, and optionally services it provides:

```json
{
  "exposes": {
    "ports": [
      { "port": 80, "protocol": "http", "name": "web", "publishable": true }
    ],
    "volumes": [
      { "description": "Document root", "local_path": "web", "container_path": "/var/www/html" }
    ],
    "env_vars": {
      "configurable": ["PHP_MEMORY_LIMIT"],
      "generated": ["DB_PASSWORD"],
      "fixed": { "PORT": "3000" }
    },
    "services": {
      "database": { "engine": "mariadb", "version": "10.6", "protocol": "mysql" }
    }
  }
}
```

### Ports
- `publishable: true` — can be mapped to a domain via ingress (web, API, console)
- `publishable: false` — internal only (databases, caches)

### Environment Variables
- `configurable` — user can set these when deploying
- `generated` — platform auto-generates (passwords, secrets)
- `fixed` — hardcoded values the workload requires

## PVC Layout on Disk

```
client-storage/
├── web/                 ← PHP sites, static sites
├── app/
│   ├── node/            ← Node.js applications
│   ├── bun/             ← Bun applications
│   ├── python/          ← Python (Django, Flask, FastAPI)
│   ├── ruby/            ← Ruby applications
│   ├── rust/            ← Rust (Actix, Axum, Rocket)
│   ├── golang/          ← Go applications
│   ├── dotnet/          ← .NET applications
│   └── java/            ← Java applications
├── db/
│   ├── mariadb/         ← MariaDB + MySQL data
│   ├── postgresql/      ← PostgreSQL data
│   └── mongodb/         ← MongoDB data
├── cache/
│   └── redis/           ← Redis persistent data
└── storage/
    └── minio/           ← MinIO object storage
```

## Key Benefits

- **Seamless switching**: Changing from nginx-php84 to apache-php84 uses the same `web` local_path — zero data migration
- **Version upgrades**: Upgrading node20→node22 keeps the same `app/node` data
- **Single PVC**: One storage quota per client, easy to monitor and back up
- **SFTP access**: Mount the whole PVC or `web` subPath for file management
- **At-a-glance info**: UI shows ports, volumes, and env vars for every workload

## Adding New Workloads

Set `exposes.volumes[].local_path` to:
- `web` — if it serves the same web files as PHP/static workloads
- `app/{runtime}` — for application runtimes (use the language name)
- `db/{engine}` — for databases (use the engine name)
- `cache/{engine}` — for caching services
- `storage/{engine}` — for object/file storage services
- Empty array `[]` — for in-memory services that need no persistent storage
