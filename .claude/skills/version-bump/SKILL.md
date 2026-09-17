---
name: version-bump
description: Bump the Stewie monorepo to a new version across every location that carries one, then verify nothing was missed. Use when preparing a release, cutting a patch, or when asked to bump/set the version. Covers package manifests, the exported version constants, the scaffolder's dependency ranges, CLAUDE.md, and the changelog.
---

# Bumping the Stewie version

## Why this is a skill and not one `sed`

The version lives in **five** places, and two of them are invisible to every gate in the
repo. When 0.10.4 was cut, `packages/*/package.json` and `templates.ts` were updated and
the rest were missed. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm check:edge` and the
release workflow all passed, because the version tests asserted a hardcoded literal that
matched the stale constant. It was caught by a human who knew the repo, one step before
`npm publish`.

The tests now compare against `package.json`, so that specific drift fails loudly. Work
through the list anyway — the tests cover item 2, nothing covers items 3–5.

## The five locations

| # | Location | What changes | Covered by a gate? |
|---|---|---|---|
| 1 | `packages/*/package.json` | `"version"` field (12 packages) | — |
| 2 | `packages/*/src/index.ts` | `export const version = 'x.y.z'` (12 packages) | ✅ version tests |
| 3 | `packages/create-stewie/src/templates.ts` | `'^x.y.z'` dependency ranges it scaffolds | ❌ |
| 4 | `CLAUDE.md` | the `**Current version:**` line near the top | ❌ |
| 5 | `CHANGELOG.md` | a new entry at the top | ❌ |

**`examples/*/package.json` need nothing.** They depend on `workspace:*` and carry their
own unrelated versions (`0.1.0`). Do not bump them.

## Steps

Replace `X.Y.Z` with the new version and `P.Q.R` with the current one.

```bash
# 1 — package manifests
for f in packages/*/package.json; do
  python3 - "$f" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
open(p,'w').write(s.replace('"version": "P.Q.R"', '"version": "X.Y.Z"', 1))
PY
done

# 2 — exported constants
sed -i '' "s/export const version = 'P.Q.R';/export const version = 'X.Y.Z';/" packages/*/src/index.ts

# 3 — scaffolder dependency ranges
sed -i '' "s|\^P\.Q\.R|^X.Y.Z|g" packages/create-stewie/src/templates.ts

# 4 — CLAUDE.md
sed -i '' "s/\*\*Current version:\*\* P.Q.R/**Current version:** X.Y.Z/" CLAUDE.md
```

Then write the `CHANGELOG.md` entry by hand (item 5). Match the existing
conventional-changelog format:

```
## [X.Y.Z](https://github.com/cwins/stewie-js/compare/vP.Q.R...vX.Y.Z) (YYYY-MM-DD)


### Bug Fixes

* **scope:** subject ([sha](https://github.com/cwins/stewie-js/commit/<full-sha>))
```

Do **not** run `pnpm changelog:root` to regenerate — it runs with `-r 0` and rebuilds the
whole file, discarding any hand-written prose (for example a `### Security` section) from
earlier entries.

## Verify

Two checks. The first is the one that matters — it is the gap that let 0.10.4 through.

```bash
# every exported constant agrees with its package.json
for d in packages/*/; do
  n=$(basename "$d")
  pj=$(node -p "require('./$d/package.json').version")
  src=$(grep -oE "export const version = '[^']+'" "$d/src/index.ts" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
  [ "$pj" = "$src" ] && echo "  ok   $n  $pj" || echo "  MISMATCH $n  pkg=$pj src=$src"
done

# nothing anywhere still says the old version
grep -rn "P\.Q\.R" packages/*/src packages/*/package.json CLAUDE.md docs/ *.md 2>/dev/null | grep -v CHANGELOG
```

The second command should print nothing. Hits in `CHANGELOG.md` are expected and correct —
it is a historical record.

Then the full gate, exactly as CI runs it:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm check:edge && pnpm build && pnpm test
```

`pnpm format:check` is in that list deliberately. The pre-commit hook runs `oxfmt --write`,
and CI runs `format:check` — if they ever disagree, the commit lands dirty and CI fails on
a whitespace diff.

## Commit and tag

```bash
git add -A
git commit -m "chore(release): X.Y.Z"
git tag -a vX.Y.Z -m "X.Y.Z — <one-line summary>"
```

If the commit hook rewrites anything, `git status` afterwards must be clean. If it is not,
amend (`git commit --amend --no-edit`), then **delete and recreate the tag** — an amend
changes the SHA and leaves the tag pointing at the old commit.

## Publish

Publishing runs through the **Release** workflow (`.github/workflows/release.yml`), not
from local. It is `workflow_dispatch` and takes `ref` and `dry_run`.

It checks out `ref` **from the remote**, so the tag has to be pushed before it can build.
You cannot publish before pushing — worth knowing for a security release, where the commit
becomes public a few minutes before a fixed version exists on npm. That window is inherent
to CI publishing from a public repo; do not try to work around it by publishing locally,
which would ship an artifact CI never built or tested.

```bash
git push origin main --tags
gh workflow run release.yml -f ref=vX.Y.Z -f dry_run=true    # verify it passes
gh workflow run release.yml -f ref=vX.Y.Z -f dry_run=false   # publish
```

## After publishing

npm registry **metadata propagates before tarballs do**, and different packages land at
different times. A 404 on a tarball in the first few minutes is normal and does not mean
the publish failed — confirm by checking that `dist-tags.latest` and `dist.shasum` are
registered:

```bash
npm view @stewie-js/<pkg> dist-tags --json
npm view @stewie-js/<pkg>@X.Y.Z dist.shasum
```

If those are present, the publish succeeded and the file is still propagating. Wait rather
than republishing.

Verify the release actually contains what it should, by pulling the published artifact
rather than trusting the build:

```bash
npm pack @stewie-js/<pkg>@X.Y.Z && tar -xzf stewie-js-<pkg>-X.Y.Z.tgz
grep -o "<something from the fix>" package/dist/<file>.js
```

Worth doing for any release with a substantive fix, and non-negotiable for a security one.
