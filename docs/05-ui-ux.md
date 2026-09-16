# UI / UX (Material Design 3)

## Goals

- Calm, utilitarian shopping-list UX (not a marketing site).
- Material Design 3 via MUI: tonal surfaces, rounded controls, clear hierarchy.
- Mobile-first; usable at ~360px width; comfortable on desktop with a max content width (~960px for home masonry).

## Application icon

The product mark is Material Symbols **Receipt Long** (`receipt_long`): the published glyph (not a redraw) in white on the primary green tile (`#386a20`), with about 22% corner radius and padding so the glyph stays in the maskable safe zone. The glyph is Apache License 2.0. A copy of that license and the modification notice are in [`apps/web/public/licenses/material-symbols/`](../apps/web/public/licenses/material-symbols/NOTICE).

Assets live in `apps/web/public/` and are copied into the SPA build:

| File | Role |
|------|------|
| `favicon.svg` | Source mark; SVG favicon |
| `favicon.ico` | 16×16 and 32×32 fallback |
| `apple-touch-icon.png` | 180×180 bookmark icon |
| `icon-192.png`, `icon-512.png` | Web manifest icons |
| `site.webmanifest` | Name, icons, theme color `#386a20`, background `#f7fbf1` |

Home-screen PNGs are the same mark composited onto a full-bleed `#386a20` tile so platform masks do not reveal transparent corners. `index.html` also sets `theme-color` to `#386a20`. The manifest is only for the icon and colors: there is no service worker, and installability stays on the [roadmap](08-roadmap.md).

In the UI, a shared mark (MUI `ReceiptLong` on the same green tile) appears only where the product is introduced. On the primary app bar the tile is inverted (light tile, green glyph) so it stays visible.

## Screens

### 1. Login

- Product mark and “Genesis Lists” above the heading.
- Load `GET /api/auth/config` for registration openness, password login, and OIDC settings.
- When password login is enabled: centered card/form with email, password, submit. The email field uses `type="email"` and `autocomplete="email"`.
- When OIDC is enabled: a button labeled with `oidc.buttonText` that navigates to `/api/auth/oidc/start` (full page redirect).
- When both are enabled, show the password form and the OIDC button (OIDC secondary or below a divider).
- When only OIDC is enabled, omit the password fields.
- Link to Register, shown only when registration is open **and** password login is enabled.
- Inline error for auth failure. Support `?error=oidc` with a short message after a failed callback.
- Auto-launch: if `oidc.enabled` and (`oidc.autoLaunch` or `?autoLaunch=1`) and not `?autoLaunch=0`, immediately navigate to `/api/auth/oidc/start`. Do **not** auto-launch when `?error=oidc` is present (unless `?autoLaunch=1` forces it), so the error message is visible.
- On password success → Lists home. OIDC success lands on `/` via server redirect.

### 2. Register

- Product mark and “Genesis Lists” above the heading.
- Email, display name, password, submit — only when password login is enabled and registration is open.
- Display name is optional and helper text explains it defaults to the part of the email before the `@`, and that it is what other people see when sharing.
- Link to Login.
- Validation messages for email/display name/password rules ([01-requirements.md](01-requirements.md)).
- On success → Lists home (session created).
- If registration is closed or password login is disabled, the form is replaced with a short message and a link back to Sign in. No register request is sent.

### 3. Lists home

- Top app bar: inverted product mark, product name “Genesis Lists”, circular avatar with display-name initial opening a menu (Settings, Log out). List detail and Settings do not repeat the mark.
- Search field below the app bar: filters lists by name or preview item text (client-side).
- Body: Keep-style multi-column masonry of list cards (1 / 2 / 3 columns by breakpoint). Card heights vary with preview content; cards do not stretch to match neighbors in a row.
- Each card: list name; when `isOwner` is false, a short “Shared by {ownerName}” line; up to 8 preview item lines (checked items struck through); optional “+N more”; overflow menu.
- Overflow (owner): Rename, Share, Delete.
- Overflow (member): Rename, Leave list (confirm).
- Empty state: short copy + CTA to create first list.
- No matches for search: distinct “No matching lists” empty state.
- Primary create action: FAB “New list”.
- Create / rename: dialog for name.
- Tap card → List detail.

### 4. List detail

- App bar: back, list title (tap to **inline** rename; Enter/blur save, Escape cancel), overflow.
- Overflow (owner): Rename (starts inline edit), Share, Delete list.
- Overflow (member): Rename (starts inline edit), Leave list (confirm). No Delete.
- Open checklist: unticked items only, ordered by `position`. Each row = checkbox + text field; tap checkbox toggles; tap/focus text to edit **inline** without layout shift (Enter/blur save, Escape cancel).
- Ticked section (Google Keep style): ticked items render only here, at the bottom, strikethrough and reduced opacity, also ordered by `position`. Header is a collapse control (`aria-expanded`) showing the count (e.g. “2 ticked”). Collapsed by default; collapse state is client-only and not persisted. Ticking an item does not force-expand. Hidden when nothing is ticked. Unticking restores the item among open items by `position` without rewriting positions. Inline edit and trailing delete work the same as the open checklist.
- Clear: a button on the ticked header (visible only when there are ticked items) opens a confirm dialog, then deletes every ticked item. Unticked items are untouched.
- Delete item via trailing icon.
- Sticky/bottom add row: text field + add button.
- Empty state (“No items yet”) only when the list has zero items. A fully ticked list still shows the ticked section.

### 4b. Share dialog (owner)

- Opened from Share on home card menu or list detail overflow.
- Dialog (`fullWidth`, `maxWidth="sm"`): title “Share list”, search field (filter display names client-side), scrollable list of users.
- Each row: avatar (display-name initial), display name, checkbox. Owner appears at the top as read-only (checked, disabled) labeled as owner — not included in `userIds`.
- Email addresses are never shown here; the directory only carries display names ([07-security.md](07-security.md)).
- Other users: tick = include in member set. Initial ticks match current members from `GET /api/lists/{id}/members`.
- Save calls `PUT /api/lists/{id}/members` with the ticked non-owner user ids (full replace). Cancel discards local checkbox state.
- Errors via snackbar.

### 5. Settings

- App bar: back, “Settings”.
- Show the signed-in display name, email, and auth providers (`local` / `oidc`).
- Display name field with a Save action calling `PATCH /api/auth/me`; success and error feedback inline. Copy notes that this is the name other people see.
- Change password form (current, new, confirm) only when `authProviders` includes `local`; success feedback (other sessions are signed out); inline errors for mismatch / API failures.
- OIDC-only accounts see a short note that password change is unavailable.
- Route: `/settings` (auth required).

## MD3 patterns

- Use theme tokens (primary, surface, on-surface); avoid ad-hoc purple glow aesthetics.
- Prefer `Card` / `List` / `ListItem` / `Checkbox` / `Dialog` / `Fab` / `AppBar` / `TextField`.
- Loading: skeleton or circular progress on initial fetch.
- Errors: snackbar or inline alert; do not lose form input on validation errors.
- Typeface is Roboto, bundled with the SPA (`@fontsource/roboto`). The app does not load fonts from a third-party CDN.

## Navigation

| Route | Screen | Guard |
|-------|--------|-------|
| `/login` | Login | Guest |
| `/register` | Register | Guest |
| `/` | Lists home | Auth |
| `/lists/:id` | List detail | Auth |
| `/settings` | Settings | Auth |

Unauthenticated access to protected routes redirects to `/login`.

## Accessibility

- Labels on all inputs.
- Checkbox + name association.
- Dialogs focus-trapped (MUI default).
- Sufficient contrast via MD3 theme defaults.
