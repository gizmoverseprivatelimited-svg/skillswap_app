import { randomUUID } from "crypto";
import { mockUsers } from "../../../../mocks/data";
import type {
  RatingBucket,
  Review,
  ReviewStats,
  ReviewWithAuthor,
  ReviewsPayload,
  User,
} from "../../../../types";

const createDistribution = (): Record<RatingBucket, number> => {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
};

const findUser = (id: string): User | undefined => {
  return mockUsers.find((user) => user.id === id);
};

const seedReviews: Review[] = [
  {
    id: randomUUID(),
    reviewerId: "2",
    revieweeId: "1",
    rating: 5,
    comment: "Emma delivered an incredible photography crash course. She tailored the session to my level and shared actionable tips I used immediately.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    skillId: "1",
  },
  {
    id: randomUUID(),
    reviewerId: "3",
    revieweeId: "1",
    rating: 4,
    comment: "Great energy and clear explanations. We spent extra time practicing portrait lighting setups which was super helpful.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    skillId: "1",
  },
  {
    id: randomUUID(),
    reviewerId: "1",
    revieweeId: "2",
    rating: 5,
    comment: "Marcus showed me how to build a custom hook structure in React in under an hour. Loved the hands-on guidance.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    skillId: "3",
  },
  {
    id: randomUUID(),
    reviewerId: "4",
    revieweeId: "3",
    rating: 5,
    comment: "Sofia is the most engaging Spanish tutor I have ever had. We role-played real scenarios and she corrected me gently.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    skillId: "5",
  },
];

let reviews: Review[] = seedReviews;

const augmentReview = (review: Review): ReviewWithAuthor => {
  const reviewer = findUser(review.reviewerId);
  if (!reviewer) {
    throw new Error("Reviewer not found");
  }
  return {
    ...review,
    reviewer,
  };
};

const computeStats = (revieweeId: string): ReviewsPayload => {
  const relevant = reviews
    .filter((review) => review.revieweeId === revieweeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const distribution = createDistribution();
  let sum = 0;

  relevant.forEach((review) => {
    const bucket = review.rating as RatingBucket;
    distribution[bucket] = distribution[bucket] + 1;
    sum += review.rating;
  });

  const total = relevant.length;
  const average = total === 0 ? 0 : parseFloat((sum / total).toFixed(2));

  const stats: ReviewStats = {
    revieweeId,
    averageRating: average,
    totalReviews: total,
    distribution,
  };

  const enriched = relevant.map((review) => augmentReview(review));

  return {
    stats,
    reviews: enriched,
  };
};

export const reviewStore = {
  listForUser(revieweeId: string): ReviewsPayload {
    return computeStats(revieweeId);
  },
  createReview(params: {
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment: string;
    skillId?: string;
  }): ReviewWithAuthor {
    const reviewer = findUser(params.reviewerId);
    if (!reviewer) {
      throw new Error("Reviewer not found");
    }

    const reviewee = findUser(params.revieweeId);
    if (!reviewee) {
      throw new Error("Reviewee not found");
    }

    const trimmedComment = params.comment.trim();
    if (trimmedComment.length === 0) {
      throw new Error("Comment cannot be empty");
    }

    const ratingValue = Math.min(5, Math.max(1, Math.round(params.rating)));

    const newReview: Review = {
      id: randomUUID(),
      reviewerId: params.reviewerId,
      revieweeId: params.revieweeId,
      rating: ratingValue,
      comment: trimmedComment,
      createdAt: new Date().toISOString(),
      skillId: params.skillId,
      flaggedAt: null,
      flagReason: null,
      flagReporterId: null,
    };

    reviews = [newReview, ...reviews];

    console.log("[Reviews] Review created", {
      revieweeId: params.revieweeId,
      reviewerId: params.reviewerId,
      rating: ratingValue,
    });

    return augmentReview(newReview);
  },
  reportReview(params: {
    reviewId: string;
    reporterId: string;
    reason: string;
  }): ReviewWithAuthor {
    const reviewIndex = reviews.findIndex((review) => review.id === params.reviewId);
    if (reviewIndex === -1) {
      throw new Error("Review not found");
    }

    const updated: Review = {
      ...reviews[reviewIndex],
      flaggedAt: new Date().toISOString(),
      flagReason: params.reason.trim(),
      flagReporterId: params.reporterId,
    };

    reviews = [
      ...reviews.slice(0, reviewIndex),
      updated,
      ...reviews.slice(reviewIndex + 1),
    ];

    console.log("[Reviews] Review reported", {
      reviewId: params.reviewId,
      reporterId: params.reporterId,
      reason: params.reason,
    });

    return augmentReview(updated);
  },
};
