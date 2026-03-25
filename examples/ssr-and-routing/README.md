# Stewie example - SSR and Routing

## Dev Instructions

From the Stewie project root.

### Install dependencies

```sh
pnpm i
```

### Generate mock JSON (optional)

>Note: This is an optional step.
>You only need to do this if you want to run the `dev:temp-mock` or `build:temp-mock` as outlined below.

You can either create an empty JSON (null) and it will fallback to the data.json file that's checked in with the repo or you can generate a larger JSON file that's too big and not worth checking in.

**Empty JSON option**

If you're doing this option, you might as well skip it and just use the non-`:temp-mock` scripts for `dev` and `build`.
But, it's available nonetheless.

```sh
pnpm --filter ssr-and-routing run mock:create-empty
```

**Large JSON option**

```sh
pnpm --filter ssr-and-routing run mock:create
```

### Dev server

By default, the server won't try to load the generated JSON, which makes the previous step optional.

**Dev mode, without generated JSON (normal/default)**

```sh
pnpm --filter ssr-and-routing run dev
```

If you want to run the dev server and have it load the generated JSON file.

**Dev mode with generated JSON**

```sh
pnpm --filter ssr-and-routing run dev:temp-mock
```

### Production build

By default, just like dev, the prod build won't try to load the generated JSON, which makes the earlier generation step optional.

**Prod build, without generated JSON (normal/default)**

```sh
pnpm --filter ssr-and-routing run build
```

If you want to build with the generated JSON bundled in, you can do that also.

```sh
pnpm --filter ssr-and-routing run build:temp-mock
```

### Production server

The production server is naive as to whether or not you have used the generated JSON in the **production build**, so it's the same command either way.

```sh
pnpm --filter ssr-and-routing run start
```

### Housekeeping

**clean**

You can clean the dist folder and generated JSON

```sh
pnpm --filter ssr-and-routing run clean
```

**nuke**

To wipe out the dist folder, generated JSON, and node_modules

```sh
pnpm --filter ssr-and-routing run nuke
```
