---
'@tanstack/redact': patch
---

Wait for a child that suspends while a dehydrated Suspense boundary retries hydration and falls back to client rendering, instead of rescheduling the boundary in an endless loop.
