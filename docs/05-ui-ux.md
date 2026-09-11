# UI / UX (Material Design 3)

## Goals

- Calm, utilitarian shopping-list UX (not a marketing site).
- Material Design 3 via MUI: tonal surfaces, rounded controls, clear hierarchy.
- Mobile-first; usable at ~360px width; comfortable on desktop with a max content width (~960px for home masonry).

## Screens

### 1. Login

- Centered card/form: username, password, submit.
- Link to Register.
- Inline error for auth failure.
- On success → Lists home.

### 2. Register

- Username, password, submit.
- Link to Login.
- Validation messages for username/password rules ([01-requirements.md](01-requirements.md)).
- On success → Lists home (session created).

### 3. Lists home

- Top app bar: product name “Genesis Lists”, username menu (Settings, Log out).
- Search field below the app bar: filters lists by name or preview item text (client-side).
- Body: Keep-style multi-column masonry of list cards (1 / 2 / 3 columns by breakpoint). Card heights vary with preview content; cards do not stretch to match neighbors in a row.
- Each card: list name, up to 8 preview item lines (checked items struck through), optional “+N more”, overflow (rename/delete).
- Empty state: short copy + CTA to create first list.
- No matches for search: distinct “No matching lists” empty state.
- Primary create action: FAB “New list”.
- Create / rename: dialog for name.
- Tap card → List detail.

### 4. List detail

- App bar: back, list title, overflow (rename/delete list).
- Checklist: each row = checkbox + text; tap checkbox toggles; tap text to edit **inline** (Enter/blur save, Escape cancel).
- Delete item via trailing icon.
- Sticky/bottom add row: text field + add button.
- Empty state when no items.

### 5. Settings

- App bar: back, “Settings”.
- Show signed-in username.
- Change password form: current, new, confirm; success feedback; inline errors for mismatch / API failures.
- Route: `/settings` (auth required).

## MD3 patterns

- Use theme tokens (primary, surface, on-surface); avoid ad-hoc purple glow aesthetics.
- Prefer `Card` / `List` / `ListItem` / `Checkbox` / `Dialog` / `Fab` / `AppBar` / `TextField`.
- Loading: skeleton or circular progress on initial fetch.
- Errors: snackbar or inline alert; do not lose form input on validation errors.

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
