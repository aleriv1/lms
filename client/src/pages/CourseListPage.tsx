import {
  COURSE_AUDIENCES,
  COURSE_SORT_FIELDS,
  COURSE_STATUSES,
  SEARCH_DEBOUNCE_MS,
  type CourseListItem,
  type CoursesQuery,
} from "@lms/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { FormError } from "../api/formError";
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Loader,
  Modal,
  Pagination,
  Select,
  Table,
} from "../components/ui";
import type { TableColumn } from "../components/ui/Table/Table";
import {
  COURSE_AUDIENCE_LABELS,
  COURSE_STATUS_LABELS,
} from "../features/courses/courseLabels";
import { canEditCourse } from "../features/courses/coursePermissions";
import {
  archiveCourse,
  deleteCourse,
  fetchCourses,
  publishCourse,
} from "../features/courses/coursesSlice";
import {
  readCoursesQuery,
  toSearchParams,
} from "../features/courses/coursesQueryParams";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./CourseListPage.module.css";

type Confirmation = {
  action: "archive" | "delete";
  course: CourseListItem;
};

const audienceOptions = [
  { value: "", label: "Все аудитории" },
  ...COURSE_AUDIENCES.map((audience) => ({
    value: audience,
    label: COURSE_AUDIENCE_LABELS[audience],
  })),
];

const statusOptions = [
  { value: "", label: "Все статусы" },
  ...COURSE_STATUSES.map((status) => ({
    value: status,
    label: COURSE_STATUS_LABELS[status],
  })),
];

const sortLabels = {
  title: "Название",
  createdAt: "Дата создания",
  updatedAt: "Дата изменения",
  publishedAt: "Дата публикации",
} as const;

const sortOptions = COURSE_SORT_FIELDS.map((field) => ({
  value: field,
  label: sortLabels[field],
}));

function ActionError({ error }: { error: FormError }) {
  return (
    <div className={styles.actionError} role="alert">
      <p>{error.message}</p>
      {error.fields && (
        <ul>
          {error.fields.map((fieldError) => (
            <li key={`${fieldError.field}-${fieldError.message}`}>
              {fieldError.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type DebouncedFilterInputProps = {
  initialValue: string;
  label: string;
  placeholder?: string;
  type?: "search";
  onDebouncedChange: (value: string) => void;
};

function DebouncedFilterInput({
  initialValue,
  label,
  placeholder,
  type,
  onDebouncedChange,
}: DebouncedFilterInputProps) {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (debouncedValue !== initialValue) {
      onDebouncedChange(debouncedValue);
    }
  }, [debouncedValue, initialValue, onDebouncedChange]);

  return (
    <Input
      label={label}
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

export function CourseListPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const list = useAppSelector((state) => state.courses.list);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(
    () => readCoursesQuery(searchParams),
    [searchParams],
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<FormError | null>(null);
  const updateQuery = useCallback(
    (changes: Partial<CoursesQuery>, keepPage = false) => {
      setSearchParams((currentParams) => {
        const currentQuery = readCoursesQuery(currentParams);
        return toSearchParams({
          ...currentQuery,
          ...changes,
          page: keepPage ? (changes.page ?? currentQuery.page) : 1,
        });
      });
    },
    [setSearchParams],
  );

  const updateSearch = useCallback(
    (value: string) => updateQuery({ search: value || undefined }),
    [updateQuery],
  );

  const updateCategory = useCallback(
    (value: string) => updateQuery({ category: value || undefined }),
    [updateQuery],
  );

  useEffect(() => {
    void dispatch(fetchCourses(query));
  }, [dispatch, query]);

  useEffect(() => {
    if (list.status !== "ready") {
      return;
    }
    if (list.meta.page !== query.page) return;
    const lastPage = Math.max(list.meta.totalPages, 1);
    if (query.page <= lastPage) {
      return;
    }
    setSearchParams(
      (currentParams) =>
        toSearchParams({ ...readCoursesQuery(currentParams), page: lastPage }),
      { replace: true },
    );
  }, [list.status, list.meta.totalPages, list.meta.page, query.page, setSearchParams]);

  const performPublish = async (courseId: string) => {
    setActionError(null);
    setIsActionLoading(true);
    const result = await dispatch(publishCourse(courseId));
    setIsActionLoading(false);

    if (publishCourse.rejected.match(result)) {
      setActionError(
        result.payload ?? {
          code: "internal_error",
          message: "Произошла внутренняя ошибка",
        },
      );
    }
  };

  const confirmAction = async () => {
    if (!confirmation) {
      return;
    }

    setActionError(null);
    setIsActionLoading(true);
    const result =
      confirmation.action === "delete"
        ? await dispatch(deleteCourse(confirmation.course.id))
        : await dispatch(archiveCourse(confirmation.course.id));
    setIsActionLoading(false);

    if (
      deleteCourse.rejected.match(result) ||
      archiveCourse.rejected.match(result)
    ) {
      setActionError(
        result.payload ?? {
          code: "internal_error",
          message: "Произошла внутренняя ошибка",
        },
      );
      return;
    }

    setConfirmation(null);
    if (confirmation.action === "delete") {
      void dispatch(fetchCourses(query));
    }
  };

  const columns: TableColumn<CourseListItem>[] = [
    { key: "title", header: "Название", render: (course) => course.title },
    {
      key: "category",
      header: "Категория",
      render: (course) => course.category,
    },
    {
      key: "audience",
      header: "Аудитория",
      render: (course) => COURSE_AUDIENCE_LABELS[course.audience],
    },
    {
      key: "lessonsCount",
      header: "Уроки",
      render: (course) => course.lessonsCount,
    },
    {
      key: "status",
      header: "Статус",
      render: (course) => COURSE_STATUS_LABELS[course.status],
    },
    {
      key: "author",
      header: "Автор",
      render: (course) => course.author.name,
    },
    {
      key: "actions",
      header: "Действия",
      render: (course) =>
        canEditCourse(user, course) ? (
          <div className={styles.rowActions}>
            <Link
              aria-label="Редактировать"
              title="Редактировать"
              to={`/manage/courses/${course.id}/edit`}
            >
              <EditIcon />
            </Link>
            {course.status !== "published" && (
              <Button
                variant="ghost"
                aria-label="Опубликовать"
                title="Опубликовать"
                disabled={isActionLoading}
                onClick={() => void performPublish(course.id)}
              >
                <PublishIcon />
              </Button>
            )}
            {course.status !== "archived" && (
              <Button
                variant="ghost"
                aria-label="Архивировать"
                title="Архивировать"
                disabled={isActionLoading}
                onClick={() => {
                  setActionError(null);
                  setConfirmation({ action: "archive", course });
                }}
              >
                <ArchiveIcon />
              </Button>
            )}
            {course.status === "draft" && (
              <Button
                className={styles.dangerAction}
                variant="ghost"
                aria-label="Удалить"
                title="Удалить"
                disabled={isActionLoading}
                onClick={() => {
                  setActionError(null);
                  setConfirmation({ action: "delete", course });
                }}
              >
                <TrashIcon />
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  const hasFilter = Boolean(
    query.search ||
      query.category ||
      query.audience ||
      query.status ||
      query.authorId,
  );

  return (
    <section>
      <div className={styles.heading}>
        <div>
          <h1>Каталог курсов</h1>
          <p>Создавайте и управляйте учебными курсами.</p>
        </div>
        <Link className={styles.primaryLink} to="/manage/courses/new">
          Создать курс
        </Link>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchField}>
          <DebouncedFilterInput
            key={`search-${query.search ?? ""}`}
            label="Поиск"
            type="search"
            placeholder="Название курса"
            initialValue={query.search ?? ""}
            onDebouncedChange={updateSearch}
          />
        </div>
        <DebouncedFilterInput
          key={`category-${query.category ?? ""}`}
          label="Категория"
          initialValue={query.category ?? ""}
          onDebouncedChange={updateCategory}
        />
        <Select
          label="Аудитория"
          options={audienceOptions}
          value={query.audience ?? ""}
          onChange={(event) =>
            updateQuery({
              audience:
                (event.target.value as CoursesQuery["audience"]) || undefined,
            })
          }
        />
        <Select
          label="Статус"
          options={statusOptions}
          value={query.status ?? ""}
          onChange={(event) =>
            updateQuery({
              status:
                (event.target.value as CoursesQuery["status"]) || undefined,
            })
          }
        />
        <div className={styles.sortField}>
          <Select
            label="Сортировка"
            options={sortOptions}
            value={query.sortBy}
            onChange={(event) =>
              updateQuery({
                sortBy: event.target.value as CoursesQuery["sortBy"],
              })
            }
          />
          <Button
            className={styles.orderButton}
            variant="secondary"
            aria-label={
              query.sortOrder === "asc" ? "По возрастанию" : "По убыванию"
            }
            title={query.sortOrder === "asc" ? "По возрастанию" : "По убыванию"}
            onClick={() =>
              updateQuery({
                sortOrder: query.sortOrder === "asc" ? "desc" : "asc",
              })
            }
          >
            <SortOrderIcon ascending={query.sortOrder === "asc"} />
          </Button>
        </div>
        <Checkbox
          className={styles.ownCheckbox}
          label="Только мои курсы"
          checked={Boolean(user && query.authorId === user.id)}
          onChange={(event) =>
            updateQuery({
              authorId: event.target.checked ? user?.id : undefined,
            })
          }
        />
      </div>

      {actionError && !confirmation && <ActionError error={actionError} />}

      {(list.status === "idle" || list.status === "loading") && (
        <Loader label="Загрузка курсов" />
      )}
      {list.status === "error" && (
        <ErrorState onRetry={() => void dispatch(fetchCourses(query))} />
      )}
      {list.status === "ready" && list.items.length === 0 && !hasFilter && (
        <EmptyState
          title="Курсов пока нет"
          description="Создайте первый курс, чтобы начать работу с каталогом."
          action={<Link to="/manage/courses/new">Создать курс</Link>}
        />
      )}
      {list.status === "ready" && list.items.length === 0 && hasFilter && (
        <EmptyState
          title="Курсы не найдены"
          description="Попробуйте изменить или очистить фильтры."
        />
      )}
      {list.status === "ready" && list.items.length > 0 && (
        <>
          <Table
            caption="Каталог курсов"
            columns={columns}
            rows={list.items}
            getRowKey={(course) => course.id}
          />
          <Pagination
            {...list.meta}
            onPageChange={(page) => updateQuery({ page }, true)}
            onPageSizeChange={(pageSize) => updateQuery({ pageSize })}
          />
        </>
      )}

      <Modal
        isOpen={confirmation !== null}
        title={
          confirmation?.action === "delete"
            ? "Удалить курс"
            : "Архивировать курс"
        }
        onClose={() => {
          if (!isActionLoading) {
            setConfirmation(null);
            setActionError(null);
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={isActionLoading}
              onClick={() => {
                setConfirmation(null);
                setActionError(null);
              }}
            >
              Отмена
            </Button>
            <Button
              variant={confirmation?.action === "delete" ? "danger" : "primary"}
              isLoading={isActionLoading}
              onClick={() => void confirmAction()}
            >
              {confirmation?.action === "delete" ? "Удалить" : "Архивировать"}
            </Button>
          </>
        }
      >
        <p>
          {confirmation?.action === "delete"
            ? `Удалить курс «${confirmation.course.title}»?`
            : `Архивировать курс «${confirmation?.course.title}»?`}
        </p>
        {actionError && <ActionError error={actionError} />}
      </Modal>
    </section>
  );
}

function SortOrderIcon({ ascending }: { ascending: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ascending ? (
        <path d="M12 19V5m0 0-6 6m6-6 6 6" />
      ) : (
        <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
      )}
    </svg>
  );
}

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function EditIcon() {
  return (
    <ActionIcon>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M13.5 6.5l4 4" />
    </ActionIcon>
  );
}

function PublishIcon() {
  return (
    <ActionIcon>
      <path d="M12 16V4m0 0-4 4m4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </ActionIcon>
  );
}

function ArchiveIcon() {
  return (
    <ActionIcon>
      <path d="M3 6h18v3H3z" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </ActionIcon>
  );
}

function TrashIcon() {
  return (
    <ActionIcon>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </ActionIcon>
  );
}
