# Deploying beads-linear

Target: **https://beads.smartoptics.dev** on the `launch-week-2026` cluster,
behind Traefik BasicAuth, with cert-manager TLS and DNS published by Ankra
custom-dns from the ingress annotation.

## One blocker needs a human

Ankra's GitHub App installation does not include this repository, so Ankra
cannot read it to generate the build workflow or publish the image:

```
Could not read the smartoptics-dwdm/beads-linear repository on branch 'main':
GitHub returned HTTP 404 - repository ... was not found, or the configured
GitHub credential cannot access it
```

Grant it once, at
**https://github.com/organizations/smartoptics-dwdm/settings/installations** →
the Ankra app → *Repository access* → add `beads-linear`.

Listing or changing an App installation needs the `admin:org` scope, which the
CLI token here does not carry — hence the manual step.

## Then

```bash
# 1. Ankra re-reads the repo and opens its setup PR
ankra application retry 0486c3a9-0547-4c8e-83f0-678466ec063c
ankra application get  0486c3a9-0547-4c8e-83f0-678466ec063c   # wait for analysis_status: completed

# 2. Merge the setup PR it opens, which publishes the image
#    (Ankra writes ANKRA_REGISTRY_* into this repo's Actions secrets)

# 3. Deploy
helm upgrade --install beads-linear helm/beads-linear \
  --kube-context ankra-launch-week-2026 \
  --namespace beads --create-namespace \
  --set image.tag=<published tag> \
  --set-file github.token=<(gh auth token) \
  --set basicAuth.users='<htpasswd line>'
```

## If you would rather not wait on the App

The image is already built and verified locally. With push credentials for
`registry.ankra.cloud` you can skip Ankra's lane entirely:

```bash
docker login registry.ankra.cloud
docker buildx build --platform linux/amd64 \
  -t registry.ankra.cloud/org-08267821-3c87-47b2-a759-67c3dbf91c0c/images/beads-linear:v1 \
  --push .
```

Then run step 3 above with `--set image.tag=v1`.

## What the chart puts in front of the app

The app has no login of its own and holds a `repo`-scoped GitHub token, so the
ingress carries a Traefik BasicAuth middleware covering **every** route,
including `/api/*` writes. Without it, anyone reaching the host could read the
tracker and delete beads. Swap it for the Ory OIDC pattern
(`login.smartoptics.dev`, as smartcollector does) when you want per-person
identity.

## Verifying after deploy

```bash
kubectl --context ankra-launch-week-2026 -n beads get pods,ingress,certificate
dig +short beads.smartoptics.dev
curl -sI https://beads.smartoptics.dev            # expect 401
curl -sI -u mark:<password> https://beads.smartoptics.dev  # expect 200
```
