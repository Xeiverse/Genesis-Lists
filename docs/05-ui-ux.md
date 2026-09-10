# UI / UX (Material Design 3)

## Goals

- Calm, utilitarian shopping-list UX (not a marketing site).
- Material Design 3 via MUI: tonal surfaces, rounded controls, clear hierarchy.
- Mobile-first; usable at ~360px width; comfortable on desktop with a max content width (~720px).

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

- Top app bar: product name “Genesis Lists”, overflow/logout.
- Body: responsive grid of list tiles (1 column on narrow screens, 2 on wider). Each tile shows the list title and a preview of items (up to 5, with “+N more” when truncated).
- Empty state: short copy + CTA to create first list.
- Primary create action: FAB or app-bar action “New list”.
- Create: dialog or inline prompt for name.
- Per-list overflow: Rename, Delete (confirm dialog).
- Tap list → List detail.

### 4. List detail

- App bar: back, list title, overflow (rename/delete list).
- Checklist: each row = checkbox + text; tap checkbox toggles; tap text for edit (inline or dialog).
- Delete item via swipe affordance or trailing icon with confirm if destructive is preferred; MVP may use trailing delete icon with confirm.
- Sticky/bottom add row: text field + add button.
- Empty state when no items.

## MD3 patterns

- Use theme tokens (primary, surface, on-surface); avoid ad-hoc purple glow aesthetics.
- Prefer `List` / `ListItem` / `Checkbox` / `Dialog` / `Fab` / `AppBar` / `TextField`.
- Loading: skeleton or circular progress on initial fetch.
- Errors: snackbar or inline alert; do not lose form input on validation errors.

## Navigation

| Route | Screen | Guard |
|-------|--------|-------|
| `/login` | Login | Guest |
| `/register` | Register | Guest |
| `/` | Lists home | Auth |
| `/lists/:id` | List detail | Auth |

Unauthenticated access to protected routes redirects to `/login`.

## Accessibility

- Labels on all inputs.
- Checkbox + name association.
- Dialogs focus-trapped (MUI default).
- Sufficient contrast via MD3 theme defaults.
