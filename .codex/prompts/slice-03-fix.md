# Slice 03 — fix: the catalogue page can strand the user on a page that no longer exists

Read `AGENTS.md` first. It outranks this prompt. The specification outranks both.
Slice 03 is accepted; this is a small correction on top of it. Three changes in
two client files, nothing on the server, nothing under `shared/`.

## Given

- The slice 03 commit is in `main`. `.codex/prompts/slice-03.md` describes what
  was built; you do not need to re-read it to do this, but nothing it fixed may
  regress.
- `readCoursesQuery`, `toSearchParams`, `updateQuery`, the four render states and
  the confirmation modals of `CourseListPage` stay as they are.

## 1. A page number past the end of the catalogue must correct itself

`client/src/pages/CourseListPage.tsx`.

The catalogue keeps `page` in the URL and never checks it against the answer.
Two ways in:

- delete the only course on page 4 — the page refetches page 4, the server
  answers with an empty list, and the screen shows «Курсов пока нет» over a
  catalogue that still holds thirty courses;
- open a bookmark or a hand-typed `?page=99` — the same dead end, without a
  deletion.

`Pagination` is not rendered when the list is empty, so the «Назад» button is not
there to escape with. The only way out is the sidebar link.

Add one effect that clamps the page after a successful load:

```tsx
useEffect(() => {
  if (list.status !== "ready") {
    return;
  }
  const lastPage = Math.max(list.meta.totalPages, 1);
  if (query.page <= lastPage) {
    return;
  }
  setSearchParams(
    (currentParams) =>
      toSearchParams({ ...readCoursesQuery(currentParams), page: lastPage }),
    { replace: true },
  );
}, [list.status, list.meta.totalPages, query.page, setSearchParams]);
```

Three things about it are deliberate; keep them:

- **`replace: true`.** The out-of-range page must not stay in the history stack,
  or the back button walks straight back into it.
- **`Math.max(totalPages, 1)`.** An empty catalogue has `totalPages === 0`, and
  page 0 does not exist — `coursesQuerySchema` would reject it and the URL would
  fall back to the defaults.
- **It runs on `status === "ready"` only.** The meta of a failed or in-flight
  request must never move the user.

The URL change re-runs the existing fetch effect. Do not add a second dispatch,
and **do not add any special case to the deletion path** — the refetch that is
already there produces the new `meta`, and this effect does the rest. That is the
point of fixing it here instead of in `confirmAction`.

## 2. The teacher's navigation is declared twice

`client/src/components/layout/navItems.ts`.

`getNavItems` returns early for a teacher and builds the list literally, so the
`teacher` entry of `NAV_ITEMS` is unreachable — two declarations of the same
menu, one of them dead (`AGENTS.md` forbids dead code). Keep `NAV_ITEMS` as the
single declaration and let the function insert «Мои курсы» after the catalogue
item:

```ts
export function getNavItems(user: PublicUser): NavItem[] {
  const items = NAV_ITEMS[user.role];

  if (user.role !== "teacher") {
    return items;
  }

  return items.flatMap((item) =>
    item.to === "/manage/courses"
      ? [item, { to: `/manage/courses?authorId=${user.id}`, label: "Мои курсы" }]
      : [item],
  );
}
```

`NAV_ITEMS` keeps its `Record<UserRole, NavItem[]>` type and its `teacher` entry
— «Каталог курсов» and «Личный кабинет», in that order. `isNavItemActive` is
correct and is not touched. The rendered order for a teacher stays «Каталог
курсов», «Мои курсы», «Личный кабинет»; the administrator's and the student's
menus do not change.

## 3. A lifecycle result must enter the list as a list item

`client/src/features/courses/coursesSlice.ts`.

`replaceListCourse` writes the `Course` returned by publish/archive/update
straight into `state.list.items`, which holds `CourseListItem`. TypeScript allows
it — the list item is the course minus `description` — so the row silently gains
a `description` the list contract does not have. Strip it through the contract
that defines it:

```ts
items[index] = courseListItemSchema.parse(course);
```

Import `courseListItemSchema` from `@lms/shared` alongside the existing types.
The parse cannot fail: `courseListItemSchema` is `courseSchema.omit({ description: true })`
and the value came from `courseSchema`.

## Not in this fix — do not add it

- No change to any file under `server/` or `shared/`.
- No new tests, no test infrastructure. The client has no page tests yet and
  gets them in slice 11.
- No redesign of the empty states, the filters, the modals or `Pagination`.
- No `useBlocker`, no router migration.

## Verification

From the repository root, and report the result of each:

- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test`.
- In the browser as `teacher@lms.local` (`Password1`), with the seeded data plus
  enough draft courses to fill two pages (create them through the UI and delete
  them afterwards):
  1. Go to page 2, delete the only course on it, confirm. The catalogue must land
     on the last real page with its rows visible — not on an empty «Курсов пока
     нет».
  2. Open `/manage/courses?page=99` by hand. It must correct itself to the last
     page, and a single back button press must leave the catalogue, not return to
     page 99.
  3. Open `/manage/courses?page=99&search=нетакогокурса`, where the result is
     genuinely empty. The page must settle on page 1 with the «Курсы не найдены»
     state and must not loop.
  4. The teacher sidebar still shows «Каталог курсов», «Мои курсы», «Личный
     кабинет»; «Мои курсы» highlights only under `?authorId=<own id>`.
  5. Publish or archive a course from the catalogue row: the row's status changes
     in place, as before.
- The browser console must be empty of warnings and errors, including React's
  «Maximum update depth exceeded» — an effect that writes the URL is exactly the
  shape that can loop.
- Kill the dev server and Vite when you are done; leave the `lms-mongo`
  container running. Remove every course and account you created.

## Hand over

One commit. Write `.codex/reports/slice-03-fix.md` with the same sections as the
slice report: what changed, verification results, departures and defects of this
prompt, files outside the list, database and process state, blocked work. Then
stop: no push, no amend.
