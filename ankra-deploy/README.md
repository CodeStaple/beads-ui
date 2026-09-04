# Deploying this app with Ankra

The stack that runs the app on the `ankra-build` cluster (organisation
`ankra-ab`), as an Ankra stack named `beads-ui` in namespace `beads`.

```bash
ankra cluster apply -f ankra-deploy/cluster.yaml --cluster ankra-build --org ankra-ab
```

Both Secrets are SOPS-encrypted with the organisation's AGE key and declared in
`encrypted_paths`, so this directory is safe to commit — Ankra decrypts them at
deploy time.

- `session-secret` signs session cookies. Rotating it signs everyone out, which
  is the intended way to revoke every session at once.
- `ghcr-pull-secret` pulls the image, because the GHCR package is private.

`apply` is a declarative replace **per stack**: anything this file stops
declaring is removed from the `beads-ui` stack. Other stacks on the cluster are
untouched.

Accounts, passkeys and each organisation's GitHub connection live on the
`beads-linear-data` PersistentVolumeClaim. The issues themselves live in each
organisation's own GitHub repository, never here — so losing this volume costs
sign-in data, not issues.

The Deployment runs a single replica with `maxSurge: 0`: that volume is
ReadWriteOnce, so the old pod must be gone before the new one starts.
