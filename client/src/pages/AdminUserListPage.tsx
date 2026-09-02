import {
  GROUP_NAME_MAX_LENGTH,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
  USER_ROLES,
  USER_SORT_FIELDS,
  USER_STATUSES,
  type AdminUserListItem,
  type AdminUsersQuery,
} from "@lms/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ROLE_LABELS } from "../components/layout/navItems";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Loader,
  Pagination,
  Select,
  Table,
} from "../components/ui";
import type { TableColumn } from "../components/ui/Table/Table";
import {
  readAdminUsersQuery,
  toSearchParams,
} from "../features/users/adminUsersQueryParams";
import { fetchAdminUsers } from "../features/users/adminUsersSlice";
import {
  formatDateTime,
  USER_STATUS_LABELS,
} from "../features/users/userFormat";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./AdminUserListPage.module.css";

const roleOptions = [
  { value: "", label: "Все роли" },
  ...USER_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];
const statusOptions = [
  { value: "", label: "Все статусы" },
  ...USER_STATUSES.map((status) => ({
    value: status,
    label: USER_STATUS_LABELS[status],
  })),
];
const sortLabels = {
  name: "Имя",
  email: "Email",
  createdAt: "Дата создания",
  lastLoginAt: "Последний вход",
} as const;
const sortOptions = USER_SORT_FIELDS.map((field) => ({
  value: field,
  label: sortLabels[field],
}));

type DebouncedFilterInputProps = {
  initialValue: string;
  label: string;
  maxLength: number;
  type?: "search";
  onDebouncedChange: (value: string) => void;
};

function DebouncedFilterInput({
  initialValue,
  label,
  maxLength,
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
      maxLength={maxLength}
      type={type}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

const columns: TableColumn<AdminUserListItem>[] = [
  { key: "name", header: "Имя", render: (user) => user.name },
  { key: "email", header: "Email", render: (user) => user.email },
  { key: "role", header: "Роль", render: (user) => ROLE_LABELS[user.role] },
  {
    key: "groupName",
    header: "Группа",
    render: (user) => user.groupName ?? "—",
  },
  {
    key: "status",
    header: "Статус",
    render: (user) => USER_STATUS_LABELS[user.status],
  },
  {
    key: "activeAssignmentsCount",
    header: "Активные назначения",
    render: (user) => user.activeAssignmentsCount,
  },
  {
    key: "lastLoginAt",
    header: "Последний вход",
    render: (user) =>
      user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—",
  },
  {
    key: "actions",
    header: "Действия",
    render: (user) => (
      <Link to={`/admin/users/${user.id}`}>Открыть карточку</Link>
    ),
  },
];

export function AdminUserListPage() {
  const dispatch = useAppDispatch();
  const list = useAppSelector((state) => state.adminUsers.list);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(
    () => readAdminUsersQuery(searchParams),
    [searchParams],
  );
  const updateQuery = useCallback(
    (changes: Partial<AdminUsersQuery>, keepPage = false) => {
      setSearchParams((currentParams) => {
        const currentQuery = readAdminUsersQuery(currentParams);
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
  const updateGroup = useCallback(
    (value: string) => updateQuery({ groupName: value || undefined }),
    [updateQuery],
  );

  useEffect(() => {
    void dispatch(fetchAdminUsers(query));
  }, [dispatch, query]);

  useEffect(() => {
    if (list.status !== "ready" || list.meta.page !== query.page) {
      return;
    }
    const lastPage = Math.max(list.meta.totalPages, 1);
    if (query.page <= lastPage) return;
    setSearchParams(
      (currentParams) =>
        toSearchParams({
          ...readAdminUsersQuery(currentParams),
          page: lastPage,
        }),
      { replace: true },
    );
  }, [
    list.status,
    list.meta.totalPages,
    list.meta.page,
    query.page,
    setSearchParams,
  ]);

  const hasFilter = Boolean(
    query.search || query.groupName || query.role || query.status,
  );

  return (
    <section>
      <div className={styles.heading}>
        <h1>Пользователи</h1>
        <p>Управляйте учетными записями и назначениями курсов.</p>
      </div>
      <div className={styles.filters}>
        <DebouncedFilterInput
          key={`search-${query.search ?? ""}`}
          label="Поиск по имени или email"
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          initialValue={query.search ?? ""}
          onDebouncedChange={updateSearch}
        />
        <DebouncedFilterInput
          key={`group-${query.groupName ?? ""}`}
          label="Группа"
          maxLength={GROUP_NAME_MAX_LENGTH}
          initialValue={query.groupName ?? ""}
          onDebouncedChange={updateGroup}
        />
        <Select
          label="Роль"
          options={roleOptions}
          value={query.role ?? ""}
          onChange={(event) =>
            updateQuery({
              role:
                (event.target.value as AdminUsersQuery["role"]) || undefined,
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
                (event.target.value as AdminUsersQuery["status"]) || undefined,
            })
          }
        />
        <Select
          label="Сортировка"
          options={sortOptions}
          value={query.sortBy}
          onChange={(event) =>
            updateQuery({
              sortBy: event.target.value as AdminUsersQuery["sortBy"],
            })
          }
        />
        <Button
          variant="secondary"
          onClick={() =>
            updateQuery({
              sortOrder: query.sortOrder === "asc" ? "desc" : "asc",
            })
          }
        >
          {query.sortOrder === "asc" ? "По возрастанию" : "По убыванию"}
        </Button>
      </div>
      {(list.status === "idle" || list.status === "loading") && (
        <Loader label="Загрузка пользователей" />
      )}
      {list.status === "error" && (
        <ErrorState onRetry={() => void dispatch(fetchAdminUsers(query))} />
      )}
      {list.status === "ready" && list.items.length === 0 && !hasFilter && (
        <EmptyState
          title="Пользователей пока нет"
          description="Зарегистрированные пользователи появятся здесь."
        />
      )}
      {list.status === "ready" && list.items.length === 0 && hasFilter && (
        <EmptyState
          title="Пользователи не найдены"
          description="Попробуйте изменить или очистить фильтры."
        />
      )}
      {list.status === "ready" && list.items.length > 0 && (
        <>
          <Table
            caption="Пользователи"
            columns={columns}
            rows={list.items}
            getRowKey={(user) => user.id}
          />
          <Pagination
            {...list.meta}
            onPageChange={(page) => updateQuery({ page }, true)}
            onPageSizeChange={(pageSize) => updateQuery({ pageSize })}
          />
        </>
      )}
    </section>
  );
}
