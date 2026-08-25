import type { SkillSwapRequest, GroupClass, User, Skill } from '@/types';

// ============================================================
//  leteski Certificate System
// ============================================================

export type CertificateType = 'swap_completion' | 'class_teaching' | 'class_completion';

export interface CertificateData {
  id: string;
  type: CertificateType;
  recipientName: string;
  skillTitle: string;
  skillCategory: string;
  skillLevel: string;
  partnerName: string;
  completedAt: string;
  certificateNumber: string;
  /** "teacher" if user taught, "learner" if user learned */
  role: 'teacher' | 'learner';
  sessionId: string;
}

const CERT_PREFIX = 'LTRN-';

export function generateCertificateNumber(seed: string = 'default'): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const posHash = Math.abs(hash);
  const part1 = ((posHash % 900000) + 100000).toString();
  const part2 = (((Math.abs(hash >> 5)) % 9000) + 1000).toString();
  return `${CERT_PREFIX}${part1}-${part2}`;
}

export function buildSwapCertificates(
  swaps: SkillSwapRequest[],
  currentUser: User | null | undefined,
  allUsers: User[],
  skills?: Skill[],
): CertificateData[] {
  if (!currentUser) return [];
  return swaps
    .filter(s => s.status === 'completed')
    .map(swap => {
      const isRequester = String(swap.requesterId) === String(currentUser.id);
      const partnerId = isRequester ? swap.recipientId : swap.requesterId;
      const partner = allUsers.find(u => String(u.id) === String(partnerId) || String((u as any)._id) === String(partnerId));
      const recipientSkillId = isRequester ? swap.recipientSkillId : swap.requesterSkillId;
      const taughtSkill = skills?.find(sk => String(sk.id) === String(recipientSkillId) || String((sk as any)._id) === String(recipientSkillId));

      const fallbackTitle = swap.id === 'swap-completed-1'
        ? 'Hindi Conversation'
        : swap.id === 'swap-completed-2'
        ? 'Portrait Photography'
        : 'Skill Session';

      const certId = `cert-swap-${swap.id}`;

      return {
        id: certId,
        type: 'swap_completion' as CertificateType,
        recipientName: currentUser.name || 'Student',
        skillTitle: taughtSkill?.title ?? (swap as any).skillTitle ?? fallbackTitle,
        skillCategory: taughtSkill?.category ?? (swap as any).skillCategory ?? 'General',
        skillLevel: taughtSkill?.level ?? (swap as any).skillLevel ?? 'Intermediate',
        partnerName: partner?.name ?? (swap as any).partnerName ?? 'leteski Member',
        completedAt: swap.updatedAt || swap.createdAt || new Date().toISOString(),
        certificateNumber: generateCertificateNumber(`swap-${swap.id}-${currentUser.id}`),
        role: (isRequester ? 'learner' : 'teacher') as 'teacher' | 'learner',
        sessionId: swap.id,
      };
    });
}

export function buildClassCertificates(
  classes: GroupClass[],
  enrollments: { classId: string; studentId: string; status: string }[],
  currentUser: User | null | undefined,
  allUsers: User[],
): CertificateData[] {
  if (!currentUser) return [];
  const certs: CertificateData[] = [];

  for (const cls of classes) {
    if (cls.status !== 'completed') continue;

    // Teacher certificate
    if (String(cls.teacherId) === String(currentUser.id)) {
      const attendedCount = Array.isArray(enrollments) ? enrollments.filter(
        e => String(e.classId) === String(cls.id) && e.status === 'attended',
      ).length : 0;
      certs.push({
        id: `cert-class-teach-${cls.id}`,
        type: 'class_teaching' as CertificateType,
        recipientName: currentUser.name,
        skillTitle: cls.title,
        skillCategory: cls.category,
        skillLevel: cls.level,
        partnerName: `${attendedCount} student${attendedCount === 1 ? '' : 's'}`,
        completedAt: cls.endISO,
        certificateNumber: generateCertificateNumber(`class-teach-${cls.id}-${currentUser.id}`),
        role: 'teacher' as const,
        sessionId: cls.id,
      });
    }

    // Student certificate (if attended)
    const myEnrollment = Array.isArray(enrollments) ? enrollments.find(
      e => String(e.classId) === String(cls.id) && String(e.studentId) === String(currentUser.id) && e.status === 'attended',
    ) : null;
    if (myEnrollment) {
      const teacher = allUsers.find(u => String(u.id) === String(cls.teacherId) || String((u as any)._id) === String(cls.teacherId));
      certs.push({
        id: `cert-class-learn-${cls.id}`,
        type: 'class_completion' as CertificateType,
        recipientName: currentUser.name,
        skillTitle: cls.title,
        skillCategory: cls.category,
        skillLevel: cls.level,
        partnerName: teacher?.name ?? 'leteski Instructor',
        completedAt: cls.endISO,
        certificateNumber: generateCertificateNumber(`class-learn-${cls.id}-${currentUser.id}`),
        role: 'learner' as const,
        sessionId: cls.id,
      });
    }
  }

  return certs;
}

const typeLabels: Record<CertificateType, { title: string; subtitle: string }> = {
  swap_completion: {
    title: 'Certificate of Skill Exchange',
    subtitle: 'Skill Swap Completion',
  },
  class_teaching: {
    title: 'Certificate of Teaching Excellence',
    subtitle: 'Group Class Instruction',
  },
  class_completion: {
    title: 'Certificate of Completion',
    subtitle: 'Group Class Attended',
  },
};

export function getCertificateLabel(type: CertificateType) {
  return typeLabels[type];
}

export function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================================
//  HTML Certificate — for download/share
// ============================================================

export function generateCertificateHTML(cert: CertificateData): string {
  const label = getCertificateLabel(cert.type);
  const dateStr = formatDate(cert.completedAt);
  const roleText = cert.role === 'teacher' ? 'successfully taught' : 'successfully completed';
  const partnerLabel = cert.role === 'teacher' ? 'Students' : 'Instructor';
  const partnerVerification = cert.role === 'teacher' ? 'Verified by Students' : 'Verified by Instructor';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>leteski Certificate — ${cert.recipientName} — ${cert.skillTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600&display=swap" rel="stylesheet">
<style>
  :root {
    --primary: #6366F1;
    --primary-dark: #4F46E5;
    --primary-light: #818CF8;
    --accent: #F59E0B;
    --text-dark: #0F172A;
    --text-body: #334155;
    --text-muted: #64748B;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0B0F19;
    color: var(--text-dark);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: clamp(12px, 3vw, 32px);
  }

  /* Action toolbar for browser viewing */
  .toolbar {
    width: 100%;
    max-width: 860px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .toolbar-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #FFFFFF;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.3px;
  }
  .toolbar-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #A5B4FC;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }
  .btn-print {
    background: linear-gradient(135deg, #6366F1, #4F46E5);
    color: #FFFFFF;
    border: none;
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
    transition: all 0.2s ease;
  }
  .btn-print:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.45);
  }

  /* Main Certificate Container */
  .cert-wrapper {
    width: 100%;
    max-width: 860px;
    position: relative;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
    border-radius: clamp(16px, 3vw, 24px);
    overflow: hidden;
  }
  .cert-container {
    background: linear-gradient(135deg, #FFFFFF 0%, #FFFDF9 40%, #FFF7ED 100%);
    position: relative;
    padding: clamp(24px, 5vw, 56px);
    text-align: center;
  }

  /* Double decorative border */
  .border-frame {
    position: absolute;
    top: clamp(10px, 2vw, 18px);
    left: clamp(10px, 2vw, 18px);
    right: clamp(10px, 2vw, 18px);
    bottom: clamp(10px, 2vw, 18px);
    border: 2px solid #6366F1;
    border-radius: clamp(10px, 2vw, 16px);
    pointer-events: none;
  }
  .corner {
    position: absolute;
    width: clamp(24px, 4vw, 36px);
    height: clamp(24px, 4vw, 36px);
    border: 3px solid #F59E0B;
    pointer-events: none;
    z-index: 2;
  }
  .corner-tl { top: clamp(10px, 2vw, 18px); left: clamp(10px, 2vw, 18px); border-right: none; border-bottom: none; border-top-left-radius: clamp(10px, 2vw, 16px); }
  .corner-tr { top: clamp(10px, 2vw, 18px); right: clamp(10px, 2vw, 18px); border-left: none; border-bottom: none; border-top-right-radius: clamp(10px, 2vw, 16px); }
  .corner-bl { bottom: clamp(10px, 2vw, 18px); left: clamp(10px, 2vw, 18px); border-right: none; border-top: none; border-bottom-left-radius: clamp(10px, 2vw, 16px); }
  .corner-br { bottom: clamp(10px, 2vw, 18px); right: clamp(10px, 2vw, 18px); border-left: none; border-top: none; border-bottom-right-radius: clamp(10px, 2vw, 16px); }

  /* Content Elements */
  .content {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .logo-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .logo-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #F59E0B;
  }
  .logo-text {
    font-size: clamp(18px, 3vw, 24px);
    font-weight: 800;
    color: #6366F1;
    letter-spacing: -0.5px;
  }
  .subtitle-top {
    font-size: clamp(9px, 1.6vw, 11px);
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: clamp(14px, 3vw, 24px);
  }
  .cert-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(22px, 4.5vw, 36px);
    font-weight: 800;
    color: var(--text-dark);
    line-height: 1.25;
    margin-bottom: 6px;
  }
  .cert-subtitle {
    font-size: clamp(10px, 1.8vw, 12px);
    color: #6366F1;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: clamp(18px, 3.5vw, 30px);
  }
  .presented-to {
    font-size: clamp(10px, 1.8vw, 12px);
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .recipient-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(24px, 5.5vw, 42px);
    font-weight: 700;
    color: var(--text-dark);
    line-height: 1.2;
    margin-bottom: 4px;
  }
  .name-underline {
    width: min(240px, 60%);
    height: 2px;
    background: #E2E8F0;
    margin-bottom: clamp(16px, 3vw, 24px);
    border-radius: 2px;
  }
  .body-text {
    font-size: clamp(13px, 2.2vw, 16px);
    color: var(--text-body);
    line-height: 1.65;
    max-width: 580px;
    margin: 0 auto clamp(6px, 1.5vw, 10px);
  }
  .body-text strong {
    color: var(--text-dark);
  }
  .body-text .skill-highlight {
    color: #6366F1;
    font-weight: 700;
  }
  .body-text .partner-highlight {
    color: var(--text-dark);
    font-weight: 700;
  }

  /* Meta Row */
  .meta-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: clamp(12px, 3vw, 28px);
    margin: clamp(18px, 3.5vw, 30px) 0;
    flex-wrap: wrap;
    width: 100%;
  }
  .meta-card {
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  }
  .meta-card svg {
    width: 16px;
    height: 16px;
    color: #64748B;
    flex-shrink: 0;
  }
  .meta-info {
    text-align: left;
  }
  .meta-label {
    font-size: 9px;
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .meta-value {
    font-size: 13px;
    color: var(--text-dark);
    font-weight: 700;
  }

  /* Signatures & Seal Section */
  .signatures-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 620px;
    margin-top: clamp(14px, 3vw, 24px);
    gap: 16px;
  }
  .sig-block {
    flex: 1;
    text-align: center;
    min-width: 100px;
  }
  .sig-line {
    width: 100%;
    max-width: 150px;
    border-top: 1.5px solid #334155;
    margin: 0 auto 6px;
  }
  .sig-name {
    font-size: clamp(11px, 2vw, 13px);
    font-weight: 700;
    color: var(--text-dark);
  }
  .sig-title {
    font-size: clamp(9px, 1.5vw, 11px);
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* Seal */
  .seal {
    width: clamp(48px, 8vw, 64px);
    height: clamp(48px, 8vw, 64px);
    border-radius: 50%;
    background: linear-gradient(135deg, #6366F1, #4338CA);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFFFFF;
    font-size: clamp(20px, 3.5vw, 28px);
    font-weight: 800;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
    border: 3px solid #FFFFFF;
    outline: 2px solid #F59E0B;
    flex-shrink: 0;
  }

  /* Footer */
  .cert-footer {
    margin-top: clamp(18px, 3.5vw, 28px);
    padding-top: 14px;
    border-top: 1px solid #E2E8F0;
    width: 100%;
    text-align: center;
  }
  .cert-number {
    font-size: clamp(9px, 1.6vw, 11px);
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .company-name {
    font-size: clamp(10px, 1.7vw, 12px);
    color: var(--text-muted);
    font-weight: 600;
  }
  .company-sub {
    font-size: clamp(8px, 1.4vw, 10px);
    color: #94A3B8;
    margin-top: 2px;
  }

  /* Print Stylesheet */
  @media print {
    @page {
      size: landscape A4;
      margin: 8mm;
    }
    body {
      background: #FFFFFF !important;
      padding: 0 !important;
      min-height: auto !important;
      display: block !important;
    }
    .toolbar {
      display: none !important;
    }
    .cert-wrapper {
      max-width: 100% !important;
      box-shadow: none !important;
      border-radius: 12px !important;
      page-break-inside: avoid;
    }
    .cert-container {
      padding: 32px !important;
    }
  }
</style>
</head>
<body>

  <!-- Floating browser actions bar (hidden during print) -->
  <div class="toolbar">
    <div class="toolbar-brand">
      <span>leteski Verified Certificate</span>
      <span class="toolbar-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Authentic
      </span>
    </div>
    <button class="btn-print" onclick="window.print()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      Print / Save as PDF
    </button>
  </div>

  <div class="cert-wrapper">
    <div class="cert-container">
      <!-- Decorative Borders & Corners -->
      <div class="border-frame"></div>
      <div class="corner corner-tl"></div>
      <div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div>
      <div class="corner corner-br"></div>

      <div class="content">
        <!-- Logo -->
        <div class="logo-row">
          <div class="logo-dot"></div>
          <div class="logo-text">leteski</div>
          <div class="logo-dot"></div>
        </div>
        <div class="subtitle-top">Skill Exchange Platform</div>

        <!-- Title & Subtitle -->
        <h1 class="cert-title">${label.title}</h1>
        <div class="cert-subtitle">${label.subtitle}</div>

        <!-- Recipient -->
        <div class="presented-to">This certificate is proudly presented to</div>
        <div class="recipient-name">${cert.recipientName}</div>
        <div class="name-underline"></div>

        <!-- Body Text -->
        <p class="body-text">
          For having <strong>${roleText}</strong> the skill <span class="skill-highlight">${cert.skillTitle}</span> (${cert.skillLevel} level) in the category of ${cert.skillCategory}.
        </p>
        <p class="body-text">
          ${partnerLabel}: <span class="partner-highlight">${cert.partnerName}</span>
        </p>

        <!-- Meta badges -->
        <div class="meta-row">
          <div class="meta-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <div class="meta-info">
              <div class="meta-label">Date</div>
              <div class="meta-value">${dateStr}</div>
            </div>
          </div>
          <div class="meta-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <div class="meta-info">
              <div class="meta-label">Level</div>
              <div class="meta-value">${cert.skillLevel}</div>
            </div>
          </div>
          <div class="meta-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
            <div class="meta-info">
              <div class="meta-label">Verified</div>
              <div class="meta-value">Yes</div>
            </div>
          </div>
        </div>

        <!-- Signatures & Seal -->
        <div class="signatures-section">
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-name">leteski</div>
            <div class="sig-title">Platform</div>
          </div>
          <div class="seal">L</div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-name">${cert.partnerName}</div>
            <div class="sig-title">${partnerVerification}</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="cert-footer">
          <div class="cert-number">Certificate No: ${cert.certificateNumber}</div>
          <div class="company-name">Gizmoverse Private Limited</div>
          <div class="company-sub">leteski is a product of Gizmoverse Private Limited • Verified Digital Credential</div>
        </div>
      </div>
    </div>
  </div>

</body>
</html>`;
}
