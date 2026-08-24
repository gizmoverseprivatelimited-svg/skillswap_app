import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { mockUsers, mockClasses, mockEnrollments } from '../mocks/data';
import type { GroupClass, ClassEnrollment, ClassWithTeacher, ClassStatus, ClassSessionType, ClassBillingCycle, SkillCategory, SkillLevel } from '../types';
import { useCurrentUser } from './current-user';
import { useEarnings } from './earnings';
import { useNotifications } from './notifications';
import { useSafety } from './safety';
import { useSocket } from './socket';
import { getClassEnrollmentCost, getClassTeacherEarnings } from '../lib/payments';
import url from '@/constants/backurl';

interface CreateClassInput {
  title: string;
  description: string;
  category: SkillCategory;
  subCategory?: string;
  level: SkillLevel;
  coverImageUrl: string;
  startISO: string;
  endISO: string;
  sessionType?: ClassSessionType;
  billingCycle?: ClassBillingCycle;
  scheduleDays?: string[];
  maxCapacity: number;
  seatPriceCredits: number;
}

function computeSessionCount(
  sessionType?: ClassSessionType,
  startISO?: string,
  endISO?: string,
  scheduleDays?: string[],
): number {
  if (!sessionType || sessionType === 'single') return 1;
  if (!startISO || !endISO) return 1;
  const start = new Date(startISO);
  const end = new Date(endISO);
  const dayMs = 86400000;
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / dayMs) + 1);
  if (sessionType === 'daily') return days;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selected = scheduleDays?.length ? scheduleDays : ['Mon'];
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * dayMs);
    if (selected.includes(dayNames[d.getDay()])) count++;
  }
  return count || 1;
}

interface ClassesContextValue {
  classes: GroupClass[];
  enrollments: ClassEnrollment[];
  openClasses: GroupClass[];
  getClassesWithTeachers: () => ClassWithTeacher[];
  getClassById: (id: string) => ClassWithTeacher | undefined;
  getMyTeachingClasses: () => ClassWithTeacher[];
  getClassesByTeacher: (teacherId: string) => ClassWithTeacher[];
  getMyEnrolledClasses: () => ClassWithTeacher[];
  getEnrollmentsForClass: (classId: string) => ClassEnrollment[];
  isEnrolled: (classId: string, studentId: string) => boolean;
  createClass: (input: CreateClassInput) => GroupClass;
  enrollInClass: (classId: string) => { success: boolean; error?: string };
  cancelEnrollment: (classId: string) => { success: boolean; error?: string };
  completeClass: (classId: string) => void;
  cancelClass: (classId: string) => void;
  refreshClasses: () => Promise<void>;
}

const generateId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const [ClassesProvider, useClasses] = createContextHook<ClassesContextValue>(() => {
  const { currentUser, allUsers, spendCredits, earnCredits, loadUser } = useCurrentUser();
  const { awardPoints, refreshUserEarnings } = useEarnings();
  const { addNotification } = useNotifications();
  const { socket } = useSocket();

  const [classes, setClasses] = useState<GroupClass[]>(() => mockClasses.map(c => ({ ...c })));
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>(() => mockEnrollments.map(e => ({ ...e })));

  // Fetch classes and enrollments from backend API
  const fetchClassesFromBackend = useCallback(async () => {
    try {
      const [resClasses, resEnrollments] = await Promise.all([
        fetch(`${url}/classes`),
        fetch(`${url}/classes/enrollments`),
      ]);
      if (resClasses.ok) {
        const dataClasses = await resClasses.json();
        if (Array.isArray(dataClasses)) {
          setClasses(dataClasses);
        }
      }
      if (resEnrollments.ok) {
        const dataEnrollments = await resEnrollments.json();
        if (Array.isArray(dataEnrollments)) {
          setEnrollments(dataEnrollments);
        }
      }
    } catch (err) {
      console.warn('[ClassesProvider] Failed to fetch classes from backend:', err);
    }
  }, []);

  useEffect(() => {
    fetchClassesFromBackend();
  }, [fetchClassesFromBackend]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleClassUpdated = () => {
      fetchClassesFromBackend();
    };

    socket.on('class_updated', handleClassUpdated);
    socket.on('class_started', handleClassUpdated);
    socket.on('class_call_started', handleClassUpdated);
    socket.on('class_ended', handleClassUpdated);
    return () => {
      socket.off('class_updated', handleClassUpdated);
      socket.off('class_started', handleClassUpdated);
      socket.off('class_call_started', handleClassUpdated);
      socket.off('class_ended', handleClassUpdated);
    };
  }, [socket, fetchClassesFromBackend]);

  // Periodic polling fallback to guarantee real-time sync across all clients
  useEffect(() => {
    const interval = setInterval(() => {
      fetchClassesFromBackend();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchClassesFromBackend]);

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
      enrollments.some(e => String(e.classId) === String(classId) && String(e.studentId) === String(studentId) && e.status === 'enrolled'),
    [enrollments],
  );

  const buildClassWithTeacher = useCallback(
    (cls: GroupClass): ClassWithTeacher => {
      const fallbackUser = currentUser ?? mockUsers[0];
      const teacher = allUsers.find(u => String(u.id) === String(cls.teacherId)) ?? fallbackUser;
      const clsEnrollments = enrollments.filter(e => String(e.classId) === String(cls.id) && e.status === 'enrolled');
      return { ...cls, teacher, enrolledCount: clsEnrollments.length, enrollments: clsEnrollments };
    },
    [allUsers, currentUser, enrollments],
  );

  const getClassesWithTeachers = useCallback((): ClassWithTeacher[] => {
    return classes.map(buildClassWithTeacher);
  }, [classes, buildClassWithTeacher]);

  const getClassById = useCallback(
    (id: string): ClassWithTeacher | undefined => {
      const cls = classes.find(c => String(c.id) === String(id) || String((c as any)._id) === String(id));
      return cls ? buildClassWithTeacher(cls) : undefined;
    },
    [classes, buildClassWithTeacher],
  );

  const getMyTeachingClasses = useCallback((): ClassWithTeacher[] => {
    if (!currentUser) return [];
    return classes.filter(c => String(c.teacherId) === String(currentUser.id)).map(buildClassWithTeacher);
  }, [classes, currentUser, buildClassWithTeacher]);

  const getClassesByTeacher = useCallback(
    (teacherId: string): ClassWithTeacher[] => {
      return classes
        .filter(c => (String(c.teacherId) === String(teacherId) || String((c as any)._id) === String(teacherId)) && c.status === 'open')
        .map(buildClassWithTeacher);
    },
    [classes, buildClassWithTeacher],
  );

  const getMyEnrolledClasses = useCallback((): ClassWithTeacher[] => {
    if (!currentUser) return [];
    const myEnrollmentClassIds = enrollments
      .filter(e => String(e.studentId) === String(currentUser.id) && e.status !== 'cancelled')
      .map(e => String(e.classId));
    return classes
      .filter(c => myEnrollmentClassIds.includes(String(c.id)) || myEnrollmentClassIds.includes(String((c as any)._id)))
      .map(buildClassWithTeacher);
  }, [classes, enrollments, currentUser, buildClassWithTeacher]);

  const openClasses = useMemo(() => classes.filter(c => c.status === 'open'), [classes]);

  const createClass = useCallback((input: CreateClassInput): GroupClass => {
    const currentUserId = currentUser?.id ?? '1';
    const tempId = generateId('class');
    const sType = input.sessionType ?? 'single';
    const bCycle = input.billingCycle ?? 'one_time';
    const sCount = computeSessionCount(sType, input.startISO, input.endISO, input.scheduleDays);

    const cls: GroupClass = {
      id: tempId,
      teacherId: currentUserId,
      title: input.title,
      description: input.description,
      category: input.category,
      subCategory: input.subCategory || '',
      level: input.level,
      coverImageUrl: input.coverImageUrl,
      startISO: input.startISO,
      endISO: input.endISO,
      sessionType: sType,
      billingCycle: bCycle,
      sessionCount: sCount,
      scheduleDays: sType === 'weekly' ? input.scheduleDays : undefined,
      maxCapacity: input.maxCapacity,
      seatPriceCredits: input.seatPriceCredits,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    setClasses(prev => [cls, ...prev]);

    // Backend sync
    fetch(`${url}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: currentUserId,
        title: input.title,
        description: input.description,
        category: input.category,
        subCategory: input.subCategory || '',
        level: input.level,
        coverImageUrl: input.coverImageUrl,
        startISO: input.startISO,
        endISO: input.endISO,
        sessionType: sType,
        billingCycle: bCycle,
        sessionCount: sCount,
        scheduleDays: sType === 'weekly' ? input.scheduleDays : undefined,
        maxCapacity: input.maxCapacity,
        seatPriceCredits: input.seatPriceCredits,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data && (data.id || data._id)) {
          const created: GroupClass = { ...cls, id: data.id || data._id };
          setClasses(prev => prev.map(c => c.id === tempId ? created : c));
        }
      })
      .catch(err => console.error('[ClassesProvider] Create class API error:', err));

    addNotification({
      title: 'Class created',
      body: `Your class "${input.title}" is now live and accepting enrollments.`,
      category: 'class',
    });
    return cls;
  }, [currentUser, addNotification]);

  const { isBlocked } = useSafety();

  const enrollInClass = useCallback((classId: string): { success: boolean; error?: string } => {
    if (!currentUser) return { success: false, error: 'User not authenticated' };
    const cls = classes.find(c => String(c.id) === String(classId) || String((c as any)._id) === String(classId));
    if (!cls) return { success: false, error: 'Class not found' };
    if (cls.status !== 'open') return { success: false, error: 'Class is no longer open' };

    const teacherId = cls.teacherId ? String(cls.teacherId) : '';
    if (teacherId && isBlocked(teacherId)) {
      return { success: false, error: 'You cannot enroll in a class hosted by a user you have blocked.' };
    }

    if (isEnrolled(classId, currentUser.id)) {
      return { success: false, error: 'You are already enrolled' };
    }

    const enrolledCount = activeEnrollments(classId).length;
    if (enrolledCount >= cls.maxCapacity) {
      return { success: false, error: 'Class is full' };
    }

    const cost = getClassEnrollmentCost(cls.seatPriceCredits);
    if (cost > 0) {
      if (currentUser.credits < cost) {
        return { success: false, error: 'Not enough credits' };
      }
      spendCredits(cost);
    }

    const enr: ClassEnrollment = {
      id: generateId('enr'),
      classId: cls.id,
      studentId: currentUser.id,
      enrolledAt: new Date().toISOString(),
      status: 'enrolled',
    };
    setEnrollments(prev => [...prev, enr]);

    // Backend sync
    fetch(`${url}/classes/${cls.id}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: currentUser.id }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          console.warn('[ClassesProvider] Enroll error from backend:', data);
          // Rollback enrollment
          setEnrollments((prev) => prev.filter((e) => e.id !== enr.id));
          if (cost > 0 && earnCredits) {
            earnCredits(cost);
          }
        } else {
          if (loadUser) loadUser();
          if (refreshUserEarnings) refreshUserEarnings(currentUser.id);
        }
      })
      .catch(err => console.error('[ClassesProvider] Enroll API error:', err));

    // Notify user / teacher
    if (String(cls.teacherId) === String(currentUser.id)) {
      addNotification({
        title: 'New enrollment',
        body: `${currentUser.name} enrolled in your class "${cls.title}"`,
        category: 'class',
      });
    } else {
      addNotification({
        title: 'Enrolled in class',
        body: `You enrolled in "${cls.title}"`,
        category: 'class',
      });
    }

    return { success: true };
  }, [classes, isEnrolled, isBlocked, currentUser, activeEnrollments, spendCredits, earnCredits, addNotification, loadUser, refreshUserEarnings]);

  const cancelEnrollment = useCallback((classId: string): { success: boolean; error?: string } => {
    if (!currentUser) return { success: false, error: 'Not authenticated' };
    const cls = classes.find(c => String(c.id) === String(classId) || String((c as any)._id) === String(classId));
    if (!cls) return { success: false, error: 'Class not found' };

    if ((cls as any).hasStarted || (cls as any).isLive || (cls as any).startedAt) {
      return { success: false, error: 'Cannot cancel enrollment. The class has already started.' };
    }

    setEnrollments(prev =>
      prev.map(e =>
        String(e.classId) === String(classId) && String(e.studentId) === String(currentUser.id) && e.status === 'enrolled'
          ? { ...e, status: 'cancelled' as const }
          : e,
      ),
    );

    const cost = getClassEnrollmentCost(cls.seatPriceCredits);
    if (cost > 0) {
      earnCredits(cost);
    }

    // Backend sync
    fetch(`${url}/classes/${cls.id}/cancel-enrollment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: currentUser.id }),
    })
      .then(() => {
        if (loadUser) loadUser();
        if (refreshUserEarnings) refreshUserEarnings(currentUser.id);
      })
      .catch(err => console.error('[ClassesProvider] Cancel enrollment API error:', err));

    addNotification({
      title: 'Enrollment cancelled',
      body: `You cancelled enrollment in "${cls.title}". ${cost > 0 ? `${cost} credits refunded.` : ''}`,
      category: 'class',
    });

    return { success: true };
  }, [classes, currentUser, earnCredits, addNotification, loadUser, refreshUserEarnings]);

  const completeClass = useCallback((classId: string) => {
    if (!currentUser) return;
    const cls = classes.find(c => String(c.id) === String(classId) || String((c as any)._id) === String(classId));
    if (!cls || cls.status !== 'open') return;

    const active = activeEnrollments(classId);
    const enrolledCount = active.length;

    setClasses(prev =>
      prev.map(c => String(c.id) === String(classId) ? { ...c, status: 'completed' as ClassStatus } : c),
    );
    setEnrollments(prev =>
      prev.map(e =>
        String(e.classId) === String(classId) && e.status === 'enrolled'
          ? { ...e, status: 'attended' as const }
          : e,
      ),
    );

    // Process teacher earnings locally
    const teacherEarned = getClassTeacherEarnings(cls.seatPriceCredits, enrolledCount);
    if (String(cls.teacherId) === String(currentUser.id)) {
      earnCredits(teacherEarned);
    }

    // Award learner bonus locally if current user is student
    active.forEach(enr => {
      if (String(enr.studentId) === String(currentUser.id)) {
        earnCredits(10);
      }
    });

    // Backend sync
    fetch(`${url}/classes/${cls.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(() => {
        if (loadUser) loadUser();
        if (refreshUserEarnings) refreshUserEarnings(currentUser.id);
      })
      .catch(err => console.error('[ClassesProvider] Complete class API error:', err));

    addNotification({
      title: 'Class completed',
      body: `"${cls.title}" marked complete. ${enrolledCount} student${enrolledCount === 1 ? '' : 's'} attended. You earned ${teacherEarned} credits.`,
      category: 'class',
    });
  }, [classes, activeEnrollments, currentUser, earnCredits, addNotification, loadUser, refreshUserEarnings]);

  const cancelClass = useCallback((classId: string) => {
    const targetId = String(classId);
    const cls = classes.find(c => String(c.id) === targetId || String((c as any)._id) === targetId);
    if (!cls || cls.status !== 'open') return;

    const active = activeEnrollments(classId);

    setClasses(prev =>
      prev.map(c => (String(c.id) === targetId || String((c as any)._id) === targetId) ? { ...c, status: 'cancelled' as ClassStatus } : c),
    );
    setEnrollments(prev =>
      prev.map(e =>
        String(e.classId) === targetId && e.status === 'enrolled'
          ? { ...e, status: 'cancelled' as const }
          : e,
      ),
    );

    // Refund all enrolled students
    const cost = getClassEnrollmentCost(cls.seatPriceCredits);
    active.forEach(enr => {
      if (currentUser && String(enr.studentId) === String(currentUser.id) && cost > 0) {
        earnCredits(cost);
      }
    });

    // Backend sync
    const apiClassId = (cls as any)._id || cls.id;
    fetch(`${url}/classes/${apiClassId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => res.json())
      .then(() => {
        if (loadUser) void loadUser();
        if (currentUser && refreshUserEarnings) void refreshUserEarnings(currentUser.id);
        void fetchClassesFromBackend();
      })
      .catch(err => console.error('[ClassesProvider] Cancel class API error:', err));

    addNotification({
      title: 'Class cancelled',
      body: `"${cls.title}" has been cancelled. ${active.length} student${active.length === 1 ? '' : 's'} refunded.`,
      category: 'class',
    });
  }, [classes, activeEnrollments, currentUser, earnCredits, addNotification, loadUser, refreshUserEarnings, fetchClassesFromBackend]);

  const value: ClassesContextValue = useMemo(() => ({
    classes,
    enrollments,
    openClasses,
    getClassesWithTeachers,
    getClassById,
    getMyTeachingClasses,
    getClassesByTeacher,
    getMyEnrolledClasses,
    getEnrollmentsForClass,
    isEnrolled,
    createClass,
    enrollInClass,
    cancelEnrollment,
    completeClass,
    cancelClass,
    refreshClasses: fetchClassesFromBackend,
  }), [
    classes, enrollments, openClasses, getClassesWithTeachers, getClassById,
    getMyTeachingClasses, getClassesByTeacher, getMyEnrolledClasses, getEnrollmentsForClass, isEnrolled,
    createClass, enrollInClass, cancelEnrollment, completeClass, cancelClass, fetchClassesFromBackend,
  ]);

  return value;
});
