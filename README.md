# Next.js getItemsLru key-length retention reproduction

This is a minimal App Router reproduction for a residual filesystem route cache LRU sizing issue in Next.js.

The app defines one dynamic route handler:

```txt
/api/logs/[id]
```

The reproduction script sends many unique long URL paths to that route. On affected Next.js versions, the filesystem route cache stores one LRU entry per original URL path but its size accounting does not include the URL key length.

## Run

```bash
npm install
npm run build
npm start
```

In another terminal:

```bash
node test-memory-leak.mjs
```

Useful environment variables:

```bash
NEXT_LRU_REPRO_REQUESTS=1200000 node test-memory-leak.mjs
NEXT_LRU_REPRO_SLUG_BYTES=200 node test-memory-leak.mjs
NEXT_LRU_REPRO_CONCURRENCY=32 node test-memory-leak.mjs
NEXT_ORIGIN=http://127.0.0.1:3000 node test-memory-leak.mjs
```

## What to observe

For a quick smoke test, run fewer requests and watch the process heap grow. For a stronger confirmation, run with `NEXT_LRU_REPRO_REQUESTS=1200000`, take a heap snapshot of the `next start` process, and inspect retained `LRUNode` instances.

The expected affected retainer path is:

```txt
resolveRoutes
  -> handleRoute
    -> getItem (filesystem.ts)
      -> set (lru-cache.ts)
```

The important detail is not that the LRU is unbounded. PR #89040 already fixed the size-0 unbounded case. This reproduction targets the remaining under-counting case: `getItemsLru` counts null entries as `1`, while each entry still retains the original URL key string.
