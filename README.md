# Hosting Platform Workload Catalog

Official workload image catalog for the [K8s Hosting Platform](https://github.com/phoenixtechnam/k8s-hosting-platform).

## Workloads

| Name | Type | Version | Min Plan |
|------|------|---------|----------|
| NGINX + PHP 8.4 | php | 8.4 | Starter |
| Apache + PHP 8.4 | php | 8.4 | Starter |
| WordPress (PHP 8.4) | wordpress | 6.x | Starter |
| Static Site (NGINX) | static | 1.27 | Starter |
| Node.js 22 | nodejs | 22 | Starter |

## Structure

```
catalog.json              # Index of all workloads
<workload-name>/
  manifest.json           # Metadata, resources, env vars, tags
  Dockerfile              # Optional — build instructions
```

### manifest.json fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name |
| `code` | Yes | Unique identifier |
| `type` | Yes | Category (php, nodejs, static, wordpress) |
| `version` | Yes | Version string |
| `description` | Yes | Short description |
| `image` | No | Pre-built container image URL (null if build from source) |
| `has_dockerfile` | Yes | Whether a Dockerfile is included |
| `min_plan` | Yes | Minimum hosting plan required |
| `resources` | Yes | Default CPU/memory requests |
| `ports` | Yes | Exposed container ports |
| `env_vars` | Yes | Configurable environment variables |
| `tags` | Yes | Search/filter tags |

## Usage

Add this repository in the K8s Hosting Platform admin panel:

**Settings > Workload Repositories > Add Repository**

- Name: `Official Catalog`
- URL: `https://github.com/phoenixtechnam/hosting-platform-workload-catalog`
- Branch: `main`

## Adding a New Workload

1. Create a new directory: `my-workload/`
2. Add `manifest.json` with all required fields
3. Optionally add a `Dockerfile`
4. Add the directory name to `catalog.json` → `workloads` array
5. Commit and push — the platform will pick it up on next sync
