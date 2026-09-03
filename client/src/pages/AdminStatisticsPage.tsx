import {
  GROUP_NAME_MAX_LENGTH,
  LEARNING_STATUSES,
  SEARCH_DEBOUNCE_MS,
  type AdminStatisticsQuery,
  type AdminStatisticsRow,
  type CourseProgressStat,
  type LearningStatus,
} from "@lms/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Loader,
  Pagination,
  ProgressBar,
  Select,
  Table,
} from "../components/ui";
import type { TableColumn } from "../components/ui/Table/Table";
import {
  fetchFilterCourses,
  fetchStatistics,
} from "../features/statistics/statisticsApi";
import {
  formatStatisticsProgress,
  LEARNING_STATUS_LABELS,
} from "../features/statistics/statisticsFormat";
import {
  readStatisticsQuery,
  toSearchParams,
} from "../features/statistics/statisticsQueryParams";
import styles from "../features/statistics/Statistics.module.css";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAppDispatch, useAppSelector } from "../store/hooks";

function GroupFilter({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (debouncedValue !== initialValue) onChange(debouncedValue);
  }, [debouncedValue, initialValue, onChange]);
  return (
    <Input
      label="Группа"
      maxLength={GROUP_NAME_MAX_LENGTH}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

const columns: TableColumn<AdminStatisticsRow>[] = [
  { key: "name", header: "Имя", render: (user) => user.name },
  { key: "group", header: "Группа", render: (user) => user.groupName ?? "—" },
  {
    key: "active",
    header: "Активных курсов",
    render: (user) => user.activeCoursesCount,
  },
  {
    key: "completed",
    header: "Завершено",
    render: (user) => user.completedCoursesCount,
  },
  {
    key: "progress",
    header: "Средний прогресс",
    render: formatStatisticsProgress,
  },
  {
    key: "actions",
    header: "Действия",
    render: (user) => (
      <Link to={`/admin/statistics/users/${user.userId}`}>
        Статистика обучения
      </Link>
    ),
  },
];

const courseColumns: TableColumn<CourseProgressStat>[] = [
  { key: "title", header: "Курс", render: (course) => course.title },
  {
    key: "users",
    header: "Обучающихся с назначением",
    render: (course) => course.assignedUsersCount,
  },
  {
    key: "progress",
    header: "Средний прогресс",
    render: (course) => (
      <ProgressBar
        value={course.averageProgressPercent}
        label="Средний прогресс курса"
      />
    ),
  },
];

export function AdminStatisticsPage() {
  const dispatch = useAppDispatch();
  const list = useAppSelector((state) => state.statistics.list);
  const filterCourses = useAppSelector(
    (state) => state.statistics.filterCourses,
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(
    () => readStatisticsQuery(searchParams),
    [searchParams],
  );
  const updateQuery = useCallback(
    (changes: Partial<AdminStatisticsQuery>, keepPage = false) => {
      setSearchParams((currentParams) => {
        const currentQuery = readStatisticsQuery(currentParams);
        return toSearchParams({
          ...currentQuery,
          ...changes,
          page: keepPage ? (changes.page ?? currentQuery.page) : 1,
        });
      });
    },
    [setSearchParams],
  );
  const updateGroup = useCallback(
    (value: string) => updateQuery({ groupName: value.trim() || undefined }),
    [updateQuery],
  );

  useEffect(() => {
    const request = dispatch(fetchStatistics(query));
    return () => request.abort();
  }, [dispatch, query]);

  useEffect(() => {
    void dispatch(fetchFilterCourses());
  }, [dispatch]);

  useEffect(() => {
    if (
      list.status !== "ready" ||
      !list.data ||
      list.data.meta.page !== query.page
    )
      return;
    const lastPage = list.data.meta.totalPages || 1;
    if (query.page <= lastPage) return;
    setSearchParams(
      (currentParams) =>
        toSearchParams({
          ...readStatisticsQuery(currentParams),
          page: lastPage,
        }),
      { replace: true },
    );
  }, [list.status, list.data, query.page, setSearchParams]);

  if (
    list.error?.code === "forbidden" ||
    filterCourses.error?.code === "forbidden"
  ) {
    return <Navigate to="/forbidden" replace />;
  }

  const courses = filterCourses.data?.items ?? [];
  const selectedCourse = query.courseId?.toLowerCase() ?? "";
  const courseOptions = [
    { value: "", label: "Все курсы" },
    ...courses.map((course) => ({
      value: course.id.toLowerCase(),
      label: course.title,
    })),
  ];
  if (
    selectedCourse &&
    !courses.some((course) => course.id.toLowerCase() === selectedCourse)
  ) {
    courseOptions.push({
      value: selectedCourse,
      label: "Выбранный курс вне списка",
    });
  }
  const hasFilter = Boolean(
    query.courseId || query.groupName || query.learningStatus,
  );
  const data = list.data;

  return (
    <section className={styles.page}>
      <Link to="/admin">На главную</Link>
      <h1>Статистика пользователей</h1>
      <div className={styles.filters}>
        <Select
          label="Курс"
          options={courseOptions}
          value={selectedCourse}
          disabled={
            filterCourses.status === "idle" ||
            filterCourses.status === "loading"
          }
          onChange={(event) =>
            updateQuery({ courseId: event.target.value || undefined })
          }
        />
        <GroupFilter
          key={query.groupName ?? ""}
          initialValue={query.groupName ?? ""}
          onChange={updateGroup}
        />
        <Select
          label="Статус обучения"
          options={[
            { value: "", label: "Любой статус" },
            ...LEARNING_STATUSES.map((status) => ({
              value: status,
              label: LEARNING_STATUS_LABELS[status],
            })),
          ]}
          value={query.learningStatus ?? ""}
          onChange={(event) =>
            updateQuery({
              learningStatus: (event.target.value as LearningStatus) || undefined,
            })
          }
        />
        <Button
          variant="secondary"
          disabled={!hasFilter}
          onClick={() =>
            updateQuery({
              courseId: undefined,
              groupName: undefined,
              learningStatus: undefined,
            })
          }
        >
          Сбросить фильтры
        </Button>
      </div>
      {(filterCourses.status === "idle" ||
        filterCourses.status === "loading") && (
        <Loader label="Загрузка курсов для фильтра" />
      )}
      {filterCourses.status === "error" && (
        <ErrorState
          title="Не удалось загрузить курсы для фильтра"
          description={filterCourses.error?.message}
          onRetry={() => void dispatch(fetchFilterCourses())}
        />
      )}
      {filterCourses.status === "ready" && courses.length === 0 && (
        <EmptyState title="Опубликованных курсов для фильтра пока нет" />
      )}
      {filterCourses.data && filterCourses.data.meta.total > courses.length && (
        <p className={styles.note}>
          В списке первые {filterCourses.data.meta.pageSize} опубликованных
          курсов из {filterCourses.data.meta.total}, по названию.
        </p>
      )}
      {(list.status === "idle" || list.status === "loading") && (
        <Loader label="Загрузка статистики" />
      )}
      {list.status === "error" && (
        <ErrorState
          description={list.error?.message}
          onRetry={() => void dispatch(fetchStatistics(query))}
        />
      )}
      {list.status === "ready" && !data && (
        <EmptyState title="Статистики пока нет" />
      )}
      {list.status === "ready" && data && (
        <>
          <dl className={styles.cards}>
            <div>
              <dt>Пользователей</dt>
              <dd>{data.summary.usersCount}</dd>
            </div>
            <div>
              <dt>Активных пользователей</dt>
              <dd>
                {data.summary.activeUsersCount}
                <p className={styles.note}>
                  учебные действия за последние 30 дней
                </p>
              </dd>
            </div>
            <div>
              <dt>Завершили курсы</dt>
              <dd>{data.summary.completedUsersCount}</dd>
            </div>
            <div>
              <dt>Средний прогресс обучающихся</dt>
              <dd>
                {data.summary.averageProgressPercent} %
                <p className={styles.note}>
                  по пользователям, у которых есть назначения
                </p>
              </dd>
            </div>
          </dl>
          {data.items.length === 0 ? (
            <EmptyState
              title={
                hasFilter ? "Пользователи не найдены" : "Пользователей пока нет"
              }
              description={
                hasFilter
                  ? "По выбранным фильтрам нет пользователей. Попробуйте изменить или очистить фильтры."
                  : "Зарегистрированные пользователи появятся здесь."
              }
            />
          ) : (
            <Table
              caption="Статистика пользователей"
              columns={columns}
              rows={data.items}
              getRowKey={(user) => user.userId}
            />
          )}
          <Pagination
            {...data.meta}
            onPageChange={(page) => updateQuery({ page }, true)}
            onPageSizeChange={(pageSize) => updateQuery({ pageSize })}
          />
          <section>
            <h2>Средний прогресс по курсам</h2>
            {data.courseProgress.length === 0 ? (
              <EmptyState title="Данных о прогрессе по курсам пока нет" />
            ) : (
              <Table
                caption="Средний прогресс по курсам"
                columns={courseColumns}
                rows={data.courseProgress}
                getRowKey={(course) => course.courseId}
              />
            )}
          </section>
        </>
      )}
    </section>
  );
}
