import type { MatchRecommendation, OnboardingRole, SkillCategory, User } from '../types';

const unique = (values: string[]): string[] => {
  return Array.from(new Set(values));
};

/** Derive a user's role from their skills. Falls back to explicit role field, then 'swap'. */
export const getUserRole = (user: User): OnboardingRole => {
  if (user.role) return user.role;
  const offers = user.skillsOffered.length > 0;
  const wants = user.skillsWanted.length > 0;
  if (offers && !wants) return 'teacher';
  if (wants && !offers) return 'learner';
  return 'swap';
};

const clampCompatibility = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
};

const computeCompatibilityScore = (
  youCanLearnCount: number,
  theyCanLearnCount: number,
  sharedInterestsCount: number,
  rating: number,
  swaps: number,
  categoryMatchesCount: number,
): number => {
  const teachWeight = youCanLearnCount * 28;
  const learnWeight = theyCanLearnCount * 22;
  const interestWeight = sharedInterestsCount * 8;
  const ratingWeight = (rating / 5) * 18;
  const swapsWeight = Math.min(swaps, 40) / 40 * 12;
  const categoryWeight = categoryMatchesCount * 5;
  const rawScore = teachWeight + learnWeight + interestWeight + ratingWeight + swapsWeight + categoryWeight;
  return clampCompatibility(rawScore);
};

const findMatches = (sources: string[], targets: string[]): string[] => {
  const normalizedTargets = unique(
    targets
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
  const matches = new Set<string>();

  sources.forEach((source) => {
    const normalizedSource = source.trim().toLowerCase();
    if (normalizedSource.length === 0) {
      return;
    }

    normalizedTargets.forEach((target) => {
      if (
        normalizedSource === target ||
        normalizedSource.includes(target) ||
        target.includes(normalizedSource)
      ) {
        matches.add(source);
      }
    });
  });

  return Array.from(matches);
};

export const computeMatchRecommendations = (
  currentUser: User,
  otherUsers: User[],
): MatchRecommendation[] => {
  const currentOffers = currentUser.skillsOffered.map((skill) => skill.title);
  const currentOfferCategories = currentUser.skillsOffered.map((skill) => skill.category);
  const currentWants = currentUser.skillsWanted;

  const recommendations = otherUsers.map<MatchRecommendation>((user) => {
    const userOffersRaw = user.skillsOffered.map((skill) => skill.title);
    const userOfferCategories = user.skillsOffered.map((skill) => skill.category);
    const userWants = user.skillsWanted;

    const youCanLearn = unique(findMatches(userOffersRaw, currentWants));
    const theyCanLearn = unique(findMatches(currentOffers, userWants));
    const sharedInterests = unique(findMatches(currentWants, userWants));
    const categoryMatches = unique(
      currentOfferCategories
        .filter((category) => userOfferCategories.includes(category))
        .map((category) => category),
    ) as SkillCategory[];

    const compatibility = computeCompatibilityScore(
      youCanLearn.length,
      theyCanLearn.length,
      sharedInterests.length,
      user.rating,
      user.totalSwaps,
      categoryMatches.length,
    );

    const primarySkill = youCanLearn[0] ?? theyCanLearn[0] ?? null;

    console.log('[Matching] Recommendation generated', {
      currentUserId: currentUser.id,
      targetUserId: user.id,
      compatibility,
      youCanLearnCount: youCanLearn.length,
      theyCanLearnCount: theyCanLearn.length,
      sharedInterestsCount: sharedInterests.length,
      categoryMatchesCount: categoryMatches.length,
    });

    return {
      user,
      compatibility,
      youCanLearn,
      theyCanLearn,
      sharedInterests,
      categoryMatches,
      primarySkill,
    };
  });

  return recommendations
    .filter((recommendation) => recommendation.compatibility > 0)
    .sort((a, b) => b.compatibility - a.compatibility);
};
