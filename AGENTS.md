<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

This project uses a customized/modern Next.js setup. Key differences contributors should know:

- Server Components are used alongside client components; files with `"use client"` run on the client.
- App routes live under `src/app/` and may use nested layouts and route groups (the `(dashboard)` folder).
- Path aliases (`@/...`) are used for imports; check `tsconfig.json` for mappings before changing imports.
- Build/runtime may depend on Next.js internals in `node_modules/next/dist/docs/` — consult that local guide for breaking-changes details.

For more background and migration notes, see the local Next.js guide in:

	node_modules/next/dist/docs/

