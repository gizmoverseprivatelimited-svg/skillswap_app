import { useCallback, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { mockUsers, mockClasses, mockEnrollments } from '../mocks/data';
import type { GroupClass, ClassEnrollment, ClassWithTeacher, ClassStatus, SkillCategory, SkillLevel } from '../types';
import { useCurrentUser } from './current-user';
import { useEarnings } from './earnings';
import { useNotifications } from './notifications';
import { getClassEnrollmentCost, getClassTeacherEarnings } from '../lib/payments';

interface CreateClassInput {
  title: string;
  description: string;
  category: SkillCategory;
  level: SkillLevel;
  coverImageUrl: string;
  startISO: string;
  endISO: string;
  maxCapacity: number;
  seatPriceCredits: number;
}

interface ClassesContextValue {
  classes: GroupClass[];
  enrollments: ClassEnrollment[];
  openClasses: GroupClass[];
  getClassesWithTeachers: () => ClassWithTeacher[];
  getClassById: (id: string) => ClassWithTeacher | undefined;
  getMyTeachingClasses: () => ClassWithTeacher[];
  getMyEnrolledClasses: () => ClassWithTeacher[];
  getEnrollmentsForClass: (classId: string) => ClassEnrollment[];
  isEnrolled: (classId: string, studentId: string) => boolean;
  createClass: (input: CreateClassInput) => GroupClass;
  enrollInClass: (classId: string) => { success: boolean; error?: string };
  cancelEnrollment: (classId: string) => void;
  completeClass: (classId: string) => void;
  cancelClass: (classId: string) => void;
}

const generateId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const [ClassesProvider, useClasses] = createContextHook<ClassesContextValue>(() => {
  const { currentUser, allUsers, spendCredits, earnCredits } = useCurrentUser();
  const { processClassPayment, awardPoints } = useEarnings();
  const { addNotification } = useNotifications();

  const [classes, setClasses] = useState<GroupClass[]>(() => mockClasses.map(c => ({ ...c })));
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>(() => mockEnrollments.map(e => ({ ...e })));

  const activeEnrollments = useCallback(
    (classId: string) => enrollments.filter(e => e.classId === classId && e.status === 'enrolled'),
    [enrollments],
  );

  const getEnrollmentsForClass = useCallback(
    (classId: string) => enrollments.filter(e => e.classId === classId),
    [enrollments],
  );

  const isEnrolled = useCallback(
    (classId: string, studentId: string) =>
      enrollments.some(e => e.classId === classId && e.studentId === studentId && e.status === 'enrolled'),
    [enrollments],
  );

  const buildClassWithTeacher = useCallback(
    (cls: GroupClass): ClassWithTeacher => {
      const teacher = allUsers.find(u => u.id === cls.teacherId) ?? currentUser;
      const clsEnrollments = enrollments.filter(e => e.classId === cls.id && e.status === 'enrolled');
      return { ...cls, teacher, enrolledCount: clsEnrollments.length, enrollments: clsEnrollments };
    },
    [allUsers, currentUser, enrollments],
  );

  const getClassesWithTeachers = useCallback((): ClassWithTeacher[] => {
    return classes.map(buildClassWithTeacher);
  }, [classes, buildClassWithTeacher]);

  const getClassById = useCallback(
    (id: string): ClassWithTeacher | undefined => {
      const cls = classes.find(c => c.id === id);
      return cls ? buildClassWithTeacher(cls) : undefined;
    },
    [classes, buildClassWithTeacher],
  );

  const getMyTeachingClasses = useCallback((): ClassWithTeacher[] => {
    return classes.filter(c => c.teacherId === currentUser.id).map(buildClassWithTeacher);
  }, [classes, currentUser.id, buildClassWithTeacher]);

  const getMyEnrolledClasses = useCallback((): ClassWithTeacher[] => {
    const myEnrollmentClassIds = enrollments
      .filter(e => e.studentId === currentUser.id && e.status !== 'cancelled')
      .map(e => e.classId);
    return classes
      .filter(c => myEnrollmentClassIds.includes(c.id))
      .map(buildClassWithTeacher);
  }, [classes, enrollments, currentUser.id, buildClassWithTeacher]);

  const openClasses = useMemo(() => classes.filter(c => c.status === 'open'), [classes]);

  const createClass = useCallback((input: CreateClassInput): GroupClass => {
    const cls: GroupClass = {
      id: generateId('cls'),
      teacherId: currentUser.id,
      title: input.title,
      description: input.description,
      category: input.category,
      level: input.level,
      coverImageUrl: input.coverImageUrl,
      startISO: input.startISO,
      endISO: input.endISO,
      maxCapacity: input.maxCapacity,
      seatPriceCredits: input.seatPriceCredits,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    setClasses(prev => [cls, ...prev]);
    addNotification({
      title: 'Class created',
      body: `Your class "${input.title}" is now live and accepting enrollments.`,
      category: 'class',
    });
    return cls;
  }, [currentUser.id, addNotification]);

  const enrollInClass = useCallback((classId: string): { success: boolean; error?: string } => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return { success: false, error: 'Class not found' };
    if (cls.status !== 'open') return { success: false, error: 'Class is no longer open' };

    if (isEnrolled(classId, currentUser.id)) {
      return { success: false, error: 'You are already enrolled' };
    }

    const enrolledCount = activeEnrollments(classId).length;
    if (enrolledCount >= cls.maxCapacity) {
      return { success: false, error: 'Class is full' };
    }

    const cost = getClassEnrollmentCost(cls.seatPriceCredits);
    if (cost > 0) {
      const ok = spendCredits(cost);
      if (!ok) return { success: false, error: 'Not enough credits' };
    }

    const enr: ClassEnrollment = {
      id: generateId('enr'),
      classId,
      studentId: currentUser.id,
      enrolledAt: new Date().toISOString(),
      status: 'enrolled',
    };
    setEnrollments(prev => [...prev, enr]);

    // Record payment transaction
    if (cost > 0) {
      awardPoints({
        userId: currentUser.id,
        amount: -cost,
        source: 'class_taught',
        description: `Enrolled in "${cls.title}"`,
      });
    }

    // Notify teacher
    const teacherName = currentUser.name;
    addNotification({
      title: 'New enrollment',
      body: `${teacherName} enrolled in your class "${cls.title}"`,
      category: 'class',
    });

    return { success: true };
  }, [classes, isEnrolled, currentUser.id, currentUser.name, activeEnrollments, spendCredits, awardPoints, addNotification]);

  const cancelEnrollment = useCallback((classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    setEnrollments(prev =>
      prev.map(e =>
        e.classId === classId && e.studentId === currentUser.id && e.status === 'enrolled'
          ? { ...e, status: 'cancelled' as const }
          : e,
      ),
    );

    // Refund credits
    const cost = getClassEnrollmentCost(cls.seatPriceCredits);
    if (cost > 0) {
      earnCredits(cost);
    }

    addNotification({
      title: 'Enrollment cancelled',
      body: `You cancelled enrollment in "${cls.title}". ${cost > 0 ? `${cost} credits refunded.` : ''}`,
      category: 'class',
    });
  }, [classes, currentUser.id, earnCredits, addNotification]);

  const completeClass = useCallback((classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls || cls.status !== 'open') return;

    const active = activeEnrollments(classId);
    const enrolledCount = active.length;

    setClasses(prev =>
      prev.map(c => c.id === classId ? { ...c, status: 'completed' as ClassStatus } : c),
    );
    setEnrollments(prev =>
      prev.map(e =>
        e.classId === classId && e.status === 'enrolled'
          ? { ...e, status: 'attended' as const }
          : e,
      ),
    );

    // Process teacher earnings
    const teacherEarned = getClassTeacherEarnings(cls.seatPriceCredits, enrolledCount);
    if (cls.teacherId === currentUser.id) {
      earnCredits(teacherEarned);
    }

    // Record teacher earning transaction
    awardPoints({
      userId: cls.teacherId,
      amount: teacherEarned,
      source: 'class_taught',
      description: `Taught group class "${cls.title}" — ${enrolledCount} student${enrolledCount === 1 ? '' : 's'}`,
    });

    // Award learner bonus to each enrolled student
    active.forEach(enr => {
      awardPoints({
        userId: enr.studentId,
        amount: 10,
        source: 'learner_bonus',
        description: `Completed group class "${cls.title}"`,
      });
      if (enr.studentId === currentUser.id) {
        earnCredits(10);
      }
    });

    addNotification({
      title: 'Class completed',
      body: `"${cls.title}" marked complete. ${enrolledCount} student${enrolledCount === 1 ? '' : 's'} attended. You earned ${teacherEarned} credits.`,
      category: 'class',
    });
  }, [classes, activeEnrollments, currentUser.id, earnCredits, awardPoints, addNotification]);

  const cancelClass = useCallback((classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls || cls.status !== 'open') return;

    const active = activeEnrollments(classId);

    setClasses(prev =>
      prev.map(c => c.id === classId ? { ...c, status: 'cancelled' as ClassStatus } : c),
    );
    setEnrollments(prev =>
      prev.map(e =>
        e.classId === classId && e.status === 'enrolled'
          ? { ...e, status: 'cancelled' as const }
          : e,
      ),
    );

    // Refund all enrolled students
    const cost = getClassEnrollmentCost(cls.seatPriceCredits);
    active.forEach(enr => {
      if (enr.studentId === currentUser.id && cost > 0) {
        earnCredits(cost);
      }
      awardPoints({
        userId: enr.studentId,
        amount: cost > 0 ? -cost : 0,
        source: 'class_taught',
        description: `Class "${cls.title}" cancelled — refund`,
      });
    });

    addNotification({
      title: 'Class cancelled',
      body: `"${cls.title}" has been cancelled. ${active.length} student${active.length === 1 ? '' : 's'} refunded.`,
      category: 'class',
    });
  }, [classes, activeEnrollments, currentUser.id, earnCredits, awardPoints, addNotification]);

  const value: ClassesContextValue = useMemo(() => ({
    classes,
    enrollments,
    openClasses,
    getClassesWithTeachers,
    getClassById,
    getMyTeachingClasses,
    getMyEnrolledClasses,
    getEnrollmentsForClass,
    isEnrolled,
    createClass,
    enrollInClass,
    cancelEnrollment,
    completeClass,
    cancelClass,
  }), [
    classes, enrollments, openClasses, getClassesWithTeachers, getClassById,
    getMyTeachingClasses, getMyEnrolledClasses, getEnrollmentsForClass, isEnrolled,
    createClass, enrollInClass, cancelEnrollment, completeClass, cancelClass,
  ]);

  return value;
});
