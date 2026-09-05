# Slice 17 — the lesson becomes a screen, not a block

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both. This slice is user-interface work only: **no server file, no shared
contract, no Redux slice and no API module changes.** If you believe one is
needed, stop and hand it back — that is a defect report, not a licence to edit.

## The problem being fixed

`client/src/pages/LearningLessonPage.tsx` renders the lesson as one vertical
stack of equally weighted `<section>` blocks, each with its own `<h2>`:
«Материал урока», «Видео», «Дополнительные материалы», «Тест урока», and last
of all «Оглавление курса» — a six-column `Table`. The table is the widest and
densest thing on the page, so the eye lands on the course index instead of the
lesson. The learner reads on a screen where the material carries no more weight
than its own navigation.

The fix is the one every large LMS uses (Moodle 4 course index drawer, Canvas,
Coursera, Udemy): **the course index is navigation, so it moves into the
navigation rail, and on a lesson route the rail carries the course instead of
the global menu.** One rail on screen, never two. The lesson gets the page.

## Decisions already made — do not re-derive them

These are settled. Implement them; do not substitute an alternative you like
better. If one of them turns out to be impossible, stop and say why.

1. **No routing changes.** `client/src/routes/router.tsx` is not touched. The
   lesson route stays a child of `AppLayout`. `AppLayout` recognises the lesson
   route itself with
   `useMatch("/learning/courses/:courseId/lessons/:lessonId")`.
2. **No new data fetching.** `LearningLessonPage` already dispatches
   `fetchLearningCourse(courseId)`; the rail reads `state.learning.course` out
   of the store. **The rail must not dispatch anything.** Two components
   fetching the same course would double every request and race the page's own
   abort handling.
3. **The rail is a learning-feature component, not a layout component.**
   `AppLayout` only decides *which* navigation to render; the course rail lives
   in `client/src/features/learning/CourseNav.tsx` and owns the store read.
   `AppLayout` must not import anything from `features/learning` except
   `CourseNav`.
4. **The collapsed state of the two rails is stored separately.** The global
   menu keeps `lms.sidebar`; the course rail gets `lms.sidebar.course`. They are
   different intents: collapsing the menu on the course catalogue to gain width
   must not hide the lesson index the learner has just gained, and a focus-mode
   collapse while reading must not follow them onto the admin screens.
5. **Collapsing the rail does not widen the material.** The reading column keeps
   its measure; collapsing removes distraction, not margins. This is deliberate
   — do not add a `.withoutSidebar`-conditional width to the lesson page.
6. **`LessonToc` survives untouched and stays on the course page.** It is
   removed from the lesson page only. The full six-column table remains one
   click away at `/learning/courses/:courseId`.

## Files

Change:

- `client/src/components/layout/AppLayout.tsx`
- `client/src/components/layout/AppLayout.module.css` (only if a rule below
  needs it; the existing grid already fits)
- `client/src/pages/LearningLessonPage.tsx`
- `client/src/pages/LearningLessonPage.module.css`

Create:

- `client/src/features/learning/CourseNav.tsx`
- `client/src/features/learning/CourseNav.module.css`

Do not touch: `router.tsx`, `navItems.ts`, `LessonToc.tsx`,
`LearningCoursePage.tsx`, any file under `components/ui/`, any file under
`server/` or `shared/`, and any existing test.

## Part 1 — `AppLayout` gains a course mode

Keep every existing behaviour: the mobile top bar and burger, the desktop
collapse button in `.sidebarHead`, the floating «показать» button, the sticky
full-height rail at `>= 64rem`, the drawer below it, and «Выйти» pinned to the
bottom by `margin-top: auto`.

**Storage.** Replace `readSidebarHidden` with a keyed pair. Note that the
current code wraps only the read in `try/catch`; `setItem` throws in private
mode too, so wrap the write as well.

```ts
const SIDEBAR_STORAGE_KEY = "lms.sidebar";
const COURSE_SIDEBAR_STORAGE_KEY = "lms.sidebar.course";

function readHidden(key: string) {
  try {
    return window.localStorage.getItem(key) === "hidden";
  } catch {
    return false;
  }
}

function useHiddenFlag(key: string) {
  const [isHidden, setIsHidden] = useState(() => readHidden(key));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, isHidden ? "hidden" : "shown");
    } catch {
      // Private mode: the preference is simply not remembered.
    }
  }, [key, isHidden]);

  return [isHidden, setIsHidden] as const;
}
```

**Mode.** All hooks stay above the existing `if (!user) return <Loader />`.

```ts
const lessonMatch = useMatch("/learning/courses/:courseId/lessons/:lessonId");
const [isMenuHidden, setMenuHidden] = useHiddenFlag(SIDEBAR_STORAGE_KEY);
const [isCourseNavHidden, setCourseNavHidden] = useHiddenFlag(
  COURSE_SIDEBAR_STORAGE_KEY,
);
const isCourseMode = lessonMatch !== null;
const isSidebarHidden = isCourseMode ? isCourseNavHidden : isMenuHidden;
const setSidebarHidden = isCourseMode ? setCourseNavHidden : setMenuHidden;
```

**Labels.** In course mode the buttons name what they actually hide. Everywhere
else the strings are unchanged, because `e2e/navigation-toggles.spec.ts` finds
them by accessible name and that test must keep passing without being edited.

- hide: `isCourseMode ? "Скрыть оглавление курса" : "Скрыть меню"`
- show: `isCourseMode ? "Показать оглавление курса" : "Показать меню"`

Apply to `aria-label` and `title` on `.sidebarHide` and `.sidebarShow`, and to
the burger's `aria-label`, which today switches on `isMenuOpen`.

**Body.** In course mode the identity block is dropped — the learner's own name
is noise inside the player — and `CourseNav` replaces the `<nav>`:

```tsx
{!isCourseMode && (
  <>
    <p className={styles.userName}>{user.name}</p>
    <p className={styles.role}>{ROLE_LABELS[user.role]}</p>
  </>
)}
```

```tsx
{isCourseMode ? (
  <CourseNav
    navId={NAVIGATION_ID}
    courseId={lessonMatch.params.courseId ?? ""}
    currentLessonId={lessonMatch.params.lessonId ?? ""}
    onNavigate={() => setIsMenuOpen(false)}
  />
) : (
  <nav
    className={styles.navigation}
    id={NAVIGATION_ID}
    aria-label="Основная навигация"
  >
    …unchanged…
  </nav>
)}
```

`NAVIGATION_ID` moves with the mode because the burger's `aria-controls` points
at it. `CourseNav` therefore must render its `<nav id={navId}>` in **every**
state, loading and error included, so the reference never dangles.

The product head, the collapse button and «Выйти» stay in both modes. «Выйти»
staying means the learner is never trapped in the player.

## Part 2 — `CourseNav`

```tsx
export type CourseNavProps = {
  navId: string;
  courseId: string;
  currentLessonId: string;
  onNavigate: () => void;
};
```

Reads `useAppSelector((state) => state.learning.course)`. `LoadStatus` is
`"idle" | "loading" | "ready" | "error"`. Guard against a stale course exactly
the way the lesson page already does — compare lowercased ids — so that
navigating between two courses never paints the previous course's lessons:

```ts
const course = courseState.data;
const isReady =
  courseState.status === "ready" &&
  course !== null &&
  course.id.toLowerCase() === courseId.toLowerCase();
```

Structure, in order:

1. A `<Link>` to `/learning/courses/${courseId}` with `onClick={onNavigate}` and
   the text «← К курсу». Rendered always — it needs no data, and it is the
   escape hatch that replaces the global menu.
2. The course title, when ready, as a `<p>` — not a heading. The page's `<h1>`
   is the lesson, and a rail must not compete for the document outline.
3. Course progress, when ready:
   `<ProgressBar value={course.progressPercent} label="Прогресс курса" />`.
   **Check it at the real rail width** — 17rem minus `2 × var(--space-5)` leaves
   about 14rem, and `ProgressBar` lays its label, track and «60 %» value out for
   a wide column. If it breaks there, drop the component and render
   `Пройдено {course.progressPercent} %` as plain text instead, and say so in
   the report. Do not edit `ProgressBar.module.css` — it is shared with the
   course page and the profile.
4. `<nav id={navId} aria-label="Навигация по курсу">` containing an `<ol>` of
   the lessons when ready, `<Loader label="Загрузка курса" />` while `"idle"` or
   `"loading"` or when the id guard fails, and nothing at all on `"error"` — the
   page itself renders the error, and the rail must not repeat it.

Each `<li>` carries, in this order: the order number, the title, and the
duration via `formatMinutes(lesson.durationMinutes)`. Reuse
`LESSON_ACCESS_STATE_LABELS` from `./learningFormat`; the state is carried by
colour and weight for sighted users, so put the label text in a visually hidden
`<span>` so it is not lost for everyone else. Copy the hiding declarations
verbatim from `.caption` in
`client/src/components/ui/Table/Table.module.css` — there is no global helper
and this slice does not add one.

Item rendering by `lesson.state`:

- `locked` — a `<span>`, never a link, muted colour. Not focusable, not
  clickable.
- `completed` and `available` — a `<Link>` with `onClick={onNavigate}`.
- the current lesson, matched case-insensitively against `currentLessonId` — a
  `<span>` with `aria-current="step"`, highlighted with `--color-primary` over
  `--color-surface-subtle`, the same visual language `.navLink.active` already
  uses in the global menu. It is not a link to itself.

The list must cope with a long course. The rail is already
`position: sticky; height: 100dvh; overflow-y: auto` at `>= 64rem`, so give the
`<nav>` `min-height: 0` and let the existing rail scroll do the work rather than
nesting a second scroller. Do not set a fixed pixel height.

Do not show `isRequired` or `hasTest` in the rail. Those columns are the reason
the course page keeps the table.

## Part 3 — `LearningLessonPage`

Remove the `LessonToc` import and its usage. Everything else below is hierarchy
work: the material must become the largest and quietest thing on the screen.

**Header.** Today it is five stacked lines — back link, course title, `<h1>`,
meta, state. Compress to three:

```tsx
<Link className={styles.back} to={`/learning/courses/${courseId}`}>
  ← {course.title}
</Link>
<h1>{lesson.title}</h1>
<p className={styles.meta}>
  Урок {lesson.order} · {formatMinutes(lesson.durationMinutes)} ·{" "}
  {lesson.isRequired ? "Обязательный" : "Необязательный"} ·{" "}
  <span role="status">
    {LESSON_PROGRESS_STATUS_LABELS[lesson.progressStatus]}
  </span>
</p>
```

The back link now does the work of the breadcrumb and the course title at once.
Keep `role="status"` on the state span and nowhere else — it is the live region
that announces completion, and putting it on the whole line would re-announce
static text.

**Progress bar.** Remove `<ProgressBar … label="Прогресс курса" />` from the
page. Course-level progress belongs to the rail, and the numbered list with the
current item highlighted already tells the learner where they are.

**Material.** Delete the visible `<h2>Материал урока</h2>`. The lesson title is
the heading of its own material, and a heading over a heading is what makes the
block read as a widget rather than as the page. Keep an `<h2>` carrying the
visually hidden class so the section still announces itself. Keep the white
surface, the border and the radius, but raise the padding to `var(--space-6)`:
this is the reading sheet, not one card among five.

**Actions.** «Завершить урок» and the prev/next `<nav>` are two blocks separated
by a gap today, which reads as unrelated. Make them one row:

```tsx
<div className={styles.actions}>
  {completeButton}
  <nav className={styles.neighbours} aria-label="Навигация по урокам">
    {previous && <Link …>← Предыдущий урок</Link>}
    {next && <Link …>Следующий урок →</Link>}
  </nav>
</div>
```

`.actions` is `display: flex; flex-wrap: wrap; align-items: center;
justify-content: space-between; gap: var(--space-4)`. It must lay out correctly
with either half missing — the first lesson has no previous, and a lesson with a
required test has no complete button. The `<nav>` keeps its accessible name.
Keep the button's `isLoading` guard and the existing `handleComplete` logic
exactly as they are.

**Order on the page** after the change: back link, `<h1>`, meta, archived
notice, material, video, resources, test card, action error, actions, success
notice. Video, resources and the test card keep their visible `<h2>`s — they are
genuinely separate sections, and most lessons have none of them.

**Measure.** `.page` gets `max-width: 46rem; margin-inline: auto;`. Roughly
seventy characters is the reading measure; the 72rem the layout hands out is for
tables, not prose. Add `line-height: 1.7` to `.content`. None of this is
conditional on the rail being collapsed — see decision 5.

## Part 4 — what must still be true afterwards

- `/learning/courses/:id` and every other route show the global menu exactly as
  before, with the same accessible names and the same `lms.sidebar` key.
- Below `64rem` the lesson route shows the top bar and the burger, and the
  burger opens the course rail as a drawer. Clicking a lesson in it closes the
  drawer — that is what `onNavigate` is for.
- Collapsing the course rail, reloading, and returning to the lesson keeps it
  collapsed; the global menu on `/admin` is unaffected, and the reverse holds.
- A locked lesson in the rail is neither focusable nor clickable.
- All four load states of the lesson page still render: loading, empty
  (`course_not_assigned`, `lesson_locked`, `not_found`), error with retry, and
  data. During those states the rail shows «← К курсу» and nothing misleading.
- No user-visible text is hardcoded in English.

## Verification

`npm run typecheck`, `npm run lint`, `npm run build`, `npm run test` — all four
green before you write the report. The Playwright suite is a gate here because
`e2e/navigation-toggles.spec.ts` covers the sidebar you are editing: run it too,
per `AGENTS.md` section 9, without `--headed`, `--ui`, screenshots or the report
viewer. Do not edit any spec file; if one fails, that is a finding for the
report, not a file to change.

## Report

`.codex/reports/slice-17.md`, in the established shape. State explicitly:

- whether `ProgressBar` fitted the rail or you fell back to plain text;
- how the rail behaved with the longest seeded course, and whether the list
  needed a scroller of its own;
- anything in this prompt that disagreed with the code, with the file and line
  that settled it.
