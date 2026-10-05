# ERA Systems LLC

I'm building a multi-tenant SaaS platform. I've uploaded a reference document for context. Before any code gets written, I need you to explain exactly how you'd deliver tenant isolation on this platform's real infrastructure, not confirm in general terms that it's possible.

Walk me through: the actual Postgres RLS policy pattern you'd use, keyed on a business/tenant identifier, show me a real policy definition. Then walk me through hostname-based tenant resolution, how a request arriving on one business's domain resolves to that business's data before anything renders, and where that logic actually runs. Flag directly if there's any proxy, edge function, or hosting layer on this platform that could rewrite or obscure the real incoming hostname before your resolution logic sees it, that exact failure mode caused a real, hard-to-find bug on a different platform, and I want to know now if it's a risk here too.

Report back before writing any code.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://erasystems.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/74b053ae-5e69-460d-a5f4-b9087a39bf37).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
