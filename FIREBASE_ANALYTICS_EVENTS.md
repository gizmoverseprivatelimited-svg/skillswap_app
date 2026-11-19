# Firebase Analytics Events & Tracking Documentation

Ye document Leteski app me implement kiye gaye sabhi Firebase Analytics events, screen views, aur unke exact parameters ka complete reference hai.

---

## 📊 Summary Table

| Event Name | Trigger Point | Parameters | Type | Example Values | File Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`screen_view`** | React Navigation / Expo Router me jab user nayi screen par jata hai | `screen_name`<br>`screen_class` | `string`<br>`string` | `'Home'`, `'class/123'`, `'swaps/456'` | [app/_layout.tsx](file:///c:/Users/Acer/Desktop/newly/app/_layout.tsx) |
| **`sign_up`** | Naya user account create hone par | `method` | `string` | `'email'`, `'google'`, `'otp'` | [providers/auth.tsx](file:///c:/Users/Acer/Desktop/newly/providers/auth.tsx) |
| **`login`** | Existing user login hone par | `method` | `string` | `'email'`, `'google'`, `'otp'` | [providers/auth.tsx](file:///c:/Users/Acer/Desktop/newly/providers/auth.tsx) |
| **`course_view`** | User kisi bhi class/course ka detail page open kare | `course_id`<br>`course_name` | `string`<br>`string` | `course_id: 'c123'`<br>`course_name: 'Photoshop Basics'` | [app/class/[id].tsx](file:///c:/Users/Acer/Desktop/newly/app/class/[id].tsx) |
| **`course_purchase`** | User kisi class/course me enroll / purchase kare | `course_id`<br>`value`<br>`currency` | `string`<br>`number`<br>`string` | `course_id: 'c123'`<br>`value: 15`<br>`currency: 'INR'` | [providers/classes.tsx](file:///c:/Users/Acer/Desktop/newly/providers/classes.tsx) |
| **`skill_swap_request`** | User jab swap request submit karta hai | `skill_offered`<br>`skill_wanted` | `string`<br>`string` | `skill_offered: 'Guitar Lessons'`<br>`skill_wanted: 'Web Development'` | [components/SkillSwapRequestModal.tsx](file:///c:/Users/Acer/Desktop/newly/components/SkillSwapRequestModal.tsx) |
| **`sign_out`** | User jab logout karta hai | _None_ (Resets User ID) | - | - | [providers/auth.tsx](file:///c:/Users/Acer/Desktop/newly/providers/auth.tsx) |

---

## 🔍 Detailed Event Breakdown

### 1. Screen Tracking (`logScreenView`)
- **Trigger**: Har route/screen change hone par (`useEffect` with `routeNameRef` per `https://rnfirebase.io/analytics/screen-tracking`).
- **File**: [app/_layout.tsx](file:///c:/Users/Acer/Desktop/newly/app/_layout.tsx)
- **Parameters**:
  ```ts
  {
    screen_name: string,  // Current route pathname (e.g. "(tabs)/home", "class/[id]")
    screen_class: string  // Screen class identifier
  }
  ```
- **Code**:
  ```ts
  const routeNameRef = React.useRef<string | null>(null);
  useEffect(() => {
    const currentRouteName = pathname || (segments.length > 0 ? segments.join('/') : 'Home');
    if (routeNameRef.current !== currentRouteName) {
      routeNameRef.current = currentRouteName;
      logScreenView(currentRouteName);
    }
  }, [pathname, segments]);
  ```

---

### 2. User Sign Up (`sign_up`)
- **Trigger**: Jab naya user email, Google OAuth, ya OTP se account banata hai.
- **File**: [providers/auth.tsx](file:///c:/Users/Acer/Desktop/newly/providers/auth.tsx)
- **Parameters**:
  ```ts
  {
    method: 'email' | 'google' | 'otp'
  }
  ```
- **Code**:
  ```ts
  await analytics().logSignUp({ method: 'email' });
  ```

---

### 3. User Login (`login`)
- **Trigger**: Jab user email/password, Google OAuth, ya OTP se sign-in karta hai.
- **File**: [providers/auth.tsx](file:///c:/Users/Acer/Desktop/newly/providers/auth.tsx)
- **Parameters**:
  ```ts
  {
    method: 'email' | 'google' | 'otp'
  }
  ```
- **Code**:
  ```ts
  await analytics().logLogin({ method: 'email' });
  ```

---

### 4. Course View (`course_view`)
- **Trigger**: Jab user kisi course/class ka page view karta hai.
- **File**: [app/class/[id].tsx](file:///c:/Users/Acer/Desktop/newly/app/class/[id].tsx)
- **Parameters**:
  ```ts
  {
    course_id: string,   // e.g. "cls-1731234567"
    course_name: string  // e.g. "Photoshop Basics"
  }
  ```
- **Code**:
  ```ts
  await analytics().logEvent('course_view', {
    course_id: cls.id,
    course_name: cls.title,
  });
  ```

---

### 5. Course Purchase / Enrollment (`course_purchase`)
- **Trigger**: Jab user kisi course me enroll ya pay karta hai.
- **File**: [providers/classes.tsx](file:///c:/Users/Acer/Desktop/newly/providers/classes.tsx) (`enrollInClass`)
- **Parameters**:
  ```ts
  {
    course_id: string,   // Course / Class unique ID
    value: number,       // Credits / Price spent (e.g. 15)
    currency: 'INR'      // Default currency: INR
  }
  ```
- **Code**:
  ```ts
  await logCoursePurchase(cls.id, cost, 'INR');
  // OR
  await analytics().logEvent('course_purchase', {
    course_id: cls.id,
    value: cost,
    currency: 'INR',
  });
  ```

---

### 6. Skill Swap Request (`skill_swap_request`)
- **Trigger**: Jab user swap request modal se request successfully submit karta hai.
- **File**: [components/SkillSwapRequestModal.tsx](file:///c:/Users/Acer/Desktop/newly/components/SkillSwapRequestModal.tsx)
- **Parameters**:
  ```ts
  {
    skill_offered: string,  // Title of the skill offered (e.g. 'Guitar Basics', ya 'Credits' if learner)
    skill_wanted: string    // Title of the skill wanted (e.g. 'Python Programming', ya 'Credits' if teacher)
  }
  ```
- **Code**:
  ```ts
  const offeredSkill = swapType === 'learn' ? 'Credits' : (activeMySkill?.title || 'Skill');
  const wantedSkill = swapType === 'teach' ? 'Credits' : (activePartnerSkill?.title || skill.title || 'Skill');

  await logSkillSwapRequest(offeredSkill, wantedSkill);
  // OR
  await analytics().logEvent('skill_swap_request', {
    skill_offered: offeredSkill,
    skill_wanted: wantedSkill,
  });
  ```

---

## 👤 User Identity & Properties Tracking

Jab user login hota hai, analytics me automatically user identify hota hai taaki sabhi events user profile ke sath link rahein:

| Property | Value | Kaha Set Hota Hai |
| :--- | :--- | :--- |
| **`userId`** | User ka unique ID (`user.id`) | [app/_layout.tsx](file:///c:/Users/Acer/Desktop/newly/app/_layout.tsx) |
| **`user_role`** | Role jaise `'admin'`, `'member'`, `'teacher'` | [app/_layout.tsx](file:///c:/Users/Acer/Desktop/newly/app/_layout.tsx) |
| **Clear User** | `null` on logout | [providers/auth.tsx](file:///c:/Users/Acer/Desktop/newly/providers/auth.tsx) (`signOut`) |

---

## 🛠️ Usage Cheat-Sheet

```ts
import analytics, {
  logCourseView,
  logCoursePurchase,
  logSkillSwapRequest,
  logLogin,
  logSignUp,
  logScreenView,
  setUserId,
  setUserProperty
} from '@/lib/analytics';

// 1. Direct logEvent format (jaise documentation me hota hai):
await analytics().logEvent('course_view', {
  course_id: 'c123',
  course_name: 'Photoshop Basics',
});

// 2. Direct helper format:
await logCourseView('c123', 'Photoshop Basics');
await logCoursePurchase('c123', 500, 'INR');
await logSkillSwapRequest('Photoshop', 'Video Editing');
```
