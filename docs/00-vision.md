# Vision

## What is Genesis Lists?

Genesis Lists is an open-source, self-hostable application for creating and managing simple lists. The initial focus is **shopping lists**, with a calm Material Design 3 interface that works on phones and desktops in the browser. The product mark is the Material Symbols Receipt Long icon.

It is inspired by tools like Google Keep, but owned and operated by the people who run it—no cloud vendor lock-in for personal data.

## Principles

1. **Self-host first** — One-command Docker deploy; data stays on your machine or server.
2. **Simple by default** — Lists and checklist items; no feature sprawl in MVP.
3. **Spec-driven** — Behavior is defined in `docs/` and OpenAPI before (and above) code.
4. **Multi-user ready** — Isolated accounts from day one; sharing comes later with an explicit design.
5. **Extensible auth later** — Local username/password now; OIDC (e.g. Authentik) on the roadmap.

## Personas

| Persona | Needs |
|---------|--------|
| Household shopper | Quick add/check items on a phone while shopping |
| Self-hoster | Reliable Docker deploy, backups, HTTPS behind a reverse proxy |
| Open-source contributor | Clear specs, typed API, predictable monorepo |

## Non-goals (MVP)

- Shared or collaborative lists
- Third-party / OIDC authentication
- Real-time multi-device sync beyond normal HTTP request/response
- Offline-first PWA with conflict resolution
- Native mobile or desktop apps
- Rich notes, images, labels, reminders, or Keep-style boards

See [Roadmap](08-roadmap.md) for planned post-MVP work.
