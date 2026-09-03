import url from '@/constants/backurl';
import { User, Skill, SkillWithUser, ResourceMeta, GroupClass, ClassEnrollment } from '@/types';

const API_URL = url;

console.log("Hey Hey", API_URL);


const inflightRequests = new Map<string, Promise<any>>();
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CLIENT_CACHE_TTL_MS = 6000; // 6 seconds in-memory cache

async function apiGet<T>(endpoint: string, forceFresh = false): Promise<T> {
  const fullUrl = `${API_URL}${endpoint}`;
  const now = Date.now();

  if (!forceFresh) {
    const cached = memoryCache.get(endpoint);
    if (cached && (now - cached.timestamp < CLIENT_CACHE_TTL_MS)) {
      return cached.data as T;
    }
  }

  if (inflightRequests.has(endpoint)) {
    return inflightRequests.get(endpoint)! as Promise<T>;
  }

  const reqPromise = (async () => {
    try {
      const res = await fetch(fullUrl);
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const data = await res.json() as T;
      memoryCache.set(endpoint, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.warn(`[apiGet] Backend fetch warning for ${fullUrl}:`, (err as any)?.message || err);
      const cached = memoryCache.get(endpoint);
      if (cached) return cached.data as T;
      return [] as unknown as T;
    } finally {
      inflightRequests.delete(endpoint);
    }
  })();

  inflightRequests.set(endpoint, reqPromise);
  return reqPromise;
}

export const getSkillsWithUsers = async (forceFresh = false): Promise<SkillWithUser[]> => {
  return apiGet<SkillWithUser[]>('/skills/with-users', forceFresh);
};

export const getUsers = async (forceFresh = false): Promise<User[]> => {
  return apiGet<User[]>('/users', forceFresh);
};

// export const getResources = async (): Promise<ResourceMeta[]> => {
//   return apiGet<ResourceMeta[]>('/resources');
// };

// console.log(getUsers);





export const mockUsers: User[] = [
  {
    id: '1',
    name: 'User',
    username: '@user',
    avatarUrl: 'https://i.pravatar.cc/150?img=1',
    bio: 'Passionate photographer and yoga instructor. Love connecting with people and learning new things!',
    location: 'Mumbai, Maharashtra',
    skillsOffered: [],
    skillsWanted: ['Cooking', 'Hindi', 'Guitar'],
    rating: 4.9,
    totalSwaps: 23,
    joinedDate: '2024-01-15',
    credits: 50,
    premiumTier: 'premium',
    premiumExpiresAt: '2025-03-15',
  },
  {
    id: '2',
    name: 'Rahul Verma',
    username: '@rahulverma',
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
    bio: 'Software engineer by day, chef by night. Always eager to share my coding knowledge!',
    location: 'Bengaluru, Karnataka',
    skillsOffered: [],
    skillsWanted: ['Photography', 'Yoga', 'Piano'],
    rating: 4.8,
    totalSwaps: 18,
    joinedDate: '2024-02-10',
    credits: 25,
    premiumTier: 'free',
    role: 'teacher',
    teacherProfile: {
      languages: ['English', 'Hindi', 'Kannada'],
      qualifications: ["Bachelor's Degree", 'Industry Expert'],
      isCertified: true,
      certifications: [
        { id: 'seed-cert-1', title: 'AWS Certified Solutions Architect' },
        { id: 'seed-cert-2', title: 'Google UX Design Certificate', documentUri: 'mock://certificate/ux-design.pdf' },
      ],
      yearsTeaching: '3–5 years',
      careerHistory: [
        { id: 'seed-career-1', role: 'Software Engineer', organization: 'TCS', years: '2017–2021' },
        { id: 'seed-career-2', role: 'Coding Instructor', organization: 'Whitehat Jr', years: '2021–2023' },
      ],
      privateTuition: true,
    },
  },
  {
    id: '3',
    name: 'Ananya Reddy',
    username: '@ananyareddy',
    avatarUrl: 'https://i.pravatar.cc/150?img=5',
    bio: 'Language enthusiast and guitar player. Teaching Telugu and Hindi for 5+ years!',
    location: 'Hyderabad, Telangana',
    skillsOffered: [],
    skillsWanted: ['Web Development', 'Painting', 'Photography'],
    rating: 5.0,
    totalSwaps: 31,
    joinedDate: '2023-11-05',
    credits: 120,
    premiumTier: 'elite',
    premiumExpiresAt: '2026-11-05',
    role: 'teacher',
    teacherProfile: {
      languages: ['Telugu', 'Hindi', 'English', 'Tamil'],
      qualifications: ["Master's Degree", 'B.Ed / D.El.Ed'],
      isCertified: true,
      certifications: [
        { id: 'seed-cert-3', title: 'CTET — Central Teacher Eligibility Test', documentUri: 'mock://certificate/ctet.pdf' },
      ],
      yearsTeaching: '5–10 years',
      careerHistory: [
        { id: 'seed-career-3', role: 'Language Teacher', organization: 'Delhi Public School', years: '2016–2021' },
        { id: 'seed-career-4', role: 'Freelance Language Coach', organization: 'Self-employed', years: '2021–present' },
      ],
      privateTuition: true,
    },
  },
  {
    id: '4',
    name: 'Arjun Mehta',
    username: '@arjunmehta',
    avatarUrl: 'https://i.pravatar.cc/150?img=13',
    bio: 'Piano teacher and fitness coach. Music is life!',
    location: 'Delhi NCR',
    skillsOffered: [],
    skillsWanted: ['Graphic Design', 'French', 'Cooking'],
    rating: 4.7,
    totalSwaps: 15,
    joinedDate: '2024-03-20',
    credits: 10,
    premiumTier: 'free',
    role: 'teacher',
    teacherProfile: {
      languages: ['Hindi', 'English'],
      qualifications: ["Bachelor's Degree", 'Professional Certification'],
      isCertified: true,
      certifications: [
        { id: 'seed-cert-4', title: 'ABRSM Grade 8 Piano', documentUri: 'mock://certificate/abrsm.pdf' },
      ],
      yearsTeaching: '1–3 years',
      careerHistory: [
        { id: 'seed-career-5', role: 'Music Instructor', organization: 'Sangeet Academy', years: '2 years' },
      ],
      privateTuition: true,
    },
  },
  {
    id: '5',
    name: 'Kavya Nair',
    username: '@kavyanair',
    avatarUrl: 'https://i.pravatar.cc/150?img=9',
    bio: 'Digital artist and designer. Love teaching creative skills!',
    location: 'Chennai, Tamil Nadu',
    skillsOffered: [],
    skillsWanted: ['Yoga', 'Tamil', 'Piano'],
    rating: 4.9,
    totalSwaps: 27,
    joinedDate: '2023-12-08',
    credits: 75,
    premiumTier: 'basic',
    premiumExpiresAt: '2025-02-08',
  },
  {
    id: '6',
    name: 'Vikram Singh',
    username: '@vikramsingh',
    avatarUrl: 'https://i.pravatar.cc/150?img=14',
    bio: 'Web developer and tech enthusiast. Happy to help anyone learn to code!',
    location: 'Pune, Maharashtra',
    skillsOffered: [],
    skillsWanted: ['Guitar', 'Cooking', 'Photography'],
    rating: 4.8,
    totalSwaps: 20,
    joinedDate: '2024-01-28',
    credits: 15,
    premiumTier: 'free',
  },
];

export const mockSkills: Skill[] = [
  {
    id: '1',
    title: 'Portrait Photography',
    category: 'Photography',
    description: 'Learn the art of capturing stunning portraits with natural lighting and composition techniques. Perfect for beginners looking to improve their photography skills.',
    level: 'Intermediate',
    userId: '1',
    imageUrl: 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800',
    pricingModel: 'per_session',
    pricePerSession: 600,
    promoted: true,
    promoTagline: '20% off your first 1-on-1 session!',
  },
  {
    id: '2',
    title: 'Hatha Yoga',
    category: 'Fitness & Wellness',
    description: 'Traditional yoga practice focusing on physical postures and breathing. Great for flexibility, stress relief, and overall wellness.',
    level: 'Beginner',
    userId: '1',
    imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
    pricingModel: 'monthly',
    monthlyPrice: 1800,
  },
  {
    id: '3',
    title: 'Web Development (React)',
    category: 'Technology',
    description: 'Build modern web applications using React, JavaScript, and TypeScript. Learn components, hooks, and best practices from a professional developer.',
    level: 'Intermediate',
    userId: '2',
    imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    pricingModel: 'per_session',
    pricePerSession: 800,
    promoted: true,
    promoTagline: 'First code review session completely free!',
  },
  {
    id: '4',
    title: 'Indian Regional Cooking',
    category: 'Cooking',
    description: 'Master authentic Indian recipes from biryani to dosas. Learn traditional techniques from various regions including North Indian, South Indian, and street food.',
    level: 'Beginner',
    userId: '2',
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
    pricingModel: 'free',
  },
  {
    id: '5',
    title: 'Hindi Conversation',
    category: 'Languages',
    description: 'Improve your Hindi speaking skills through engaging conversations. Focus on practical vocabulary, everyday expressions, and Devanagari script.',
    level: 'Intermediate',
    userId: '3',
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800',
    pricingModel: 'monthly',
    monthlyPrice: 1500,
  },
  {
    id: '6',
    title: 'Acoustic Guitar',
    category: 'Music',
    description: 'Learn to play your favorite songs on acoustic guitar. Covers chords, strumming patterns, and basic music theory.',
    level: 'Beginner',
    userId: '3',
    imageUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800',
    pricingModel: 'per_session',
    pricePerSession: 500,
  },
  {
    id: '7',
    title: 'Piano Fundamentals',
    category: 'Music',
    description: 'Start your musical journey with piano basics. Learn to read music, proper technique, and play simple melodies.',
    level: 'Beginner',
    userId: '4',
    imageUrl: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800',
    pricingModel: 'per_session',
    pricePerSession: 700,
    promoted: true,
    promoTagline: 'Free trial week for all new learners!',
  },
  {
    id: '8',
    title: 'HIIT Training',
    category: 'Fitness & Wellness',
    description: 'High-intensity interval training for maximum results. Get fit with efficient 30-minute workouts you can do anywhere.',
    level: 'Intermediate',
    userId: '4',
    imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
    pricingModel: 'free',
  },
  {
    id: '9',
    title: 'Digital Illustration',
    category: 'Arts & Crafts',
    description: 'Create beautiful digital artwork using Procreate or Photoshop. Learn color theory, composition, and digital techniques.',
    level: 'Advanced',
    userId: '5',
    imageUrl: 'https://images.unsplash.com/photo-1596548438137-d51ea5c83ca4?w=800',
    pricingModel: 'monthly',
    monthlyPrice: 2500,
  },
  {
    id: '10',
    title: 'UI/UX Design',
    category: 'Technology',
    description: 'Design beautiful and functional user interfaces. Learn design principles, prototyping, and user research methods.',
    level: 'Intermediate',
    userId: '5',
    imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
    pricingModel: 'per_session',
    pricePerSession: 1000,
  },
  {
    id: '11',
    title: 'Full-Stack Development',
    category: 'Technology',
    description: 'Build complete web applications from front to back. Learn Node.js, databases, APIs, and deployment strategies.',
    level: 'Advanced',
    userId: '6',
    imageUrl: 'https://images.unsplash.com/photo-1537432376769-00f5c2f4c8d2?w=800',
    pricingModel: 'monthly',
    monthlyPrice: 3000,
  },
  {
    id: '12',
    title: 'Business Strategy',
    category: 'Business',
    description: 'Learn how to develop effective business strategies and grow your venture. Perfect for entrepreneurs and small business owners.',
    level: 'Intermediate',
    userId: '6',
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
    pricingModel: 'free',
  },
];

mockUsers.forEach(user => {
  user.skillsOffered = mockSkills.filter(skill => skill.userId === user.id);
});

// export const getSkillsWithUsers = (): SkillWithUser[] => {
//   return mockSkills.map(skill => {
//     const user = mockUsers.find(u => u.id === skill.userId);
//     if (!user) throw new Error('User not found');
//     return { ...skill, user };
//   });
// };

export const categories = [
  'All',
  'Arts & Crafts',
  'Technology',
  'Fitness & Wellness',
  'Languages',
  'Music',
  'Cooking',
  'Business',
  'Photography & Video',
  'Health & Life',
  'Professional Skills',
  'Education & Teaching',
  'Marketing & Sales',
  'Finance & Accounting',
  'Design & Creative',
  'Writing & Communication',
  'Personal Development',
  'Sports & Games',
  'DIY & Home Skills',
  'Career & Jobs',
  'Other / Miscellaneous',
];

export const mockResources: ResourceMeta[] = [
  {
    id: 'res-1',
    title: 'Portrait Lighting Fundamentals',
    description: 'Master three-point lighting setups and natural light tricks for cinematic portraits.',
    type: 'Article',
    url: 'https://fstoppers.com/lighting/ultimate-guide-portrait-lighting-2024-654321',
    coverImageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=900',
    categories: ['Photography'],
    contributorId: '1',
    contributorName: 'Priya Sharma',
    contributorAvatarUrl: 'https://i.pravatar.cc/150?img=1',
    difficulty: 'Intermediate',
    durationMinutes: 18,
    formatBadge: 'Deep Dive',
    publishedAt: '2024-07-03T09:00:00Z',
    endorsements: 42,
    saves: 126,
    tags: ['Lighting', 'Portraits', 'Studio'],
  },
  {
    id: 'res-2',
    title: 'React Hooks for Designers Workshop',
    description: 'Interactive video lesson blending UI thinking with practical React patterns.',
    type: 'Video',
    url: 'https://www.youtube.com/watch?v=OxFcbx6QyBc',
    coverImageUrl: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?w=900',
    categories: ['Technology', 'Arts & Crafts'],
    contributorId: '2',
    contributorName: 'Rahul Verma',
    contributorAvatarUrl: 'https://i.pravatar.cc/150?img=12',
    difficulty: 'Intermediate',
    durationMinutes: 42,
    formatBadge: 'Live Replay',
    publishedAt: '2024-08-19T15:30:00Z',
    endorsements: 58,
    saves: 201,
    tags: ['React', 'UX', 'Hooks'],
  },
  {
    id: 'res-3',
    title: 'Spanish Immersion Conversation Deck',
    description: 'Printable prompts and cultural scenarios to stay fluent between sessions.',
    type: 'Document',
    url: 'https://drive.google.com/file/d/spanish-deck',
    coverImageUrl: 'https://images.unsplash.com/photo-1529158062015-cad636e69505?w=900',
    categories: ['Languages'],
    contributorId: '3',
    contributorName: 'Ananya Reddy',
    contributorAvatarUrl: 'https://i.pravatar.cc/150?img=5',
    difficulty: 'All Levels',
    formatBadge: 'Printable PDF',
    publishedAt: '2024-06-11T12:05:00Z',
    endorsements: 67,
    saves: 174,
    tags: ['Spanish', 'Conversation', 'Culture'],
  },
  {
    id: 'res-4',
    title: 'Morning Mobility Micro-Routines',
    description: 'Five 10-minute guided flows to unlock stubborn joints before workouts.',
    type: 'Collection',
    url: 'https://notion.so/mobility-primer',
    coverImageUrl: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=900',
    categories: ['Fitness & Wellness'],
    contributorId: '4',
    contributorName: 'Arjun Mehta',
    contributorAvatarUrl: 'https://i.pravatar.cc/150?img=13',
    difficulty: 'Beginner',
    durationMinutes: 50,
    formatBadge: 'Routine Pack',
    publishedAt: '2024-10-02T07:40:00Z',
    endorsements: 33,
    saves: 119,
    tags: ['Mobility', 'Stretching', 'Morning'],
  },
  {
    id: 'res-5',
    title: 'Figma Components Starter Vault',
    description: 'Curated UI kit with responsive components ready for your next app build.',
    type: 'Document',
    url: 'https://www.figma.com/community/file/123456789',
    coverImageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900',
    categories: ['Technology'],
    contributorId: '5',
    contributorName: 'Kavya Nair',
    contributorAvatarUrl: 'https://i.pravatar.cc/150?img=9',
    difficulty: 'Advanced',
    formatBadge: 'Figma Kit',
    publishedAt: '2024-09-14T21:10:00Z',
    endorsements: 81,
    saves: 264,
    tags: ['Design Systems', 'Product Design', 'Figma'],
  },
  {
    id: 'res-6',
    title: 'Full-Stack Interview Cheat Codes',
    description: 'Annotated resource stack to prepare for system design and live coding swaps.',
    type: 'Article',
    url: 'https://stackshare.io/fullstack-cheats',
    coverImageUrl: 'https://images.unsplash.com/photo-1526378722391-8da5af53655a?w=900',
    categories: ['Technology', 'Business'],
    contributorId: '6',
    contributorName: 'Vikram Singh',
    contributorAvatarUrl: 'https://i.pravatar.cc/150?img=14',
    difficulty: 'Advanced',
    durationMinutes: 26,
    formatBadge: 'Playbook',
    publishedAt: '2024-11-01T18:22:00Z',
    endorsements: 76,
    saves: 198,
    tags: ['Interviews', 'Full-Stack', 'Systems'],
  },
];

export const getResources = (): ResourceMeta[] => {
  return mockResources;
};

// ============================================================
//  Group Classes mock data
// ============================================================

const now = Date.now();
const DAY = 86400000;
const HOUR = 3600000;

export const mockClasses: GroupClass[] = [
  {
    id: 'cls-1',
    teacherId: '1',
    title: 'Sunrise Portrait Photography Workshop',
    description: 'Join a hands-on outdoor session capturing golden-hour portraits. Learn natural lighting, posing, and composition. Bring your own camera or phone!',
    category: 'Photography',
    level: 'Intermediate',
    coverImageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2abe4e?w=800',
    startISO: new Date(now + 2 * DAY).toISOString(),
    endISO: new Date(now + 2 * DAY + 2 * HOUR).toISOString(),
    sessionType: 'single',
    billingCycle: 'one_time',
    sessionCount: 1,
    maxCapacity: 8,
    seatPriceCredits: 150,
    status: 'open',
    createdAt: new Date(now - 3 * DAY).toISOString(),
  },
  {
    id: 'cls-2',
    teacherId: '3',
    title: 'Hindi Conversation — Daily Speaking Course',
    description: 'Practice speaking Hindi every weekday for a month. Build fluency through daily conversations, role-plays, and feedback in a small group.',
    category: 'Languages',
    level: 'Beginner',
    coverImageUrl: 'https://images.unsplash.com/photo-1532619675605-1ede6c2ad753?w=800',
    startISO: new Date(now + 1 * DAY).toISOString(),
    endISO: new Date(now + 30 * DAY + 60 * 60 * 1000).toISOString(),
    sessionType: 'daily',
    billingCycle: 'monthly',
    sessionCount: 30,
    maxCapacity: 15,
    seatPriceCredits: 500,
    status: 'open',
    createdAt: new Date(now - 2 * DAY).toISOString(),
  },
  {
    id: 'cls-3',
    teacherId: '2',
    title: 'React Fundamentals — Live Coding Bootcamp',
    description: 'A 3-hour intensive covering React components, hooks, state management, and API integration. Perfect for developers transitioning to React.',
    category: 'Technology',
    level: 'Intermediate',
    coverImageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    startISO: new Date(now + 7 * DAY).toISOString(),
    endISO: new Date(now + 7 * DAY + 3 * HOUR).toISOString(),
    sessionType: 'single',
    billingCycle: 'one_time',
    sessionCount: 1,
    maxCapacity: 20,
    seatPriceCredits: 300,
    status: 'open',
    createdAt: new Date(now - 1 * DAY).toISOString(),
  },
  {
    id: 'cls-4',
    teacherId: '4',
    title: 'Morning HIIT — Free Community Session',
    description: 'Start your day with a high-energy 30-minute HIIT workout. All fitness levels welcome. No equipment needed — just a mat and water!',
    category: 'Fitness & Wellness',
    level: 'Beginner',
    coverImageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
    startISO: new Date(now + 1 * DAY).toISOString(),
    endISO: new Date(now + 1 * DAY + 30 * 60 * 1000).toISOString(),
    sessionType: 'single',
    billingCycle: 'one_time',
    sessionCount: 1,
    maxCapacity: 30,
    seatPriceCredits: 0,
    status: 'open',
    createdAt: new Date(now - 5 * DAY).toISOString(),
  },
  {
    id: 'cls-5',
    teacherId: '5',
    title: 'Digital Illustration — Weekly Procreate Course',
    description: 'A 4-week Procreate course meeting every Saturday. Learn brushes, layers, color theory, and create a portfolio piece.',
    category: 'Arts & Crafts',
    level: 'Advanced',
    coverImageUrl: 'https://images.unsplash.com/photo-1596548438137-d51ea5c83ca4?w=800',
    startISO: new Date(now + 5 * DAY).toISOString(),
    endISO: new Date(now + 26 * DAY + 2.5 * HOUR).toISOString(),
    sessionType: 'weekly',
    billingCycle: 'monthly',
    sessionCount: 4,
    scheduleDays: ['Sat'],
    maxCapacity: 12,
    seatPriceCredits: 400,
    status: 'open',
    createdAt: new Date(now - 4 * DAY).toISOString(),
  },
  {
    id: 'cls-6',
    teacherId: '3',
    title: 'Bharatanatyam Intro — Classical Dance Basics',
    description: 'Discover the beauty of Bharatanatyam. Learn basic adavus, hand mudras, and expressions. Open to all ages and backgrounds.',
    category: 'Classical Arts',
    level: 'Beginner',
    coverImageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800',
    startISO: new Date(now + 3 * DAY).toISOString(),
    endISO: new Date(now + 3 * DAY + 90 * 60 * 1000).toISOString(),
    sessionType: 'single',
    billingCycle: 'one_time',
    sessionCount: 1,
    maxCapacity: 10,
    seatPriceCredits: 100,
    status: 'open',
    createdAt: new Date(now - 6 * DAY).toISOString(),
  },
  {
    id: 'cls-7',
    teacherId: '2',
    title: 'Business Communication — Weekly Workshops',
    description: 'Improve your professional communication skills. Weekly sessions on presentations, emails, negotiation, and networking.',
    category: 'Business',
    level: 'Intermediate',
    coverImageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800',
    startISO: new Date(now + 4 * DAY).toISOString(),
    endISO: new Date(now + 32 * DAY + 90 * 60 * 1000).toISOString(),
    sessionType: 'weekly',
    billingCycle: 'one_time',
    sessionCount: 5,
    scheduleDays: ['Tue', 'Thu'],
    maxCapacity: 18,
    seatPriceCredits: 250,
    status: 'open',
    createdAt: new Date(now - 2 * DAY).toISOString(),
  },
];

export const mockEnrollments: ClassEnrollment[] = [
  { id: 'enr-1', classId: 'cls-1', studentId: '2', enrolledAt: new Date(now - 2 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-2', classId: 'cls-1', studentId: '3', enrolledAt: new Date(now - 2 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-3', classId: 'cls-1', studentId: '5', enrolledAt: new Date(now - 1 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-4', classId: 'cls-2', studentId: '4', enrolledAt: new Date(now - 1 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-5', classId: 'cls-2', studentId: '6', enrolledAt: new Date(now - 1 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-6', classId: 'cls-2', studentId: '1', enrolledAt: new Date(now - 12 * HOUR).toISOString(), status: 'enrolled' },
  { id: 'enr-7', classId: 'cls-4', studentId: '2', enrolledAt: new Date(now - 3 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-8', classId: 'cls-4', studentId: '3', enrolledAt: new Date(now - 3 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-9', classId: 'cls-4', studentId: '5', enrolledAt: new Date(now - 2 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-10', classId: 'cls-4', studentId: '6', enrolledAt: new Date(now - 1 * DAY).toISOString(), status: 'enrolled' },
  { id: 'enr-11', classId: 'cls-3', studentId: '5', enrolledAt: new Date(now - 18 * HOUR).toISOString(), status: 'enrolled' },
  { id: 'enr-12', classId: 'cls-5', studentId: '1', enrolledAt: new Date(now - 2 * DAY).toISOString(), status: 'enrolled' },
];

export const getClasses = (): GroupClass[] => mockClasses;
export const getEnrollments = (): ClassEnrollment[] => mockEnrollments;
