# Hosting Platform Workload Catalog

Official workload image catalog for the [K8s Hosting Platform](https://github.com/phoenixtechnam/k8s-hosting-platform).

## Workloads

### Runtime Images

| Name | Runtime | Web Server | Version | Min Plan |
|------|---------|------------|---------|----------|
| NGINX + PHP 8.4 | php | nginx | 8.4 | Starter |
| Apache + PHP 8.4 | php | apache | 8.4 | Starter |
| WordPress (PHP 8.4) | php | apache | 6.x | Starter |
| Static Site (NGINX) | static | nginx | 1.27 | Starter |
| Node.js 22 | node | pm2 | 22 | Starter |

### Database & Service Images

| Name | Type | Version | Min Plan |
|------|------|---------|----------|
| MariaDB 10.6 | database | 10.6 | Starter |
| PostgreSQL 16 | database | 16 | Business |
| Redis 7 | service | 7 | Business |

## Structure

```
catalog.json                 # Index of all workloads
schema/
  manifest.schema.json       # JSON Schema for manifest validation
scripts/
  validate.mjs               # Validation script (runs in CI)
<workload-name>/
  manifest.json              # Workload definition (see schema below)
  Dockerfile                 # Optional — build instructions (omitted for official images)
```

## Manifest Schema

Every `manifest.json` must conform to `schema/manifest.schema.json`. There are three workload types:

- **`runtime`** — Web application containers (PHP, Node.js, Python, etc.). Deployed as Kubernetes Deployments. May consume services (database, redis) via the `services` field.
- **`database`** — Database engines (MariaDB, PostgreSQL). Deployed as StatefulSets. Declare what they provide via the `provides` field.
- **`service`** — Supporting services (Redis). Deployed as StatefulSets. Declare what they provide via the `provides` field.

### Core Fields (all types)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable display name |
| `code` | string | Yes | Unique identifier slug (must match directory name) |
| `type` | enum | Yes | `runtime`, `database`, or `service` |
| `version` | string | Yes | Primary version (e.g., `8.4`, `10.6`, `22`) |
| `description` | string | Yes | Short description for catalog UI |
| `image` | string/null | Yes | Pre-built image reference, or `null` if Dockerfile is used |
| `has_dockerfile` | boolean | Yes | Whether this directory contains a Dockerfile |
| `min_plan` | enum | Yes | `starter`, `business`, or `premium` |
| `runtime` | enum | Yes | Engine identifier: `php`, `node`, `python`, `mariadb`, `postgresql`, `redis`, etc. |
| `web_server` | string/null | Yes | Web server: `nginx`, `apache`, `pm2`, etc. (`null` for database/service) |
| `deployment_strategy` | enum | Yes | `deployment` (runtime) or `statefulset` (database/service) |
| `resources` | object | Yes | `{ cpu, memory, storage? }` — storage required for statefulsets |
| `container_port` | integer | Yes | Primary port the container listens on |
| `mount_path` | string | Yes | Where the client PVC or data volume is mounted |
| `health_check` | object | Yes | Probe config: either `path` (HTTP) or `command` (exec), plus timing |
| `env_vars` | object | Yes | `{ configurable: string[], fixed: Record<string, string> }` |
| `tags` | string[] | Yes | Keywords for search/filtering |

### Runtime-Only Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `services` | object | Yes | Companion services this workload needs |
| `services.database` | object | No | Database dependency declaration |
| `services.database.required` | boolean | Yes | Whether deployment should be blocked without a database |
| `services.database.engines` | array | Yes | Compatible engines: `[{ type: "mariadb", min_version: "10.4" }]` |
| `services.database.env_mapping` | object | Yes | Maps platform credential keys to app env var names |
| `services.redis` | object | No | Redis dependency declaration |

### Database/Service-Only Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provides` | object | Yes | What this workload offers to runtime workloads |
| `provides.database` | object | No | Database provision declaration |
| `provides.database.engine` | string | Yes | Engine identifier: `mariadb`, `mysql`, `postgresql` |
| `provides.database.version` | string | Yes | Engine version provided |
| `provides.database.protocol` | string | Yes | Connection protocol: `mysql`, `postgresql` |
| `provides.database.port` | integer | Yes | Default listening port |
| `provides.database.credentials` | object | Yes | Env var names for `root_env`, `user_env`, `password_env`, `database_env` |
| `provides.redis` | object | No | Redis provision declaration |

### Example: Runtime Workload (WordPress)

```json
{
  "name": "WordPress (PHP 8.4)",
  "code": "wordpress-php84",
  "type": "runtime",
  "version": "6.x",
  "runtime": "php",
  "web_server": "apache",
  "deployment_strategy": "deployment",
  "container_port": 80,
  "mount_path": "/var/www/html",
  "health_check": {
    "path": "/wp-login.php",
    "command": null,
    "port": 80,
    "initial_delay_seconds": 15,
    "period_seconds": 10
  },
  "services": {
    "database": {
      "required": true,
      "engines": [
        { "type": "mariadb", "min_version": "10.4" },
        { "type": "mysql", "min_version": "5.7" }
      ],
      "env_mapping": {
        "host": "WORDPRESS_DB_HOST",
        "name": "WORDPRESS_DB_NAME",
        "user": "WORDPRESS_DB_USER",
        "password": "WORDPRESS_DB_PASSWORD"
      }
    }
  }
}
```

### Example: Database Workload (MariaDB)

```json
{
  "name": "MariaDB 10.6",
  "code": "mariadb-106",
  "type": "database",
  "version": "10.6",
  "runtime": "mariadb",
  "web_server": null,
  "deployment_strategy": "statefulset",
  "container_port": 3306,
  "mount_path": "/var/lib/mysql",
  "health_check": {
    "path": null,
    "command": ["healthcheck.sh", "--connect", "--innodb_initialized"],
    "port": null,
    "initial_delay_seconds": 30,
    "period_seconds": 10
  },
  "provides": {
    "database": {
      "engine": "mariadb",
      "version": "10.6",
      "protocol": "mysql",
      "port": 3306,
      "credentials": {
        "root_env": "MARIADB_ROOT_PASSWORD",
        "user_env": "MARIADB_USER",
        "password_env": "MARIADB_PASSWORD",
        "database_env": "MARIADB_DATABASE"
      }
    }
  }
}
```

## Validation

All manifests are validated against `schema/manifest.schema.json` on every push and PR.

```bash
# Install dependencies
npm install

# Run validation locally
npm run validate
```

The validator checks:
- JSON Schema compliance for every `manifest.json`
- `code` matches directory name
- `has_dockerfile: true` requires a `Dockerfile` in the directory
- `image: null` requires `has_dockerfile: true`
- No duplicate codes across workloads
- `catalog.json` ↔ directory cross-reference (missing entries, orphan dirs)
- Service dependency consistency (required services have matching providers in catalog)

## Usage

Add this repository in the K8s Hosting Platform admin panel:

**Settings > Workload Repositories > Add Repository**

- Name: `Official Catalog`
- URL: `https://github.com/phoenixtechnam/hosting-platform-workload-catalog`
- Branch: `main`

## Adding a New Workload

1. Create a new directory: `my-workload/`
2. Add `manifest.json` conforming to `schema/manifest.schema.json`
3. Optionally add a `Dockerfile` (set `has_dockerfile: true` and `image: null`)
4. Add the directory name to `catalog.json` → `workloads` array
5. Run `npm run validate` to check for errors
6. Commit and push — CI validates automatically, platform syncs on next interval
