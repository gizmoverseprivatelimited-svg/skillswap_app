// Leteski — Category & Subcategory Structure (Backend)
// 20 main categories • 240 subcategories (12 subcategories each)

const CATEGORY_STRUCTURE = {
  'Arts & Crafts': {
    subcategories: [
      'Drawing',
      'Painting',
      'Sketching',
      'Calligraphy',
      'Origami',
      'Pottery',
      'Candle Making',
      'Resin Art',
      'Embroidery',
      'Knitting',
      'Crochet',
      'Handmade Crafts',
    ],
  },
  'Technology': {
    subcategories: [
      'Web Development',
      'App Development',
      'React / React Native',
      'Python',
      'Java',
      'JavaScript',
      'AI & Machine Learning',
      'Cybersecurity',
      'Cloud Computing',
      'Data Science',
      'Blockchain',
      'Computer Basics',
    ],
  },
  'Fitness & Wellness': {
    subcategories: [
      'Gym Training',
      'Weight Loss',
      'Strength Training',
      'Yoga',
      'Meditation',
      'Running',
      'Home Workout',
      'Personal Training',
      'Nutrition Basics',
      'Flexibility',
      'Pilates',
      'Sports Fitness',
    ],
  },
  'Languages': {
    subcategories: [
      'English',
      'Hindi',
      'Urdu',
      'Arabic',
      'French',
      'Spanish',
      'German',
      'Italian',
      'Chinese',
      'Japanese',
      'Korean',
      'Sign Language',
    ],
  },
  'Music': {
    subcategories: [
      'Singing',
      'Guitar',
      'Piano',
      'Keyboard',
      'Drums',
      'Tabla',
      'Violin',
      'Flute',
      'Music Production',
      'DJ',
      'Beat Making',
      'Songwriting',
    ],
  },
  'Cooking': {
    subcategories: [
      'Indian Cooking',
      'Mughlai Cooking',
      'Baking',
      'Desserts',
      'Continental',
      'Chinese',
      'Italian',
      'Healthy Cooking',
      'Vegetarian Cooking',
      'Non-Vegetarian Cooking',
      'Cake Making',
      'Street Food',
    ],
  },
  'Business': {
    subcategories: [
      'Entrepreneurship',
      'Startup Building',
      'Business Strategy',
      'E-commerce',
      'Business Planning',
      'Sales',
      'Customer Service',
      'Operations',
      'Leadership',
      'Negotiation',
      'Business Management',
      'Import & Export',
    ],
  },
  'Photography & Video': {
    subcategories: [
      'Mobile Photography',
      'Portrait Photography',
      'Product Photography',
      'Wedding Photography',
      'Travel Photography',
      'Videography',
      'Video Editing',
      'Cinematography',
      'Lightroom',
      'Photoshop',
      'Reels',
      'YouTube Video Production',
    ],
  },
  'Health & Life': {
    subcategories: [
      'First Aid',
      'Mental Wellness',
      'Healthy Lifestyle',
      'Sleep Management',
      'Stress Management',
      'Child Care',
      'Elder Care',
      'Basic Healthcare',
      'Personal Hygiene',
      'Healthy Habits',
      'Life Balance',
    ],
  },
  'Professional Skills': {
    subcategories: [
      'Microsoft Excel',
      'PowerPoint',
      'Word',
      'Google Workspace',
      'Data Entry',
      'Project Management',
      'Communication',
      'Presentation Skills',
      'Public Speaking',
      'Time Management',
      'Team Management',
      'Office Skills',
    ],
  },
  'Education & Teaching': {
    subcategories: [
      'School Tutoring',
      'Mathematics',
      'Science',
      'Physics',
      'Chemistry',
      'Biology',
      'History',
      'Geography',
      'Online Teaching',
      'Teaching Methods',
      'Exam Preparation',
      'Homework Help',
    ],
  },
  'Marketing & Sales': {
    subcategories: [
      'Digital Marketing',
      'Social Media Marketing',
      'SEO',
      'SEM',
      'Content Marketing',
      'Email Marketing',
      'Facebook Ads',
      'Instagram Marketing',
      'Google Ads',
      'Sales',
      'Lead Generation',
      'Branding',
    ],
  },
  'Finance & Accounting': {
    subcategories: [
      'Personal Finance',
      'Budgeting',
      'Investing Basics',
      'Stock Market',
      'Mutual Funds',
      'Accounting',
      'Tally',
      'GST Basics',
      'Tax Basics',
      'Financial Planning',
      'Business Finance',
      'Excel for Finance',
    ],
  },
  'Design & Creative': {
    subcategories: [
      'Graphic Design',
      'UI Design',
      'UX Design',
      'Logo Design',
      'Canva',
      'Photoshop',
      'Illustrator',
      'Figma',
      'Animation',
      '3D Design',
      'Motion Graphics',
      'Interior Design',
    ],
  },
  'Writing & Communication': {
    subcategories: [
      'Creative Writing',
      'Copywriting',
      'Content Writing',
      'Blogging',
      'Script Writing',
      'Storytelling',
      'English Writing',
      'Business Writing',
      'Resume Writing',
      'Email Writing',
      'Public Speaking',
      'Interview Skills',
    ],
  },
  'Personal Development': {
    subcategories: [
      'Confidence Building',
      'Leadership',
      'Communication',
      'Time Management',
      'Productivity',
      'Goal Setting',
      'Decision Making',
      'Critical Thinking',
      'Problem Solving',
      'Personality Development',
      'Interview Preparation',
      'Networking',
    ],
  },
  'Sports & Games': {
    subcategories: [
      'Cricket',
      'Football',
      'Basketball',
      'Tennis',
      'Badminton',
      'Table Tennis',
      'Chess',
      'Carrom',
      'Swimming',
      'Cycling',
      'Running',
      'Martial Arts',
    ],
  },
  'DIY & Home Skills': {
    subcategories: [
      'Home Repair',
      'Plumbing Basics',
      'Electrical Basics',
      'Carpentry',
      'Gardening',
      'Home Decoration',
      'Furniture Making',
      'Painting',
      'Sewing',
      'Basic Mechanics',
      'Car Maintenance',
      'Bike Maintenance',
    ],
  },
  'Career & Jobs': {
    subcategories: [
      'Resume Building',
      'Interview Preparation',
      'Career Guidance',
      'LinkedIn',
      'Freelancing',
      'Remote Work',
      'Job Search',
      'Career Switching',
      'Internship Guidance',
      'Government Jobs',
      'Corporate Jobs',
      'Portfolio Building',
    ],
  },
  'Other / Miscellaneous': {
    subcategories: [
      'Astrology',
      'Dance',
      'Makeup',
      'Fashion',
      'Beauty',
      'Travel Planning',
      'Driving',
      'Pet Care',
      'Photography',
      'Event Planning',
      'Public Relations',
      'Other Skills',
    ],
  },
};

const MAIN_CATEGORIES = Object.keys(CATEGORY_STRUCTURE);

const CATEGORY_IMAGES = {
  'Arts & Crafts': 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
  'Technology': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
  'Fitness & Wellness': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
  'Languages': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800',
  'Music': 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800',
  'Cooking': 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800',
  'Business': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
  'Photography & Video': 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800',
  'Health & Life': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
  'Professional Skills': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
  'Education & Teaching': 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
  'Marketing & Sales': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
  'Finance & Accounting': 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
  'Design & Creative': 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
  'Writing & Communication': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800',
  'Personal Development': 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800',
  'Sports & Games': 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800',
  'DIY & Home Skills': 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800',
  'Career & Jobs': 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800',
  'Other / Miscellaneous': 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
};

function findCategoryForSubcategory(subcategory) {
  for (const [category, data] of Object.entries(CATEGORY_STRUCTURE)) {
    if (data.subcategories.includes(subcategory)) {
      return category;
    }
  }
  return null;
}

function getCategoryImageUrl(categoryOrSubcategory) {
  if (!categoryOrSubcategory) {
    return CATEGORY_IMAGES['Technology'];
  }
  if (CATEGORY_IMAGES[categoryOrSubcategory]) {
    return CATEGORY_IMAGES[categoryOrSubcategory];
  }
  const parentCat = findCategoryForSubcategory(categoryOrSubcategory);
  if (parentCat && CATEGORY_IMAGES[parentCat]) {
    return CATEGORY_IMAGES[parentCat];
  }
  return CATEGORY_IMAGES['Other / Miscellaneous'];
}

module.exports = {
  CATEGORY_STRUCTURE,
  MAIN_CATEGORIES,
  CATEGORY_IMAGES,
  findCategoryForSubcategory,
  getCategoryImageUrl,
  getSubcategoriesForCategory: (cat) => CATEGORY_STRUCTURE[cat]?.subcategories || [],
};
