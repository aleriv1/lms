import type { CourseDetail, TestSummary } from "@lms/shared";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { FormError } from "../../api/formError";
import { Button, EmptyState, Modal, Table } from "../../components/ui";
import type { TableColumn } from "../../components/ui/Table/Table";
import { useAppDispatch } from "../../store/hooks";
import { deleteTest } from "./testsSlice";
import styles from "./TestList.module.css";

export type TestListProps = { course: CourseDetail };

function ActionError({ error }: { error: FormError }) {
  return (
    <div className={styles.error} role="alert">
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

const fallbackError: FormError = {
  code: "internal_error",
  message: "Произошла внутренняя ошибка",
};

export function TestList({ course }: TestListProps) {
  const dispatch = useAppDispatch();
  const [actionError, setActionError] = useState<FormError | null>(null);
  const [testToDelete, setTestToDelete] = useState<TestSummary | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const confirmDelete = async () => {
    if (!testToDelete || isActionLoading) {
      return;
    }

    setActionError(null);
    setIsActionLoading(true);
    const result = await dispatch(
      deleteTest({ courseId: course.id, testId: testToDelete.id }),
    );

    if (deleteTest.rejected.match(result)) {
      setActionError(result.payload ?? fallbackError);
      setIsActionLoading(false);
      return;
    }

    setTestToDelete(null);
    setIsActionLoading(false);
  };

  const columns: TableColumn<TestSummary>[] = [
    {
      key: "title",
      header: "Название",
      render: (test) => (
        <Link to={`/manage/tests/${test.id}/edit`}>{test.title}</Link>
      ),
    },
    {
      key: "lesson",
      header: "Связанный урок",
      render: (test) =>
        test.lessonId === null
          ? "Итоговый тест"
          : (course.lessons.find((lesson) => lesson.id === test.lessonId)
              ?.title ?? "Урок не найден"),
    },
    {
      key: "questions",
      header: "Вопросов",
      render: (test) => test.questionsCount,
    },
    {
      key: "score",
      header: "Проходной балл",
      render: (test) => `${test.passingScore}%`,
    },
    {
      key: "actions",
      header: "Действия",
      render: (test) => (
        <Button
          variant="danger"
          disabled={isActionLoading}
          onClick={() => {
            setActionError(null);
            setTestToDelete(test);
          }}
        >
          Удалить
        </Button>
      ),
    },
  ];

  return (
    <section>
      <h2>Тесты курса</h2>
      {actionError && !testToDelete && <ActionError error={actionError} />}
      {course.tests.length === 0 ? (
        <EmptyState
          title="Тестов пока нет"
          description="Добавьте первый тест курса."
          action={
            <Link to={`/manage/courses/${course.id}/tests/new`}>
              Добавить тест
            </Link>
          }
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <Link to={`/manage/courses/${course.id}/tests/new`}>
              Добавить тест
            </Link>
          </div>
          <Table
            caption="Тесты курса"
            columns={columns}
            rows={course.tests}
            getRowKey={(test) => test.id}
          />
        </>
      )}

      <Modal
        isOpen={testToDelete !== null}
        title="Удалить тест"
        onClose={() => {
          if (!isActionLoading) {
            setTestToDelete(null);
            setActionError(null);
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={isActionLoading}
              onClick={() => {
                setTestToDelete(null);
                setActionError(null);
              }}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              isLoading={isActionLoading}
              onClick={() => void confirmDelete()}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p>Удалить тест «{testToDelete?.title}»?</p>
        {actionError && <ActionError error={actionError} />}
      </Modal>
    </section>
  );
}
