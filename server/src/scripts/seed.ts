import "dotenv/config";

import mongoose from "mongoose";

import { hashPassword } from "../auth/password.js";
import { connectToDatabase } from "../db/connect.js";
import { Course } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson } from "../models/Lesson.js";
import { Test } from "../models/Test.js";
import { User } from "../models/User.js";

/**
 * The second teacher exists so that the refusal by course ownership (403 from
 * `loadOwnedCourse`) has something to refuse; the blocked student and the group
 * names exist so that the administrative filters and the "active user only"
 * rule of specification 4.3 can be told apart from doing nothing.
 */
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
] as const;

try {
  await connectToDatabase();

  for (const demoUser of DEMO_USERS) {
    const existingUser = await User.exists({ email: demoUser.email });
    if (existingUser) {
      console.info(`${demoUser.email}: already present`);
      continue;
    }

    await User.create({
      ...demoUser,
      passwordHash: await hashPassword("Password1"),
    });
    console.info(`${demoUser.email}: created`);
  }
  // Hand checks need something to open. Until the full demo set of
  // specification 12 arrives in slice 10, one course with one published and one
  // draft lesson is the minimum that makes the management screens reachable.
  const teacher = await User.findOne({ email: "teacher@lms.local" });
  if (!teacher) {
    throw new Error("teacher@lms.local is missing after seeding users");
  }

  const DEMO_COURSE_TITLE = "Вводный инструктаж по охране труда";
  let course = await Course.findOne({
    title: DEMO_COURSE_TITLE,
    authorId: teacher._id,
  });

  if (course) {
    console.info(`${DEMO_COURSE_TITLE}: already present`);
  } else {
    course = await Course.create({
      title: DEMO_COURSE_TITLE,
      category: "Безопасность",
      audience: "general",
      shortDescription: "Обязательный вводный курс для всех сотрудников.",
      description:
        "Порядок прохождения вводного инструктажа, права и обязанности работника.",
      authorId: teacher._id,
      status: "draft",
    });
    console.info(`${DEMO_COURSE_TITLE}: created`);
  }

  const DEMO_LESSONS = [
    {
      title: "Что такое вводный инструктаж",
      order: 1,
      content:
        "<p>Вводный инструктаж проходит каждый работник до начала работ.</p>",
      durationMinutes: 15,
      isRequired: true,
      status: "published" as const,
    },
    {
      title: "Средства индивидуальной защиты",
      order: 2,
      content: "<p>Перечень средств защиты и правила их применения.</p>",
      durationMinutes: 20,
      isRequired: true,
      status: "draft" as const,
    },
  ];

  for (const demoLesson of DEMO_LESSONS) {
    const existingLesson = await Lesson.exists({
      courseId: course._id,
      order: demoLesson.order,
    });
    if (existingLesson) {
      console.info(`${demoLesson.title}: already present`);
      continue;
    }

    await Lesson.create({
      ...demoLesson,
      courseId: course._id,
      videoUrl: null,
    });
    console.info(`${demoLesson.title}: created`);
  }

  // The test screens need something to open, the same reason the course above
  // exists. One test with both question types of specification 4.4; the full
  // demo set of specification 12 arrives in slice 10.
  const DEMO_TEST_TITLE = "Проверка знаний по вводному инструктажу";
  const publishedLesson = await Lesson.findOne({
    courseId: course._id,
    order: 1,
  });
  if (!publishedLesson) {
    throw new Error("the first demo lesson is missing after seeding lessons");
  }

  const existingTest = await Test.exists({
    courseId: course._id,
    title: DEMO_TEST_TITLE,
  });
  if (existingTest) {
    console.info(`${DEMO_TEST_TITLE}: already present`);
  } else {
    await Test.create({
      courseId: course._id,
      lessonId: publishedLesson._id,
      title: DEMO_TEST_TITLE,
      passingScore: 70,
      version: 1,
      questions: [
        {
          text: "Кто проходит вводный инструктаж?",
          type: "single",
          order: 1,
          options: [
            { text: "Каждый работник до начала работ", isCorrect: true },
            { text: "Только руководители подразделений", isCorrect: false },
            { text: "Никто, инструктаж добровольный", isCorrect: false },
          ],
        },
        {
          text: "Что относится к средствам индивидуальной защиты?",
          type: "multiple",
          order: 2,
          options: [
            { text: "Защитная каска", isCorrect: true },
            { text: "Защитные очки", isCorrect: true },
            { text: "Служебный автомобиль", isCorrect: false },
          ],
        },
      ],
    });
    console.info(`${DEMO_TEST_TITLE}: created`);
  }

  // Assigning needs a published course (specification 4.3), and the course
  // above has to stay a draft — the hand checklists of slices 03-05 stand on
  // it. So the published one belongs to the second teacher, which also gives
  // the ownership refusal something to refuse. It satisfies the conditions of
  // specification 4.2 for real: one published required lesson, not a status set
  // by hand.
  const secondTeacher = await User.findOne({ email: "teacher2@lms.local" });
  if (!secondTeacher) {
    throw new Error("teacher2@lms.local is missing after seeding users");
  }

  const PUBLISHED_COURSE_TITLE = "Правила технической эксплуатации";
  let publishedCourse = await Course.findOne({
    title: PUBLISHED_COURSE_TITLE,
    authorId: secondTeacher._id,
  });

  if (publishedCourse) {
    console.info(`${PUBLISHED_COURSE_TITLE}: already present`);
  } else {
    publishedCourse = await Course.create({
      title: PUBLISHED_COURSE_TITLE,
      category: "Эксплуатация",
      audience: "technical_staff",
      shortDescription:
        "Порядок технической эксплуатации оборудования и допуск к работам.",
      description:
        "Требования к содержанию оборудования, периодичность осмотров, порядок допуска.",
      authorId: secondTeacher._id,
      status: "published",
      publishedAt: new Date(),
    });
    console.info(`${PUBLISHED_COURSE_TITLE}: created`);
  }

  // The learning rules of specification 4.2 are invisible on a course of one
  // lesson: they need a sequence to walk, an optional lesson beside the
  // frontier, a draft the learner must not see, and a lesson closed by a test.
  // The test hangs on the *optional* lesson on purpose — the refusal
  // `lesson_test_required` can then be seen while the course itself stays
  // finishable before test attempts exist (slice 08).
  const PUBLISHED_COURSE_LESSONS = [
    {
      title: "Допуск к работам на оборудовании",
      order: 1,
      content: "<p>Кто и на каком основании допускается к работам.</p>",
      durationMinutes: 25,
      isRequired: true,
      status: "published" as const,
    },
    {
      title: "Журнал осмотров: как заполнять",
      order: 2,
      content: "<p>Порядок записи результатов осмотра оборудования.</p>",
      durationMinutes: 10,
      isRequired: false,
      status: "published" as const,
    },
    {
      title: "Периодичность осмотров",
      order: 3,
      content: "<p>Сроки и объем периодических осмотров.</p>",
      durationMinutes: 20,
      isRequired: true,
      status: "published" as const,
    },
    {
      title: "Внеплановые работы",
      order: 4,
      content: "<p>Порядок допуска при внеплановых работах.</p>",
      durationMinutes: 15,
      isRequired: true,
      status: "draft" as const,
    },
  ];

  for (const demoLesson of PUBLISHED_COURSE_LESSONS) {
    const existingLesson = await Lesson.exists({
      courseId: publishedCourse._id,
      order: demoLesson.order,
    });
    if (existingLesson) {
      console.info(`${demoLesson.title}: already present`);
      continue;
    }

    await Lesson.create({
      ...demoLesson,
      courseId: publishedCourse._id,
      videoUrl: null,
    });
    console.info(`${demoLesson.title}: created`);
  }

  const OPTIONAL_LESSON_TEST_TITLE = "Проверка: заполнение журнала осмотров";
  const optionalLesson = await Lesson.findOne({
    courseId: publishedCourse._id,
    order: 2,
  });
  if (!optionalLesson) {
    throw new Error(
      "the optional demo lesson is missing after seeding lessons",
    );
  }

  const existingLessonTest = await Test.exists({
    lessonId: optionalLesson._id,
  });
  if (existingLessonTest) {
    console.info(`${OPTIONAL_LESSON_TEST_TITLE}: already present`);
  } else {
    await Test.create({
      courseId: publishedCourse._id,
      lessonId: optionalLesson._id,
      title: OPTIONAL_LESSON_TEST_TITLE,
      passingScore: 70,
      version: 1,
      questions: [
        {
          text: "Когда заполняется журнал осмотров?",
          type: "single",
          order: 1,
          options: [
            { text: "Сразу после осмотра", isCorrect: true },
            { text: "В конце месяца", isCorrect: false },
          ],
        },
      ],
    });
    console.info(`${OPTIONAL_LESSON_TEST_TITLE}: created`);
  }

  // A second published course, named by specification 12, gives the learning
  // overview more than one card to average and gives the course page a final
  // test to show. That course cannot be finished until attempts exist.
  const DISPATCH_COURSE_TITLE = "Работа с диспетчерской системой";
  let dispatchCourse = await Course.findOne({
    title: DISPATCH_COURSE_TITLE,
    authorId: secondTeacher._id,
  });

  if (dispatchCourse) {
    console.info(`${DISPATCH_COURSE_TITLE}: already present`);
  } else {
    dispatchCourse = await Course.create({
      title: DISPATCH_COURSE_TITLE,
      category: "Эксплуатация",
      audience: "dispatchers",
      shortDescription:
        "Прием смены, ведение оперативного журнала и порядок связи.",
      description:
        "Основные операции диспетчера: прием и сдача смены, оперативный журнал, связь со службами.",
      authorId: secondTeacher._id,
      status: "published",
      publishedAt: new Date(),
    });
    console.info(`${DISPATCH_COURSE_TITLE}: created`);
  }

  const DISPATCH_LESSON_TITLE = "Прием и сдача смены";
  const existingDispatchLesson = await Lesson.exists({
    courseId: dispatchCourse._id,
    order: 1,
  });
  if (existingDispatchLesson) {
    console.info(`${DISPATCH_LESSON_TITLE}: already present`);
  } else {
    await Lesson.create({
      courseId: dispatchCourse._id,
      title: DISPATCH_LESSON_TITLE,
      order: 1,
      content: "<p>Порядок приема смены и обязательные записи в журнале.</p>",
      durationMinutes: 30,
      isRequired: true,
      status: "published",
      videoUrl: null,
    });
    console.info(`${DISPATCH_LESSON_TITLE}: created`);
  }

  const DISPATCH_FINAL_TEST_TITLE = "Итоговый тест по диспетчерской системе";
  const existingFinalTest = await Test.exists({
    courseId: dispatchCourse._id,
    lessonId: null,
  });
  if (existingFinalTest) {
    console.info(`${DISPATCH_FINAL_TEST_TITLE}: already present`);
  } else {
    await Test.create({
      courseId: dispatchCourse._id,
      lessonId: null,
      title: DISPATCH_FINAL_TEST_TITLE,
      passingScore: 70,
      version: 1,
      questions: [
        {
          text: "Что делается при приеме смены в первую очередь?",
          type: "single",
          order: 1,
          options: [
            { text: "Осмотр оборудования и запись в журнал", isCorrect: true },
            { text: "Отчет руководителю в конце дня", isCorrect: false },
          ],
        },
      ],
    });
    console.info(`${DISPATCH_FINAL_TEST_TITLE}: created`);
  }

  // Without an assignment the learning section is empty, and making one by hand
  // through the API is exactly what AGENTS.md (9) forbids.
  const admin = await User.findOne({ email: "admin@lms.local" });
  const student = await User.findOne({ email: "student@lms.local" });
  if (!admin || !student) {
    throw new Error("the demo administrator or student is missing");
  }

  for (const assignedCourse of [publishedCourse, dispatchCourse]) {
    const existingAssignment = await CourseAssignment.exists({
      userId: student._id,
      courseId: assignedCourse._id,
    });
    if (existingAssignment) {
      console.info(`${assignedCourse.title}: already assigned to the student`);
      continue;
    }

    await CourseAssignment.create({
      userId: student._id,
      courseId: assignedCourse._id,
      assignedBy: admin._id,
      status: "active",
      assignedAt: new Date(),
    });
    console.info(`${assignedCourse.title}: assigned to the student`);
  }
} catch (error) {
  console.error("Failed to seed demo data", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
