# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cross-tenant-isolation.spec.ts >> Cross-tenant isolation (defence-in-depth) >> user A from institution X is rejected when accessing institution Y resources
- Location: e2e\cross-tenant-isolation.spec.ts:16:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at C:\Users\camil\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     pnpm exec playwright install                           ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```
