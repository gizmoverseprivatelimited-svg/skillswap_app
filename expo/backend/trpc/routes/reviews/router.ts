import { createTRPCRouter, publicProcedure } from "../../create-context";
import { z } from "zod";
import { reviewStore } from "./store";
import type { RatingBucket } from "../../../../types";

const createDistribution = (): Record<RatingBucket, number> => {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
};

export const reviewsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        revieweeId: z.string().min(1),
        skillId: z.string().optional(),
      })
    )
    .query(({ input }) => {
      const payload = reviewStore.listForUser(input.revieweeId);
      if (input.skillId) {
        const filteredReviews = payload.reviews.filter((review) => review.skillId === input.skillId);
        const total = filteredReviews.length;
        const sum = filteredReviews.reduce((acc, review) => acc + review.rating, 0);
        const average = total === 0 ? 0 : parseFloat((sum / total).toFixed(2));
        const distribution = createDistribution();
        filteredReviews.forEach((review) => {
          const bucket = review.rating as RatingBucket;
          distribution[bucket] = distribution[bucket] + 1;
        });
        return {
          stats: {
            ...payload.stats,
            averageRating: average,
            totalReviews: total,
            distribution,
          },
          reviews: filteredReviews,
        };
      }
      return payload;
    }),
  create: publicProcedure
    .input(
      z.object({
        reviewerId: z.string().min(1),
        revieweeId: z.string().min(1),
        rating: z.number().min(1).max(5),
        comment: z.string().min(10),
        skillId: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      if (input.reviewerId === input.revieweeId) {
        throw new Error("You cannot review yourself");
      }
      const review = reviewStore.createReview(input);
      const refreshed = reviewStore.listForUser(input.revieweeId);
      return {
        review,
        stats: refreshed.stats,
      };
    }),
  report: publicProcedure
    .input(
      z.object({
        reviewId: z.string().min(1),
        reporterId: z.string().min(1),
        reason: z.string().min(6),
      })
    )
    .mutation(({ input }) => {
      const review = reviewStore.reportReview(input);
      const refreshed = reviewStore.listForUser(review.revieweeId);
      return {
        review,
        stats: refreshed.stats,
      };
    }),
});
