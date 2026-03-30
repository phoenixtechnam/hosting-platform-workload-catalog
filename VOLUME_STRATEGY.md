# Volume Strategy

## Overview

Each client gets a single PersistentVolumeClaim (`client-storage`) sized to their hosting plan quota. Workloads mount subdirectories of this PVC using Kubernetes `subPath`, with the path determined by the workload's `volume_group` field.

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
        mountPath: /var/www/html     # From manifest: mount_path
        subPath: web                  # From manifest: volume_group
```

- **`volume_group`** → Kubernetes `subPath` (where on the PVC)
- **`mount_path`** → Kubernetes `mountPath` (where inside the container)

## Volume Groups

### Web Runtimes (`web`)

All web servers share the same `web` subPath so switching between nginx and apache preserves files.

| Workload | volume_group | Container mount_path |
|----------|-------------|---------------------|
| nginx-php84 | `web` | `/var/www/html` |
| nginx-php83 | `web` | `/var/www/html` |
| apache-php84 | `web` | `/var/www/html` |
| apache-php83 | `web` | `/var/www/html` |
| static-nginx | `web` | `/var/www/html` |
| static-apache | `web` | `/var/www/html` |

### Application Runtimes (`app/{runtime}`)

Each runtime gets its own subPath to avoid data confusion between different languages.

| Workload | volume_group | Container mount_path |
|----------|-------------|---------------------|
| node22 | `app/node` | `/app` |
| node20-lts | `app/node` | `/app` |
| ruby-33 | `app/ruby` | `/app` |
| golang-122 | `app/golang` | `/app` |
| dotnet-8 | `app/dotnet` | `/app` |
| java-21 | `app/java` | `/app` |

### Databases (`db/{engine}`)

Each database engine has its own subPath. MariaDB and MySQL share `db/mariadb` because they have compatible data formats.

| Workload | volume_group | Container mount_path |
|----------|-------------|---------------------|
| mariadb-106 | `db/mariadb` | `/var/lib/mysql` |
| mysql-84 | `db/mariadb` | `/var/lib/mysql` |
| postgresql-16 | `db/postgresql` | `/var/lib/postgresql/data` |
| mongodb-7 | `db/mongodb` | `/data/db` |

### Cache (`cache/{engine}`)

| Workload | volume_group | Container mount_path |
|----------|-------------|---------------------|
| redis-7 | `cache/redis` | `/data` |

### Storage (`storage/{engine}`)

| Workload | volume_group | Container mount_path |
|----------|-------------|---------------------|
| minio | `storage/minio` | `/data` |

### No Volume

| Workload | volume_group | Notes |
|----------|-------------|-------|
| memcached-alpine | `null` | Purely in-memory, no persistent storage |

## PVC Layout on Disk

```
client-storage/
├── web/                 ← PHP sites, static sites
├── app/
│   ├── node/            ← Node.js applications
│   ├── ruby/            ← Ruby applications
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

- **Seamless switching**: Changing from nginx-php84 to apache-php84 uses the same `web` subPath — zero data migration
- **Version upgrades**: Upgrading node20→node22 keeps the same `app/node` data
- **Single PVC**: One storage quota per client, easy to monitor and back up
- **SFTP access**: Mount the whole PVC or `web` subPath for file management
- **Isolation**: Each engine's data is in its own directory — no cross-contamination

## Adding New Workloads

When creating a new workload manifest, set `volume_group` to:
- `web` — if it serves the same web files as PHP/static workloads
- `app/{runtime}` — for application runtimes (use the language/framework name)
- `db/{engine}` — for databases (use the engine name)
- `cache/{engine}` — for caching services
- `storage/{engine}` — for object/file storage services
- `null` — for in-memory-only services that need no persistent storage
