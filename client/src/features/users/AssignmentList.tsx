import type { Assignment } from "@lms/shared";
import { useState } from "react";

import { toFormError, type FormError } from "../../api/formError";
import { Button, EmptyState, Modal, Table } from "../../components/ui";
import type { TableColumn } from "../../components/ui/Table/Table";
import { useAppDispatch } from "../../store/hooks";
import { COURSE_STATUS_LABELS } from "../courses/courseLabels";
import { revokeAssignment } from "./adminUsersSlice";
import { ASSIGNMENT_STATUS_LABELS, formatDateTime } from "./userFormat";
import styles from "./AssignmentList.module.css";

type AssignmentListProps = {
  userId: string;
  assignments: Assignment[];
};

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

export function AssignmentList({ userId, assignments }: AssignmentListProps) {
  const dispatch = useAppDispatch();
  const [confirmation, setConfirmation] = useState<Assignment | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<FormError | null>(null);

  const confirmRevoke = async () => {
    if (!confirmation || isActionLoading) return;
    setActionError(null);
    setIsActionLoading(true);
    const result = await dispatch(
      revokeAssignment({ userId, assignmentId: confirmation.id }),
    );
    setIsActionLoading(false);

    if (revokeAssignment.rejected.match(result)) {
      setActionError(result.payload ?? toFormError(result.error));
      return;
    }
    setConfirmation(null);
  };

  const columns: TableColumn<Assignment>[] = [
    { key: "course", header: "Курс", render: (item) => item.course.title },
    {
      key: "courseStatus",
      header: "Статус курса",
      render: (item) => COURSE_STATUS_LABELS[item.course.status],
    },
    {
      key: "status",
      header: "Статус назначения",
      render: (item) => ASSIGNMENT_STATUS_LABELS[item.status],
    },
    {
      key: "assignedBy",
      header: "Кто назначил",
      render: (item) => item.assignedBy.name,
    },
    {
      key: "assignedAt",
      header: "Назначен",
      render: (item) => formatDateTime(item.assignedAt),
    },
    {
      key: "revokedAt",
      header: "Снят",
      render: (item) => (item.revokedAt ? formatDateTime(item.revokedAt) : "—"),
    },
    {
      key: "progress",
      header: "Прогресс",
      render: (item) => `${item.progressPercent}%`,
    },
    {
      key: "actions",
      header: "Действия",
      render: (item) =>
        item.status === "active" ? (
          <Button
            variant="ghost"
            disabled={isActionLoading}
            onClick={() => {
              setActionError(null);
              setConfirmation(item);
            }}
          >
            Снять
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      {assignments.length === 0 ? (
        <EmptyState
          title="Назначений пока нет"
          description="Выберите опубликованный курс в форме назначения."
        />
      ) : (
        <Table
          caption="Назначения пользователя"
          columns={columns}
          rows={assignments}
          getRowKey={(item) => item.id}
        />
      )}
      <Modal
        isOpen={confirmation !== null}
        title="Снять назначение"
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
              variant="danger"
              isLoading={isActionLoading}
              onClick={() => void confirmRevoke()}
            >
              Снять
            </Button>
          </>
        }
      >
        <p>
          Снять назначение курса «{confirmation?.course.title}»? История и
          прогресс сохранятся.
        </p>
        {actionError && <ActionError error={actionError} />}
      </Modal>
    </>
  );
}
