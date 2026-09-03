import "dotenv/config";

import mongoose from "mongoose";

import { hashPassword } from "../auth/password.js";
import { connectToDatabase } from "../db/connect.js";
import {
  buildQuestionsSnapshot,
  gradeAttempt,
} from "../learning/attemptScoring.js";
import { sanitizeLessonContent } from "../lessons/sanitizeContent.js";
import { Course, type CourseDocument } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson, type LessonDocument } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { Test, type TestDocument } from "../models/Test.js";
import { TestAttempt } from "../models/TestAttempt.js";
import { User, type UserDocument } from "../models/User.js";

const DEMO_USERS = [
  {
    email: "admin@lms.local",
    name: "Администратор Системы",
    role: "admin",
    groupName: null,
    status: "active",
  },
  {
    email: "teacher@lms.local",
    name: "Преподаватель Иванов",
    role: "teacher",
    groupName: null,
    status: "active",
  },
  {
    email: "teacher2@lms.local",
    name: "Преподаватель Сидорова",
    role: "teacher",
    groupName: null,
    status: "active",
  },
  {
    email: "student@lms.local",
    name: "Обучающийся Петров",
    role: "student",
    groupName: "Смена А",
    status: "active",
  },
  {
    email: "student2@lms.local",
    name: "Обучающаяся Кузнецова",
    role: "student",
    groupName: "Смена Б",
    status: "active",
  },
  {
    email: "blocked@lms.local",
    name: "Заблокированный Смирнов",
    role: "student",
    groupName: "Смена Б",
    status: "blocked",
  },
  {
    email: "student3@lms.local",
    name: "Обучающийся Орлов",
    role: "student",
    groupName: "Смена А",
    status: "active",
  },
  {
    email: "student4@lms.local",
    name: "Обучающаяся Волкова",
    role: "student",
    groupName: "Смена А",
    status: "active",
  },
  {
    email: "student5@lms.local",
    name: "Обучающийся Соколов",
    role: "student",
    groupName: "Смена А",
    status: "active",
  },
  {
    email: "student6@lms.local",
    name: "Обучающаяся Морозова",
    role: "student",
    groupName: "Смена А",
    status: "active",
  },
  {
    email: "student7@lms.local",
    name: "Обучающийся Новиков",
    role: "student",
    groupName: "Смена В",
    status: "active",
  },
  {
    email: "archived@lms.local",
    name: "Архивный Федоров",
    role: "student",
    groupName: null,
    status: "archived",
  },
] as const;

const DEMO_COURSES = [
  {
    key: "safety",
    title: "Вводный инструктаж по охране труда",
    author: "teacher@lms.local",
    category: "Безопасность",
    audience: "general",
    status: "published",
    shortDescription: "Обязательный вводный курс для всех сотрудников.",
    description:
      "Порядок прохождения вводного инструктажа, права и обязанности работника.",
    lessons: [
      {
        title: "Что такое вводный инструктаж",
        durationMinutes: 15,
        content:
          "Вводный инструктаж проходит каждый работник до начала работ. Руководитель фиксирует прохождение в журнале инструктажей.",
      },
      {
        title: "Средства индивидуальной защиты",
        durationMinutes: 20,
        content:
          "Защитная каска и защитные очки относятся к средствам индивидуальной защиты. Перед работой сотрудник проверяет их исправность.",
      },
      {
        title: "Действия при обнаружении опасности",
        durationMinutes: 15,
        content:
          "При обнаружении опасности прекратите работу и сообщите руководителю. Не возобновляйте работу до устранения опасности.",
      },
      {
        title: "Порядок эвакуации",
        durationMinutes: 20,
        content:
          "При сигнале тревоги следуйте по обозначенному пути к месту сбора. Сообщите ответственному о своем прибытии.",
      },
      {
        title: "Проверка готовности к безопасной работе",
        durationMinutes: 10,
        content:
          "Перед началом смены проверьте рабочее место и средства индивидуальной защиты. Для защиты головы и глаз используйте защитную каску и защитные очки.",
      },
    ],
  },
  {
    key: "technical",
    title: "Правила технической эксплуатации",
    author: "teacher2@lms.local",
    category: "Эксплуатация",
    audience: "technical_staff",
    status: "published",
    shortDescription:
      "Порядок технической эксплуатации оборудования и допуск к работам.",
    description:
      "Требования к содержанию оборудования, периодичность осмотров, порядок допуска.",
    lessons: [
      {
        title: "Допуск к работам на оборудовании",
        durationMinutes: 25,
        content:
          "К работам допускается сотрудник, прошедший инструктаж и проверку знаний. Перед началом работ проверьте оформление допуска.",
      },
      {
        title: "Журнал осмотров: как заполнять",
        durationMinutes: 10,
        content:
          "Записывайте результаты сразу после осмотра. Укажите время, выявленные неисправности и принятые меры.",
      },
      {
        title: "Периодичность осмотров",
        durationMinutes: 20,
        content:
          "Осматривайте оборудование по утвержденному графику. Обнаруженную неисправность передайте ответственному руководителю.",
      },
    ],
  },
  {
    key: "dispatch",
    title: "Работа с диспетчерской системой",
    author: "teacher2@lms.local",
    category: "Эксплуатация",
    audience: "dispatchers",
    status: "published",
    shortDescription:
      "Прием смены, ведение оперативного журнала и порядок связи.",
    description:
      "Основные операции диспетчера: прием и сдача смены, оперативный журнал, связь со службами.",
    lessons: [
      {
        title: "Прием и сдача смены",
        durationMinutes: 30,
        content:
          "При приеме смены ознакомьтесь с состоянием оборудования и записями оперативного журнала. Зафиксируйте прием смены.",
      },
      {
        title: "Передача оперативного сообщения",
        durationMinutes: 20,
        content:
          "Назовите объект, время события и необходимые действия. Повторите принятое сообщение и внесите запись в журнал.",
      },
    ],
  },
  {
    key: "draft",
    title: "Подготовка к сезонному осмотру",
    author: "teacher@lms.local",
    category: "Эксплуатация",
    audience: "technical_staff",
    status: "draft",
    shortDescription: "Проект программы подготовки оборудования к сезону.",
    description: "Материалы для согласования с ответственным за эксплуатацию.",
    lessons: [
      {
        title: "Составление плана осмотра",
        durationMinutes: 15,
        content:
          "Составьте перечень оборудования и согласуйте сроки осмотра с руководителем.",
      },
      {
        title: "Подготовка документации",
        durationMinutes: 10,
        content:
          "Подготовьте журнал и действующие инструкции для каждого объекта.",
      },
    ],
  },
  {
    key: "archive",
    title: "Порядок передачи смены — архивная редакция",
    author: "teacher2@lms.local",
    category: "Эксплуатация",
    audience: "general",
    status: "archived",
    shortDescription: "Предыдущая редакция порядка передачи смены.",
    description:
      "Исторические материалы; новые попытки тестирования недоступны.",
    lessons: [
      {
        title: "Проверка сменного журнала",
        durationMinutes: 15,
        content:
          "При передаче смены ознакомьте принимающего сотрудника с записями сменного журнала.",
      },
      {
        title: "Подтверждение передачи смены",
        durationMinutes: 10,
        content:
          "Передачу смены подтверждают оба сотрудника записью в журнале.",
      },
    ],
  },
] as const;

const DEMO_TESTS = [
  {
    key: "safety-single",
    course: "safety",
    lessonOrder: 3,
    title: "Проверка знаний по вводному инструктажу",
    type: "single",
    text: "Что следует сделать при обнаружении опасности?",
    options: [
      { text: "Прекратить работу и сообщить руководителю", isCorrect: true },
      { text: "Продолжить работу до конца смены", isCorrect: false },
      { text: "Сообщить только при следующем инструктаже", isCorrect: false },
    ],
  },
  {
    key: "safety-multiple",
    course: "safety",
    lessonOrder: 5,
    title: "Проверка средств индивидуальной защиты",
    type: "multiple",
    text: "Какие два средства защищают голову и глаза работника?",
    options: [
      { text: "Защитная каска", isCorrect: true },
      { text: "Защитные очки", isCorrect: true },
      { text: "Служебный автомобиль", isCorrect: false },
    ],
  },
  {
    key: "technical-final",
    course: "technical",
    lessonOrder: null,
    title: "Итоговый тест по технической эксплуатации",
    type: "single",
    text: "Когда заполняется журнал осмотров?",
    options: [
      { text: "Сразу после осмотра", isCorrect: true },
      { text: "В конце месяца", isCorrect: false },
    ],
  },
  {
    key: "archive-final",
    course: "archive",
    lessonOrder: null,
    title: "Проверка передачи смены — архивная редакция",
    type: "single",
    text: "Кто подтверждает передачу смены?",
    options: [
      { text: "Оба сотрудника записью в журнале", isCorrect: true },
      { text: "Только принимающий сотрудник устно", isCorrect: false },
    ],
  },
] as const;

const DEMO_ASSIGNMENTS = [
  {
    email: "student@lms.local",
    course: "safety",
    status: "completed",
    completedLessons: 5,
    firstCompletionDaysAgo: 19,
  },
  {
    email: "student@lms.local",
    course: "technical",
    status: "active",
    completedLessons: 1,
    firstCompletionDaysAgo: 4,
  },
  {
    email: "student@lms.local",
    course: "archive",
    status: "active",
    completedLessons: 0,
    firstCompletionDaysAgo: 20,
  },
  {
    email: "student2@lms.local",
    course: "safety",
    status: "revoked",
    completedLessons: 2,
    firstCompletionDaysAgo: 20,
  },
  {
    email: "student3@lms.local",
    course: "safety",
    status: "active",
    completedLessons: 0,
    firstCompletionDaysAgo: 12,
  },
  {
    email: "student4@lms.local",
    course: "safety",
    status: "active",
    completedLessons: 1,
    firstCompletionDaysAgo: 10,
  },
  {
    email: "student5@lms.local",
    course: "safety",
    status: "active",
    completedLessons: 2,
    firstCompletionDaysAgo: 7,
  },
  {
    email: "student6@lms.local",
    course: "safety",
    status: "completed",
    completedLessons: 5,
    firstCompletionDaysAgo: 6,
  },
] as const;

const DEMO_ATTEMPTS = [
  {
    email: "student@lms.local",
    test: "safety-single",
    attemptNumber: 1,
    correct: false,
    daysAgo: 18,
  },
  {
    email: "student@lms.local",
    test: "safety-single",
    attemptNumber: 2,
    correct: true,
    daysAgo: 17,
  },
  {
    email: "student@lms.local",
    test: "safety-single",
    attemptNumber: 3,
    correct: false,
    daysAgo: 14,
  },
  {
    email: "student@lms.local",
    test: "safety-multiple",
    attemptNumber: 1,
    correct: true,
    daysAgo: 15,
  },
  {
    email: "student6@lms.local",
    test: "safety-single",
    attemptNumber: 1,
    correct: true,
    daysAgo: 4,
  },
  {
    email: "student6@lms.local",
    test: "safety-multiple",
    attemptNumber: 1,
    correct: true,
    daysAgo: 2,
  },
] as const;

const now = Date.now();
function daysAgo(days: number): Date {
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

let skipped = false;
function logEntity(label: string, existing: boolean): void {
  skipped ||= existing;
  console.info(`${label}: ${existing ? "already present" : "created"}`);
}

try {
  const reset = process.argv.includes("--reset");
  if (reset && process.env.NODE_ENV === "production") {
    throw new Error("seed:reset запрещен при NODE_ENV=production");
  }

  await connectToDatabase();

  if (reset) {
    console.info(
      `seed:reset: очищается база ${mongoose.connection.name} (семь коллекций демоданных)`,
    );
    await TestAttempt.deleteMany({});
    await LessonProgress.deleteMany({});
    await CourseAssignment.deleteMany({});
    await Test.deleteMany({});
    await Lesson.deleteMany({});
    await Course.deleteMany({});
    await User.deleteMany({});
  }

  const users = new Map<string, UserDocument>();
  for (const demo of DEMO_USERS) {
    let user = await User.findOne({ email: demo.email });
    const existing = Boolean(user);
    if (!user) {
      user = await User.create({
        ...demo,
        passwordHash: await hashPassword("Password1"),
      });
    }
    users.set(demo.email, user);
    logEntity(demo.email, existing);
  }

  const courses = new Map<string, CourseDocument>();
  const lessons = new Map<string, LessonDocument>();
  for (const demo of DEMO_COURSES) {
    const author = users.get(demo.author);
    if (!author) throw new Error(`Demo author missing: ${demo.author}`);
    let course = await Course.findOne({
      title: demo.title,
      authorId: author._id,
    });
    const existing = Boolean(course);
    if (!course) {
      course = await Course.create({
        title: demo.title,
        category: demo.category,
        audience: demo.audience,
        shortDescription: demo.shortDescription,
        description: demo.description,
        authorId: author._id,
        status: demo.status,
        publishedAt: demo.status === "draft" ? null : daysAgo(21),
      });
    }
    courses.set(demo.key, course);
    logEntity(demo.title, existing);

    for (const [index, item] of demo.lessons.entries()) {
      const order = index + 1;
      let lesson = await Lesson.findOne({ courseId: course._id, order });
      const lessonExists = Boolean(lesson);
      if (!lesson) {
        lesson = await Lesson.create({
          courseId: course._id,
          title: item.title,
          order,
          durationMinutes: item.durationMinutes,
          content: sanitizeLessonContent(`<p>${item.content}</p>`),
          status: demo.status === "draft" ? "draft" : "published",
          isRequired: true,
          videoUrl: null,
        });
      }
      lessons.set(`${demo.key}:${order}`, lesson);
      logEntity(`${demo.title} / ${item.title}`, lessonExists);
    }
  }

  const tests = new Map<string, TestDocument>();
  for (const demo of DEMO_TESTS) {
    const course = courses.get(demo.course);
    const lesson =
      demo.lessonOrder === null
        ? null
        : lessons.get(`${demo.course}:${demo.lessonOrder}`);
    if (!course || lesson === undefined)
      throw new Error(`Demo test parent missing: ${demo.key}`);
    // Match the old seed by title as well as the unique lesson slot. Existing
    // content is never moved or rewritten; reset is the explicit upgrade path.
    const slots =
      demo.lessonOrder === null
        ? [{ title: demo.title }, { lessonId: null }]
        : [{ title: demo.title }, { lessonId: lesson?._id }];
    let test = await Test.findOne({ courseId: course._id, $or: slots });
    const existing = Boolean(test);
    if (!test) {
      test = await Test.create({
        courseId: course._id,
        lessonId: lesson?._id ?? null,
        title: demo.title,
        passingScore: 70,
        version: 1,
        questions: [
          { text: demo.text, type: demo.type, order: 1, options: demo.options },
        ],
      });
    }
    tests.set(demo.key, test);
    logEntity(demo.title, existing);
  }

  const admin = users.get("admin@lms.local");
  if (!admin) throw new Error("Demo administrator missing");

  for (const demo of DEMO_ASSIGNMENTS) {
    const user = users.get(demo.email);
    const course = courses.get(demo.course);
    if (!user || !course)
      throw new Error(`Demo assignment parent missing: ${demo.email}`);
    const existing = await CourseAssignment.exists({
      userId: user._id,
      courseId: course._id,
    });
    if (!existing) {
      await CourseAssignment.create({
        userId: user._id,
        courseId: course._id,
        assignedBy: admin._id,
        status: demo.status,
        assignedAt: daysAgo(21),
        revokedAt: demo.status === "revoked" ? daysAgo(18) : null,
        completedAt:
          demo.status === "completed"
            ? daysAgo(demo.firstCompletionDaysAgo - demo.completedLessons + 1)
            : null,
      });
    }
    logEntity(
      `${demo.email} / ${course.title} / assignment`,
      Boolean(existing),
    );

    for (let order = 1; order <= demo.completedLessons; order += 1) {
      const lesson = lessons.get(`${demo.course}:${order}`);
      if (!lesson)
        throw new Error(`Demo lesson missing: ${demo.course}:${order}`);
      const progressExists = await LessonProgress.exists({
        userId: user._id,
        lessonId: lesson._id,
      });
      if (!progressExists) {
        const completedAt = daysAgo(demo.firstCompletionDaysAgo - order + 1);
        const startedAt = new Date(
          completedAt.getTime() - lesson.durationMinutes * 60 * 1000,
        );
        const progress = new LessonProgress({
          userId: user._id,
          courseId: course._id,
          lessonId: lesson._id,
          status: "completed",
          startedAt,
          completedAt,
          createdAt: startedAt,
          updatedAt: completedAt,
        });
        // Activity readers use updatedAt: keep the historical action time
        // rather than replacing it with the time the seed was run.
        await progress.save({ timestamps: false });
      }
      logEntity(
        `${demo.email} / ${lesson.title} / progress`,
        Boolean(progressExists),
      );
    }
  }

  for (const demo of DEMO_ATTEMPTS) {
    const user = users.get(demo.email);
    const test = tests.get(demo.test);
    if (!user || !test)
      throw new Error(`Demo attempt parent missing: ${demo.test}`);
    const existing = await TestAttempt.exists({
      userId: user._id,
      testId: test._id,
      attemptNumber: demo.attemptNumber,
    });
    if (!existing) {
      const questionsSnapshot = buildQuestionsSnapshot(test.questions);
      const answers = questionsSnapshot.map((question) => ({
        questionId: question.questionId,
        optionIds: question.options
          .filter((option) =>
            demo.correct ? option.isCorrect : !option.isCorrect,
          )
          .map((option) => option.optionId)
          .slice(0, question.type === "single" ? 1 : undefined),
      }));
      const graded = gradeAttempt(
        questionsSnapshot,
        answers,
        test.passingScore,
      );
      const submittedAt = daysAgo(demo.daysAgo);
      const attempt = new TestAttempt({
        userId: user._id,
        testId: test._id,
        courseId: test.courseId,
        lessonId: test.lessonId,
        testVersion: test.version,
        questionsSnapshot,
        ...graded,
        attemptNumber: demo.attemptNumber,
        submittedAt,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      });
      await attempt.save({ timestamps: false });
    }
    logEntity(
      `${demo.email} / ${test.title} / attempt ${demo.attemptNumber}`,
      Boolean(existing),
    );
  }

  console.info(
    skipped
      ? "Внимание: существующая база не обновляется; для актуального демонабора выполните npm run seed:reset (удаляет данные)."
      : "Демонабор создан: 12 пользователей, 5 курсов, 14 уроков, 4 теста, 8 назначений, 16 записей прогресса, 6 попыток.",
  );
} catch (error) {
  console.error("Failed to seed demo data", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
