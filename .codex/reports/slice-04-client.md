# Slice 04 client self-report

## Completed

- Added the seven typed lesson API wrappers over the existing `apiRequest` client.
- Added the lesson detail slice and all seven async thunks. Rejected API errors are converted to `FormError`, and only fetch/update state is stored in the lesson slice.
- Extended the course slice so lesson create, update, publication, deletion, and reorder results keep the single `CourseDetail.lessons` copy and `lessonsCount` truthful.
- Added pure lesson sorting, next-free-order, and whole-list move helpers with the specified Vitest coverage.
- Added exhaustive Russian lesson-status labels.
- Added the shared lesson form with the shared Zod resolver, numeric order/duration fields, nullable empty video URL, fixed `testId: null`, dynamic resource-link rows, row-specific errors, server field errors, and double-submit protection.
- Added the course table of contents with empty/data states, create/edit links, reorder controls, separate publish/unpublish actions, action errors, and named deletion confirmation.
- Added lesson create/edit pages with their required loading, forbidden, not-found, error, and data states; full-body saves; status feedback; separate lifecycle actions; and deletion navigation.
- Registered the lesson reducer, added both protected routes, and rendered the lesson list below the existing course form without restructuring the page.

## Verification

- Pre-flight seven-route check — matched. Create returned `201` plus all `lessonSchema` keys; update, publish, and unpublish returned `200` plus the same shape; reorder returned `200` with all `courseDetailSchema` keys and `lessons`/`tests`; read one returned `200` plus `lessonSchema`; delete returned `204` with an empty body. The pre-flight course and lesson were removed immediately.
- `npm install` — passed; dependencies were already current, 468 packages audited, 0 vulnerabilities.
- `npm run build` — passed for `shared`, `server`, and `client`. Vite emitted the existing non-failing Rollup warnings about annotation comments in installed Zod files.
- `npm run typecheck` — passed for all three workspaces.
- `npm run lint` — passed.
- `npm run test` — passed: 32 server tests and 10 client tests, including all 8 lesson-ordering tests.
- `npm run db:up` — passed; the existing `lms-mongo` container remains running.
- `npm run seed` — passed; all three seeded users were already present.
- `npm run dev` — Express listened on 4000 and Vite on 5173. Both watchers were stopped after verification; neither port remained listening.
- Browser smoke check — the Vite application rendered meaningful content, no error overlay appeared, navigation worked, and no console errors were recorded.

Browser scenarios:

1. The owned course edit page showed `Оглавление`, `Уроков пока нет`, and the `Добавить урок` link.
2. The first create form showed order `1`; create navigated to its edit page; the course table then showed `1`, `Первый урок`, and `Черновик`.
3. A second lesson forced to order `1` stayed on the create page and showed the server message `Этот порядковый номер уже занят в курсе`; order `2` then saved successfully.
4. On the second lesson, `ftp://x` produced `Ссылка должна начинаться с http:// или https://` directly beneath that resource URL row, with no general form error.
5. After save and reopen, the form showed: `Документация` / `https://example.com/docs`; `Некорректная ссылка` / `https://example.org/material`; `Обязательный урок` was not checked. Thus both resource links and the false required flag survived the full PATCH.
6. The same save sent an empty external-video field and returned success (`Изменения сохранены`); reopening showed the video field still empty.
7. Moving the original first row down changed the rows from `1 Первый урок, 2 Второй урок` to `1 Второй урок, 2 Первый урок`. The first `Вверх` and last `Вниз` controls were disabled before and after the move.
8. Publishing the required first lesson and then the course succeeded; the course showed `Статус: Опубликован`. After unpublishing the lesson, its row returned to `Черновик`. The requested second course-publish result could not be produced for the prompt defect recorded below.
9. Deleting `Второй урок` from the course page showed `Удалить урок «Второй урок»?`; confirmation removed the row. The catalogue then showed the verification course with lesson count `1`.
10. Saving `<script>alert(1)</script><p>Безопасный текст</p>` and reopening returned exactly `<p>Безопасный текст</p>`. No JavaScript dialog appeared, so the client neither sanitized nor executed the content.
11. For the second teacher, the two results were:

    - `/manage/lessons/6a97ed2cf188086a53fcb07b/edit` → `/forbidden`, showing `403`, `Нет доступа`, and `У вашей учетной записи нет прав для просмотра этой страницы.`
    - `/manage/courses/6a97ed16f188086a53fcb064/lessons/new` → `/forbidden`, showing the same text.

12. As `admin@lms.local`, the teacher's lesson edit URL rendered `Редактирование урока`, and the lesson-create URL rendered `Новый урок курса «Курс проверки уроков»` with an order field prefilled from the teacher course.
13. As `student@lms.local`, both new management URLs redirected to `/forbidden` and showed the no-access page.

## Departures, prompt defects, and decisions

- Verification step 8 is impossible with the specified existing client and server lifecycle. Once the course is published, `CourseEditPage` correctly hides its publish action. A direct repeated `POST /courses/:courseId/publish` returned `409 {"code":"conflict","message":"Курс уже опубликован"}` because the server checks the already-published state before publication eligibility. There is no course-unpublish route in the specification or prompt. Therefore the requested later `422 course_not_publishable` cannot follow those steps without an undocumented direct database state change. No client, server, or shared contract was altered to conceal this conflict.
- The prompt requires `lessonsSlice` not to consume publish/unpublish results, while `LessonEditPage` must immediately show the resulting status. The page refetches the lesson after a successful publish/unpublish action, preserving one store copy instead of introducing local lesson state.
- The prompt requires a numeric `durationMinutes` default but supplies no page-specific value. The form uses the contract minimum, `1`, until the author changes it. Lesson order is always supplied by the create/edit pages as directed.

## Files outside the implementation list

- `.codex/reports/slice-04-client.md` — required by the handover section.
- No other file outside the create/modify lists was changed. The pre-existing untracked `materials-for-thoughts/to-clarify/` directory was not touched. Nothing under `server/`, `shared/`, or `client/src/components/ui/` was modified, and `package-lock.json` did not change.

## Database and process state

- Created for pre-flight: one temporary draft course and one lesson; both were removed immediately after all seven endpoints matched.
- Created for browser verification: course `6a97ed16f188086a53fcb064`, lessons `6a97ed2cf188086a53fcb07b` and `6a97ed51f188086a53fcb09d`, and temporary account `slice04.teacher.20260902@lms.local`.
- Lesson `6a97ed51f188086a53fcb09d` was removed through the required confirmation modal. Cleanup removed the remaining lesson, the published verification course, and the temporary account directly from MongoDB. The final exact-target query reported `lessons: 0`, `courses: 0`, and `users: 0`.
- Seeded users and unrelated developer data were not changed. The browser tab, Vite, and Express were stopped. The shared MongoDB container was deliberately left running.

## Blocked or incomplete work

- Only the expected `422 course_not_publishable` in verification step 8 was incomplete because of the prompt defect described above. All implementation requirements and all other verification steps completed.

## Out-of-scope observations

- Unpublishing the only published required lesson leaves an already-published course with no published required lesson. The current server permits this intermediate state; changing that lifecycle rule is outside the client slice.
- Docker Compose repeated the existing warning that `lms-mongo-data` was not originally created by the current Compose project. The shared container operated normally and was left unchanged.
