# Deploying beads-linear

Target: **https://beads.smartoptics.dev** on the `launch-week-2026` cluster,
behind Traefik BasicAuth, with cert-manager TLS and DNS published by Ankra
custom-dns from the ingress annotation.

## The registry

Harbor at `artifact.smartoptics.dev`, matching every other app on this cluster:

```
artifact.smartoptics.dev/sggame-images/suitcase-backend:sha-...
artifact.smartoptics.dev/chat-demo-images/chat-demo:sha-...
artifact.smartoptics.dev/beads-images/beads-linear:sha-...   <- this app
```

The cluster pulls with the `harbor-registry` dockerconfigjson Secret, already
copied into the `beads` namespace.

## One blocker: a Harbor push credential

Everything else is done. Pushing needs a Harbor account or robot with push
rights to a `beads-images` project (create it if absent — Harbor does not
auto-create projects on push).

```bash
docker login artifact.smartoptics.dev          # password stays in your keychain
docker buildx build --platform linux/amd64 \
  -t artifact.smartoptics.dev/beads-images/beads-linear:v1 --push .
```

For CI, set `HARBOR_USERNAME` / `HARBOR_PASSWORD` as Actions secrets on this
repo — the same names sggame uses — and `.github/workflows/build.yaml` takes
over on every push to main.

## Then deploy

```bash
helm upgrade --install beads-linear helm/beads-linear \
  --kube-context ankra-launch-week-2026 \
  --namespace beads \
  --set image.tag=v1 \
  --set github.token="$(gh auth token)" \
  --set basicAuth.users='<htpasswd line>'
```

## Ankra Applications lane (optional, not required)

`ankra application` (id `0486c3a9-0547-4c8e-83f0-678466ec063c`) currently fails
analysis because Ankra's GitHub App installation does not include this repo.
Adding it needs `admin:org`. This only matters if you want Ankra to generate
and own the build workflow; the Harbor route above does not need it.

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
