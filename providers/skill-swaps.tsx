import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { SkillSwapRequest, SkillSwapStatus, SwapMessage, SwapTimeProposal, SwapType } from '../types';
import { useCurrentUser } from './current-user';
import { useEarnings } from './earnings';
import url from '@/constants/backurl';
import { getSessionCreditCost, getTeacherSessionEarnings, LEARNER_SWAP_COMPLETION_BONUS, getPlatformFee } from '@/lib/payments';

interface CreateSwapRequestInput {
  recipientId: string;
  recipientSkillId: string;
  requesterSkillId?: string;
  swapType: SwapType;
  proposedTimes: { startISO: string; endISO: string }[];
  locationPreference: string | null;
  message?: string;
}

interface CounterProposalInput {
  requestId: string;
  proposerId: string;
  slots: { startISO: string; endISO: string }[];
  message?: string;
}

interface AcceptProposalInput {
  requestId: string;
  timeId: string;
  location?: string;
  note?: string;
}

interface DeclineSwapInput {
  requestId: string;
  note?: string;
}

interface UpdateLocationInput {
  requestId: string;
  location: string;
}

interface AddMessageInput {
  requestId: string;
  authorId: string;
  body: string;
  isSystem?: boolean;
}

interface SkillSwapsContextValue {
  swaps: SkillSwapRequest[];
  allSwaps: SkillSwapRequest[];
  pendingSwaps: SkillSwapRequest[];
  negotiatingSwaps: SkillSwapRequest[];
  scheduledSwaps: SkillSwapRequest[];
  declinedSwaps: SkillSwapRequest[];
  completedSwaps: SkillSwapRequest[];
  createSwapRequest: (input: CreateSwapRequestInput) => SkillSwapRequest | any;
  addCounterProposal: (input: CounterProposalInput) => void;
  acceptProposal: (input: AcceptProposalInput) => void;
  declineSlot: (input: { requestId: string; slotId: string }) => Promise<void>;
  declineSwap: (input: DeclineSwapInput) => void;
  updateLocation: (input: UpdateLocationInput) => void;
  addMessage: (input: AddMessageInput) => void;
  completeSwap: (requestId: string) => void;
  getSwapById: (requestId: string) => SkillSwapRequest | undefined;
  setCalendarEventId: (requestId: string, eventId: string) => void;
  triggerMonthlyDebit: (requestId: string) => Promise<{ success: boolean; error?: string } | void>;
  fetchSwaps: any;
  loading: boolean;
}

const buildMessage = (authorId: string, body: string, isSystem?: boolean): SwapMessage => {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorId,
    body,
    createdAt: new Date().toISOString(),
    isSystem,
  };
};

const mapProposals = (
  proposerId: string,
  slots: { startISO: string; endISO: string }[],
): SwapTimeProposal[] => {
  return slots.map((slot) => {
    return {
      id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      proposedById: proposerId,
      startISO: slot.startISO,
      endISO: slot.endISO,
      status: 'pending',
    };
  });
};

import { useSocket } from '@/providers/socket';

export const [SkillSwapsProvider, useSkillSwaps] = createContextHook<SkillSwapsContextValue>(() => {
  const { currentUser, allUsers, loadUser, spendCredits, earnCredits } = useCurrentUser();
  const { awardPoints, processClassPayment, refreshUserEarnings } = useEarnings();
  const { socket } = useSocket();
  // const [swaps, setSwaps] = useState<SkillSwapRequest[]>(() => {
  //   const lookupSkillId = (userId: string): string => {
  //     const user = allUsers.find((candidate) => candidate.id === userId);
  //     if (!user || user.skillsOffered.length === 0) {
  //       throw new Error('Unable to seed swap data');
  //     }
  //     return user.skillsOffered[0].id;
  //   };

  //   const now = new Date();
  //   const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  //   const twoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  //   const threeDays = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  //   const swapA: SkillSwapRequest = {
  //     id: 'swap-initial-1',
  //     requesterId: currentUser?.id || "",
  //     requesterSkillId: currentUser?.skillsOffered[0]?.id ?? '',
  //     recipientId: '2',
  //     recipientSkillId: lookupSkillId('2'),
  //     status: 'negotiating',
  //     locationPreference: 'Metaverse Coffee Bar - Virtual',
  //     createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
  //     updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
  //     proposedTimes: [
  //       {
  //         id: 'slot-initial-1',
  //         proposedById: currentUser?.id || "",
  //         startISO: new Date(tomorrow.getTime()).toISOString(),
  //         endISO: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
  //         status: 'pending',
  //       },
  //       {
  //         id: 'slot-initial-2',
  //         proposedById: '2',
  //         startISO: new Date(twoDays.getTime()).toISOString(),
  //         endISO: new Date(twoDays.getTime() + 60 * 60 * 1000).toISOString(),
  //         status: 'pending',
  //       },
  //     ],
  //     negotiationNotes: [
  //       {
  //         id: 'msg-initial-1',
  //         authorId: currentUser?.id || "",
  //         body: 'Excited to trade React coaching for your Italian cooking session!',
  //         createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
  //       },
  //       {
  //         id: 'msg-initial-2',
  //         authorId: '2',
  //         body: 'Amazing! Let\'s align on schedule, evenings work best for me.',
  //         createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
  //       },
  //     ],
  //   };

  //   const swapB: SkillSwapRequest = {
  //     id: 'swap-initial-2',
  //     requesterId: '3',
  //     requesterSkillId: lookupSkillId('3'),
  //     recipientId: currentUser?.id || "",
  //     recipientSkillId: currentUser?.skillsOffered[1]?.id ?? currentUser?.skillsOffered[0]?.id ?? '',
  //     status: 'scheduled',
  //     locationPreference: 'Downtown Creative Hub',
  //     createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  //     updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  //     proposedTimes: [
  //       {
  //         id: 'slot-initial-3',
  //         proposedById: '3',
  //         startISO: new Date(threeDays.getTime()).toISOString(),
  //         endISO: new Date(threeDays.getTime() + 90 * 60 * 1000).toISOString(),
  //         status: 'accepted',
  //       },
  //     ],
  //     acceptedTimeId: 'slot-initial-3',
  //     negotiationNotes: [
  //       {
  //         id: 'msg-initial-3',
  //         authorId: '3',
  //         body: 'Can we exchange Spanish coaching for a photo walk lesson?',
  //         createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  //       },
  //       {
  //         id: 'msg-initial-4',
  //         authorId: currentUser?.id || "",
  //         body: 'Locked in! Bringing gear for hands-on shooting.',
  //         createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  //       },
  //       {
  //         id: 'msg-initial-5',
  //         authorId: currentUser?.id || "",
  //         body: 'Swap confirmed for this weekend. See you soon!',
  //         createdAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
  //         isSystem: true,
  //       },
  //     ],
  //   };

  //   return [swapA, swapB];
  // });


  const [swaps, setSwaps] = useState<SkillSwapRequest[]>([]);
  const [allSwaps, setAllSwaps] = useState<SkillSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const buildSeedCompletedSwaps = useCallback((): SkillSwapRequest[] => {
    const now = new Date();
    const currentUserId = currentUser?.id || '1';
    return [
      {
        id: 'swap-completed-1',
        requesterId: currentUserId,
        requesterSkillId: currentUser?.skillsOffered?.[0]?.id ?? 'skill-1',
        recipientId: '3',
        recipientSkillId: 'skill-3',
        status: 'completed',
        swapType: 'swap' as const,
        locationPreference: 'Virtual Session',
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        proposedTimes: [
          {
            id: 'slot-completed-1',
            proposedById: currentUserId,
            startISO: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            endISO: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
            status: 'accepted',
          },
        ],
        acceptedTimeId: 'slot-completed-1',
        negotiationNotes: [
          {
            id: 'msg-completed-1',
            authorId: currentUserId,
            body: 'Looking forward to learning Hindi!',
            createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'msg-completed-2',
            authorId: '3',
            body: 'Session complete! Great progress.',
            createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            isSystem: true,
          },
        ],
      },
      {
        id: 'swap-completed-2',
        requesterId: '5',
        requesterSkillId: 'skill-5',
        recipientId: currentUserId,
        recipientSkillId: currentUser?.skillsOffered?.[1]?.id ?? currentUser?.skillsOffered?.[0]?.id ?? 'skill-2',
        status: 'completed',
        swapType: 'swap' as const,
        locationPreference: 'Downtown Studio',
        createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        proposedTimes: [
          {
            id: 'slot-completed-2',
            proposedById: '5',
            startISO: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
            endISO: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
            status: 'accepted',
          },
        ],
        acceptedTimeId: 'slot-completed-2',
        negotiationNotes: [
          {
            id: 'msg-completed-3',
            authorId: '5',
            body: 'Can you teach me photography?',
            createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'msg-completed-4',
            authorId: currentUserId,
            body: 'Swap completed! Great shooting session.',
            createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
            isSystem: true,
          },
        ],
      },
    ];
  }, [currentUser?.id, currentUser?.skillsOffered]);

  const fetchAllSwaps = useCallback(async (silent = false) => {
    const fullUrl = `${url}/swaps/all`;
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch swaps (${response.status})`);
      }
      const data = await response.json();
      const normalizeSwap = (data || []).map((swap: any): SkillSwapRequest => ({
        ...swap,
        id: swap._id || swap.id,
      }));
      setAllSwaps(normalizeSwap);
    } catch (err) {
      console.error('[SkillSwaps] fetch failed', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const fetchSwaps = useCallback(async (silent = false) => {
    if (!currentUser?.id) return;
    if (currentUser?.id === '1' || (currentUser as any)?.isDemo) {
      setSwaps([]);
      if (!silent) {
        setLoading(false);
      }
      return;
    }
    const fullUrl = `${url}/swaps?userId=${currentUser?.id}`;
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch swaps (${response.status})`);
      }
      const data = await response.json();
      const normalizeSwap = (data || []).map((swap: any): SkillSwapRequest => ({
        ...swap,
        id: swap._id || swap.id,
      }));

      setSwaps(normalizeSwap);
    } catch (err) {
      console.error('[SkillSwaps] fetch failed', err);
      setSwaps([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchAllSwaps(allSwaps.length > 0);

    if (!currentUser?.id || currentUser.id.length < 4) {
      setSwaps([]);
      setLoading(false);
    } else {
      fetchSwaps(swaps.length > 0);
    }

    if (socket) {
      const handleSwapUpdate = (data?: any) => {
        console.log('[Socket.IO] swap_updated event received:', data?._id || data?.id);
        if (data && (data._id || data.id)) {
          const updatedId = String(data._id || data.id);
          const normalized: SkillSwapRequest = {
            ...data,
            id: updatedId,
            negotiationNotes: Array.isArray(data.negotiationNotes)
              ? data.negotiationNotes.map((msg: any) => ({
                  ...msg,
                  id: msg.id || msg._id || `msg-${Date.now()}`,
                }))
              : [],
          };
          setSwaps((prev) => {
            const index = prev.findIndex((s) => String(s.id) === updatedId);
            if (index >= 0) {
              const copy = [...prev];
              copy[index] = { ...copy[index], ...normalized };
              return copy;
            }
            return [normalized, ...prev];
          });
          setAllSwaps((prev) => {
            const index = prev.findIndex((s) => String(s.id) === updatedId);
            if (index >= 0) {
              const copy = [...prev];
              copy[index] = { ...copy[index], ...normalized };
              return copy;
            }
            return [normalized, ...prev];
          });
        }
        fetchSwaps(true);
        fetchAllSwaps(true);
      };

      socket.on('swap_updated', handleSwapUpdate);

      return () => {
        socket.off('swap_updated', handleSwapUpdate);
      };
    }
  }, [currentUser?.id, socket, fetchSwaps, fetchAllSwaps]);


  const buildDerived = useCallback(
    (status: SkillSwapStatus) => {
      return swaps.filter((swap) => swap.status === status);
    },
    [swaps],
  );

  const pendingSwaps = useMemo(() => {
    return buildDerived('pending');
  }, [buildDerived]);

  const negotiatingSwaps = useMemo(() => {
    return buildDerived('negotiating');
  }, [buildDerived]);

  const scheduledSwaps = useMemo(() => {
    return buildDerived('scheduled');
  }, [buildDerived]);

  const declinedSwaps = useMemo(() => {
    return buildDerived('declined');
  }, [buildDerived]);

  const completedSwaps = useMemo(() => {
    return buildDerived('completed');
  }, [buildDerived]);

  // const addMessage = useCallback(({ requestId, authorId, body, isSystem }: AddMessageInput) => {
  //   setSwaps((previous) => {
  //     return previous.map((swap) => {
  //       if (swap.id !== requestId) {
  //         return swap;
  //       }
  //       const nextNotes = [...swap.negotiationNotes, buildMessage(authorId, body, isSystem)];
  //       return {
  //         ...swap,
  //         negotiationNotes: nextNotes,
  //         updatedAt: new Date().toISOString(),
  //       };
  //     });
  //   });
  // }, []);


  const addMessage = useCallback(
    async ({ requestId, authorId, body, isSystem }: AddMessageInput) => {
      if (currentUser?.id === '1') {
        throw new Error('Please login with a real account to send messages.');
      }
      // 🔹 optimistic UI
      const optimisticMessage = buildMessage(authorId, body, isSystem);

      setSwaps((previous) =>
        previous.map((swap) =>
          swap.id === requestId
            ? {
              ...swap,
              negotiationNotes: [...swap.negotiationNotes, optimisticMessage],
              updatedAt: new Date().toISOString(),
            }
            : swap
        )
      );

      try {
        const response = await fetch(
          `${url}/swaps/${requestId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              authorId,
              body,
              isSystem,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to add message');
        }

        let updatedSwap = await response.json();

        const normalizeSwap = (swap: any) => ({
          ...swap,
          id: swap._id,
          negotiationNotes: swap.negotiationNotes.map((msg: any) => ({
            ...msg,
            id: msg._id,
          })),
        });

        updatedSwap = normalizeSwap(updatedSwap)


        // 🔹 replace optimistic state with DB truth
        setSwaps((previous) =>
          previous.map((swap) =>
            swap.id === updatedSwap._id || swap.id === updatedSwap.id
              ? updatedSwap
              : swap
          )
        );
      } catch (error) {
        console.error('[SkillSwaps] Add message failed', error);
        // optional: rollback or toast
      }
    },
    [currentUser?.id]
  );


  // const createSwapRequest = useCallback(
  //   ({ recipientId, recipientSkillId, requesterSkillId, proposedTimes, locationPreference, message }: CreateSwapRequestInput) => {
  //     const slotPayloads = mapProposals(currentUser?.id || "", proposedTimes);
  //     const initialNotes: SwapMessage[] = [];
  //     if (message && message.trim().length > 0) {
  //       initialNotes.push(buildMessage(currentUser?.id || "", message));
  //     }
  //     const draft: SkillSwapRequest = {
  //       id: `swap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  //       requesterId: currentUser?.id || "",
  //       requesterSkillId,
  //       recipientId,
  //       recipientSkillId,
  //       status: 'pending',
  //       locationPreference,
  //       createdAt: new Date().toISOString(),
  //       updatedAt: new Date().toISOString(),
  //       proposedTimes: slotPayloads,
  //       negotiationNotes: initialNotes,
  //     };
  //     console.log('[SkillSwaps] Creating swap request', draft);
  //     setSwaps((previous) => {
  //       return [draft, ...previous];
  //     });
  //     return draft;
  //   },
  //   [currentUser?.id],
  // );

  const createSwapRequest = useCallback(
    async ({
      recipientId,
      recipientSkillId,
      requesterSkillId,
      swapType,
      proposedTimes,
      locationPreference,
      message,
    }: CreateSwapRequestInput) => {
      if (currentUser?.id === '1') {
        throw new Error('Please login with a real account to request skill swaps.');
      }
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const payload = {
        requesterId: currentUser.id,
        requesterSkillId: requesterSkillId || null,
        recipientId,
        recipientSkillId,
        swapType,
        locationPreference,
        message,
        proposedTimes: proposedTimes.map((slot) => ({
          proposedById: currentUser.id,
          startISO: slot.startISO,
          endISO: slot.endISO,
          status: 'pending',
        })),
      };

      const response = await fetch(`${url}/swaps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create swap request');
      }

      const rawSwap = await response.json();
      const createdSwap: SkillSwapRequest = {
        ...rawSwap,
        id: String(rawSwap.id || rawSwap._id),
      };

      // Deduct only platform fee (3 credits for free tier) from student upon requesting
      if (swapType !== 'teach') {
        const fee = getPlatformFee(currentUser || { premiumTier: 'free' });
        if (fee > 0) {
          spendCredits(fee);
        }
      }

      // Update local state (optimistic UI) immediately so swap screen finds it instantly
      setSwaps((prev) => [createdSwap, ...prev.filter((s) => s.id !== createdSwap.id)]);

      // Reload user data silently in background to update credit balance in UI without blocking navigation
      loadUser(true).catch((err: any) => console.warn('[SkillSwaps] Background user refresh error:', err));

      return createdSwap;
    },
    [currentUser, loadUser, spendCredits],
  );


  // const addCounterProposal = useCallback((input: CounterProposalInput) => {
  //   const { requestId, proposerId, slots, message } = input;
  //   console.log('[SkillSwaps] Counter proposal', input);
  //   const newSlots = mapProposals(proposerId, slots);
  //   setSwaps((previous) => {
  //     return previous.map((swap) => {
  //       if (swap.id !== requestId) {
  //         return swap;
  //       }
  //       return {
  //         ...swap,
  //         proposedTimes: [...swap.proposedTimes, ...newSlots],
  //         status: 'negotiating',
  //         updatedAt: new Date().toISOString(),
  //       };
  //     });
  //   });
  //   if (message) {
  //     addMessage({ requestId, authorId: proposerId, body: message });
  //   }
  // }, [addMessage]);


  const addCounterProposal = useCallback(
    async (input: CounterProposalInput) => {
      if (currentUser?.id === '1') {
        throw new Error('Please login with a real account to make counter proposals.');
      }
      const { requestId, proposerId, slots, message } = input;

      console.log('[SkillSwaps] Counter proposal', input);

      const newSlots = mapProposals(proposerId, slots);

      // 🔹 optimistic UI
      setSwaps((previous) =>
        previous.map((swap) =>
          swap.id === requestId
            ? {
              ...swap,
              proposedTimes: [...swap.proposedTimes, ...newSlots],
              status: 'negotiating',
              updatedAt: new Date().toISOString(),
            }
            : swap
        )
      );

      try {
        const response = await fetch(
          `${url}/swaps/${requestId}/counter-proposal`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              proposerId,
              slots: slots.map((slot) => ({
                startISO: slot.startISO,
                endISO: slot.endISO,
              })),
              message,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to counter proposal');
        }

        let updatedSwap = await response.json();

        const normalizeSwap = (swap: any) => ({
          ...swap,
          id: swap._id,
          negotiationNotes: swap.negotiationNotes.map((msg: any) => ({
            ...msg,
            id: msg._id,
          })),
        });

        updatedSwap = normalizeSwap(updatedSwap)

        // 🔹 replace optimistic state with DB truth
        setSwaps((previous) =>
          previous.map((swap) =>
            swap.id === updatedSwap._id || swap.id === updatedSwap.id
              ? updatedSwap
              : swap
          )
        );
      } catch (error) {
        console.error('[SkillSwaps] Counter proposal failed', error);
        // optional: rollback / toast
      }
    },
    [currentUser?.id]
  );


  // const acceptProposal = useCallback((input: AcceptProposalInput) => {
  //   const { requestId, timeId, location, note } = input;
  //   console.log('[SkillSwaps] Accepting proposal', input);
  //   setSwaps((previous) => {
  //     return previous.map((swap) => {
  //       if (swap.id !== requestId) {
  //         return swap;
  //       }
  //       const updatedSlots = swap.proposedTimes.map((slot) => {
  //         if (slot.id === timeId) {
  //           const nextSlot: SwapTimeProposal = { ...slot, status: 'accepted' };
  //           return nextSlot;
  //         }
  //         const nextSlot: SwapTimeProposal = { ...slot, status: slot.status === 'accepted' ? 'accepted' : 'declined' };
  //         return nextSlot;
  //       });
  //       return {
  //         ...swap,
  //         proposedTimes: updatedSlots,
  //         acceptedTimeId: timeId,
  //         status: 'scheduled',
  //         locationPreference: location ?? swap.locationPreference,
  //         updatedAt: new Date().toISOString(),
  //       };
  //     });
  //   });
  //   if (location) {
  //     addMessage({ requestId, authorId: currentUser?.id || "", body: `Location set to ${location}`, isSystem: true });
  //   }
  //   addMessage({ requestId, authorId: currentUser?.id || "", body: 'Swap confirmed! See you soon.', isSystem: true });
  //   if (note) {
  //     addMessage({ requestId, authorId: currentUser?.id || "", body: note });
  //   }
  // }, [addMessage, currentUser?.id]);

  const acceptProposal = useCallback(
    async (input: AcceptProposalInput) => {
      if (currentUser?.id === '1') {
        throw new Error('Please login with a real account to accept proposals.');
      }
      const { requestId, timeId, location, note } = input;

      console.log('[SkillSwaps] Accepting proposal', input);

      // 🔹 optimistic UI
      setSwaps((previous) =>
        previous.map((swap): SkillSwapRequest => {
          if (swap.id !== requestId) return swap;

          const updatedSlots: SwapTimeProposal[] = swap.proposedTimes.map(
            (slot): SwapTimeProposal => {
              if (slot.id === timeId) {
                return {
                  ...slot,
                  status: 'accepted',
                };
              }

              return {
                ...slot,
                status: 'declined',
              };
            }
          );

          return {
            ...swap,
            proposedTimes: updatedSlots,
            acceptedTimeId: timeId,
            status: 'scheduled',
            locationPreference: location ?? swap.locationPreference,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      // console.log("payload", {
      //   timeId,
      //   location,
      //   note,
      //   authorId: currentUser?.id,
      // });


      try {
        const response = await fetch(
          `${url}/swaps/${requestId}/accept-proposal`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              timeId,
              location,
              note,
              authorId: currentUser?.id,
            }),
          }
        );
        // console.log("Updated", response);

        if (!response.ok) {
          throw new Error('Failed to accept proposal');
        }

        let updatedSwap = await response.json();
        // console.log("Updated", updatedSwap);


        const normalizeSwap = (swap: any) => ({
          ...swap,
          id: swap._id,
          negotiationNotes: swap.negotiationNotes.map((msg: any) => ({
            ...msg,
            id: msg._id,
          })),
        });

        updatedSwap = normalizeSwap(updatedSwap)

        // 🔹 replace optimistic state with DB truth
        setSwaps((previous) =>
          previous.map((swap) =>
            swap.id === updatedSwap._id || swap.id === updatedSwap.id
              ? updatedSwap
              : swap
          )
        );
      } catch (error) {
        console.error('[SkillSwaps] Accept proposal failed', error);
        // optional: rollback / toast
      }
    },
    [currentUser?.id]
  );


  // const declineSwap = useCallback((input: DeclineSwapInput) => {
  //   const { requestId, note } = input;
  //   console.log('[SkillSwaps] Declining swap', input);
  //   setSwaps((previous) => {
  //     return previous.map((swap) => {
  //       if (swap.id !== requestId) {
  //         return swap;
  //       }
  //       return {
  //         ...swap,
  //         status: 'declined',
  //         updatedAt: new Date().toISOString(),
  //       };
  //     });
  //   });
  //   addMessage({ requestId, authorId: currentUser?.id || "", body: 'Swap declined.', isSystem: true });
  //   if (note) {
  //     addMessage({ requestId, authorId: currentUser?.id || "", body: note });
  //   }
  // }, [addMessage, currentUser?.id]);

  const declineSlot = useCallback(
    async (input: { requestId: string; slotId: string }) => {
      const { requestId, slotId } = input;
      // Optimistic UI update
      setSwaps((previous) =>
        previous.map((swap) => {
          if (swap.id !== requestId && (swap as any)._id !== requestId) return swap;
          return {
            ...swap,
            proposedTimes: swap.proposedTimes.map((slot) =>
              (slot._id === slotId || slot.id === slotId) ? { ...slot, status: 'declined' as const } : slot
            ),
          };
        })
      );

      try {
        const response = await fetch(`${url}/swaps/${requestId}/decline-slot`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            slotId,
            authorId: currentUser?.id,
          }),
        });

        if (response.ok) {
          let updatedSwap = await response.json();
          const normalizeSwap = (swap: any) => ({
            ...swap,
            id: swap._id,
            negotiationNotes: (swap.negotiationNotes || []).map((msg: any) => ({
              ...msg,
              id: msg._id,
            })),
          });
          updatedSwap = normalizeSwap(updatedSwap);
          setSwaps((previous) =>
            previous.map((s) => (s.id === updatedSwap.id || (s as any)._id === updatedSwap.id ? updatedSwap : s))
          );
        }
      } catch (error) {
        console.error('[SkillSwaps] Decline slot failed', error);
      }
    },
    [currentUser?.id]
  );

  const declineSwap = useCallback(
    async (input: DeclineSwapInput) => {
      if (currentUser?.id === '1') {
        throw new Error('Please login with a real account.');
      }
      const { requestId, note } = input;
      console.log('[SkillSwaps] Declining swap', input);

      // 🔹 Optimistic UI
      setSwaps((previous) =>
        previous.map((swap) =>
          swap.id === requestId
            ? {
              ...swap,
              status: 'declined',
              updatedAt: new Date().toISOString(),
            }
            : swap
        )
      );

      try {
        const response = await fetch(
          `${url}/swaps/${requestId}/decline`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: currentUser?.id,
              note,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to decline swap');
        }

        let updatedSwap = await response.json();

        const normalizeSwap = (swap: any) => ({
          ...swap,
          id: swap._id,
          negotiationNotes: swap.negotiationNotes.map((msg: any) => ({
            ...msg,
            id: msg._id,
          })),
        });

        updatedSwap = normalizeSwap(updatedSwap)

        // 🔹 Replace optimistic state with DB truth
        setSwaps((previous) =>
          previous.map((swap) =>
            swap.id === updatedSwap._id || swap.id === updatedSwap.id
              ? updatedSwap
              : swap
          )
        );
      } catch (error) {
        console.error('[SkillSwaps] Decline swap failed', error);
        // optional: rollback / toast
      }
    },
    [currentUser?.id]
  );


  // const updateLocation = useCallback((input: UpdateLocationInput) => {
  //   const { requestId, location } = input;
  //   console.log('[SkillSwaps] Updating location', input);
  //   setSwaps((previous) => {
  //     return previous.map((swap) => {
  //       if (swap.id !== requestId) {
  //         return swap;
  //       }
  //       return {
  //         ...swap,
  //         locationPreference: location,
  //         updatedAt: new Date().toISOString(),
  //       };
  //     });
  //   });
  //   addMessage({ requestId, authorId: currentUser?.id || "", body: `Location updated to ${location}`, isSystem: true });
  // }, [addMessage, currentUser?.id]);

  const updateLocation = useCallback(
    async (input: UpdateLocationInput) => {
      if (currentUser?.id === '1') {
        throw new Error('Please login with a real account.');
      }
      const { requestId, location } = input;

      console.log('[SkillSwaps] Updating location', input);

      // 🔹 optimistic UI update
      setSwaps((previous) =>
        previous.map((swap) =>
          swap.id === requestId
            ? {
              ...swap,
              locationPreference: location,
              updatedAt: new Date().toISOString(),
            }
            : swap
        )
      );

      try {
        const response = await fetch(
          `${url}/swaps/${requestId}/location`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              location,
              authorId: currentUser?.id,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update location');
        }

        let updatedSwap = await response.json();
        console.log(updatedSwap);
        const normalizeSwap = (swap: any) => ({
          ...swap,
          id: swap._id,
        });
        updatedSwap = normalizeSwap(updatedSwap)

        // 🔹 sync with backend truth
        setSwaps((previous) =>
          previous.map((swap) =>
            swap.id === updatedSwap._id || swap.id === updatedSwap.id
              ? updatedSwap
              : swap
          )
        );
      } catch (error) {
        console.error('[SkillSwaps] Location update failed', error);
        // optional: show toast / revert state
      }
    },
    [currentUser?.id]
  );


  // const completeSwap = useCallback((requestId: string) => {
  //   console.log('[SkillSwaps] Completing swap', requestId);
  //   setSwaps((previous) => {
  //     return previous.map((swap) => {
  //       if (swap.id !== requestId) {
  //         return swap;
  //       }
  //       return {
  //         ...swap,
  //         status: 'completed',
  //         updatedAt: new Date().toISOString(),
  //       };
  //     });
  //   });
  //   addMessage({ requestId, authorId: currentUser?.id || "", body: 'Skill swap marked as completed.', isSystem: true });
  // }, [addMessage, currentUser?.id]);

  const completeSwap = useCallback(
    async (requestId: string) => {
      if (currentUser?.id === '1') {
        throw new Error('Please login with a real account.');
      }
      console.log('[SkillSwaps] Completing swap', requestId);

      // 🔹 Optimistic UI backup for rollback
      const previousSwaps = [...swaps];
      setSwaps((previous) =>
        previous.map((swap) =>
          swap.id === requestId || (swap as any)._id === requestId
            ? {
              ...swap,
              status: 'completed',
              updatedAt: new Date().toISOString(),
            }
            : swap
        )
      );

      try {
        const response = await fetch(
          `${url}/swaps/${requestId}/complete`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: currentUser?.id,
            }),
          }
        );

        if (!response.ok) {
          let errorMsg = `Failed to complete swap (status ${response.status})`;
          try {
            const errData = await response.json();
            errorMsg = errData?.message || errData?.error || errorMsg;
          } catch {
            const errText = await response.text().catch(() => '');
            if (errText) errorMsg = errText;
          }
          throw new Error(errorMsg);
        }

        let updatedSwap = await response.json();

        const normalizeSwap = (swap: any) => ({
          ...swap,
          id: swap._id,
          negotiationNotes: (swap.negotiationNotes || []).map((msg: any) => ({
            ...msg,
            id: msg._id,
          })),
        });

        updatedSwap = normalizeSwap(updatedSwap);

        // 🔹 Replace optimistic state with DB truth
        setSwaps((previous) =>
          previous.map((swap) =>
            swap.id === updatedSwap._id || swap.id === updatedSwap.id
              ? updatedSwap
              : swap
          )
        );
        // Award credits based on the new credit system
        const targetSwap = updatedSwap || swaps.find((s) => s.id === requestId || (s as any)._id === requestId);
        if (targetSwap) {
          const swapType = targetSwap.swapType || 'swap';

          // Determine teacher and learner based on swapType
          let teacherId: string | undefined;
          let learnerId: string | undefined;

          if (swapType === 'teach') {
            teacherId = targetSwap.requesterId;
            learnerId = targetSwap.recipientId;
          } else if (swapType === 'learn') {
            teacherId = targetSwap.recipientId;
            learnerId = targetSwap.requesterId;
          } else {
            // 'swap' — recipient is teacher, requester is student
            teacherId = targetSwap.recipientId;
            learnerId = targetSwap.requesterId;
          }

          // Look up the skill being taught to determine session cost
          const teacherUser = allUsers.find(u => u.id === teacherId);
          const taughtSkillId = swapType === 'teach' ? targetSwap.requesterSkillId : targetSwap.recipientSkillId;
          const taughtSkill = teacherUser?.skillsOffered.find(s => s.id === taughtSkillId);
          const sessionCredits = taughtSkill ? getSessionCreditCost(taughtSkill) : 0;
          const skillTitle = taughtSkill?.title ?? 'skill session';

          // Backend PATCH /:id/complete already handles all PointTransactions:
          // - Learner session fee deduction (User.credits in DB)
          // - Teacher 80% earnings (PointTransaction only, for payout)
          // - Learner +10 bonus (PointTransaction only, for payout)
          // Frontend only needs to sync local UI state for the learner's main balance
          if (sessionCredits > 0 && learnerId === currentUser?.id) {
            spendCredits(sessionCredits);
          }

          // ⚡ Real-time update: Re-fetch user profile (main credits) and earnings/points for teacher & learner
          loadUser(true);
          if (teacherId) refreshUserEarnings(teacherId);
          if (learnerId) refreshUserEarnings(learnerId);

          console.log('[Earnings] Swap completion processed by backend', { teacherId, learnerId, sessionCredits, swapId: requestId });
        }
      } catch (error: any) {
        console.error('[SkillSwaps] Complete swap failed', error);
        // Rollback optimistic update
        setSwaps(previousSwaps);
        throw error;
      }
    },
    [currentUser?.id, swaps, allUsers, spendCredits, loadUser, refreshUserEarnings]
  );


  const getSwapById = useCallback((requestId: string) => {
    if (!requestId) return undefined;
    const reqStr = String(requestId);
    return swaps.find((swap) => String(swap.id) === reqStr || String((swap as any)._id) === reqStr);
  }, [swaps]);

  // const setCalendarEventId = useCallback((requestId: string, eventId: string) => {
  //   console.log('[SkillSwaps] Setting calendar event ID', { requestId, eventId });
  //   setSwaps((previous) => {
  //     return previous.map((swap) => {
  //       if (swap.id !== requestId) {
  //         return swap;
  //       }
  //       return {
  //         ...swap,
  //         calendarEventId: eventId,
  //         updatedAt: new Date().toISOString(),
  //       };
  //     });
  //   });
  // }, []);

  const setCalendarEventId = useCallback(
    async (requestId: string, eventId: string) => {
      console.log('[SkillSwaps] Setting calendar event ID', { requestId, eventId });

      // 🔹 Optimistic update
      setSwaps((previous) =>
        previous.map((swap) =>
          swap.id === requestId
            ? {
              ...swap,
              calendarEventId: eventId,
              updatedAt: new Date().toISOString(),
            }
            : swap
        )
      );

      try {
        const response = await fetch(
          `${url}/swaps/${requestId}/calendar-event`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ calendarEventId: eventId }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to set calendar event ID');
        }

        let updatedSwap = await response.json();
        // console.log(updatedSwap);


        const normalizeSwap = (swap: any) => ({
          ...swap,
          id: swap._id,
          negotiationNotes: swap.negotiationNotes.map((msg: any) => ({
            ...msg,
            id: msg._id,
          })),
        });

        updatedSwap = normalizeSwap(updatedSwap)

        // 🔹 Replace optimistic state with DB truth
        setSwaps((previous) =>
          previous.map((swap) =>
            swap.id === updatedSwap._id || swap.id === updatedSwap.id
              ? updatedSwap
              : swap
          )
        );
      } catch (error) {
        console.error('[SkillSwaps] Calendar event update failed', error);
        // optional: rollback or toast
      }
    },
    []
  );

  const triggerMonthlyDebit = useCallback(
    async (requestId: string) => {
      const targetSwap = swaps.find((s) => String(s.id) === String(requestId) || String((s as any)._id) === String(requestId));
      if (!targetSwap) return { success: false, error: 'Swap not found' };

      const swapType = targetSwap.swapType || 'swap';
      let teacherId: string | undefined;
      let learnerId: string | undefined;

      if (swapType === 'teach') {
        teacherId = targetSwap.requesterId;
        learnerId = targetSwap.recipientId;
      } else {
        teacherId = targetSwap.recipientId;
        learnerId = targetSwap.requesterId;
      }

      const teacherUser = allUsers.find((u) => String(u.id) === String(teacherId) || String((u as any)._id) === String(teacherId));
      const studentUser = allUsers.find((u) => String(u.id) === String(learnerId) || String((u as any)._id) === String(learnerId)) || currentUser;
      const taughtSkillId = swapType === 'teach' ? targetSwap.requesterSkillId : targetSwap.recipientSkillId;
      const taughtSkill = teacherUser?.skillsOffered.find((s) => String(s.id) === String(taughtSkillId) || String((s as any)._id) === String(taughtSkillId));
      const monthlyAmount = taughtSkill?.monthlyPrice || (taughtSkill?.pricingModel === 'monthly' ? taughtSkill.monthlyPrice : 0) || 0;
      const skillTitle = taughtSkill?.title || 'skill session';

      const isStudent = String(learnerId) === String(currentUser?.id);
      const studentCredits = isStudent ? (currentUser?.credits ?? 0) : (studentUser?.credits ?? 0);

      if (monthlyAmount > 0) {
        if (studentCredits < monthlyAmount) {
          // Insufficient credits! Emit failed event to alert both student and teacher
          if (socket) {
            socket.emit('subscription_debit_failed', {
              studentId: learnerId,
              teacherId,
              amount: monthlyAmount,
              title: skillTitle,
              studentName: studentUser?.name || 'Student',
              studentUsername: studentUser?.username,
              isClass: false,
            });
          }
          return { success: false, error: 'Insufficient credits' };
        }

        // Student has enough credits: deduct credits
        if (isStudent && spendCredits) {
          spendCredits(monthlyAmount);
        }

        // Give teacher 80% if teacher is current user
        if (String(teacherId) === String(currentUser?.id) && earnCredits) {
          earnCredits(Math.floor(monthlyAmount * 0.8));
        }

        // Emit success socket event
        if (socket) {
          socket.emit('subscription_debit_success', {
            studentId: learnerId,
            teacherId,
            amount: monthlyAmount,
            title: skillTitle,
            studentName: studentUser?.name || 'Student',
            studentUsername: studentUser?.username,
            isClass: false,
          });
        }
      }

      try {
        const response = await fetch(`${url}/swaps/${requestId}/trigger-monthly-debit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          await fetchSwaps(true);
          if (loadUser) {
            await loadUser(true);
          }
        }
      } catch (err) {
        console.error('[SkillSwaps] Trigger monthly debit error:', err);
      }
      return { success: true };
    },
    [swaps, allUsers, currentUser, socket, spendCredits, earnCredits, fetchSwaps, loadUser],
  );

  // Automated background monthly subscription check for skills
  useEffect(() => {
    if (!currentUser?.id || currentUser?.id === '1') return;

    const checkMonthlySubscriptions = async () => {
      const now = Date.now();
      const monthMs = 30 * 24 * 60 * 60 * 1000;

      for (const swap of swaps) {
        if (swap.status === 'declined') continue;
        const swapType = swap.swapType || 'swap';
        const isLearner = swapType === 'teach'
          ? String(swap.recipientId) === String(currentUser.id)
          : String(swap.requesterId) === String(currentUser.id);

        if (!isLearner) continue;

        const teacherId = swapType === 'teach' ? swap.requesterId : swap.recipientId;
        const teacherUser = allUsers.find(u => String(u.id) === String(teacherId) || String((u as any)._id) === String(teacherId));
        const taughtSkillId = swapType === 'teach' ? swap.requesterSkillId : swap.recipientSkillId;
        const taughtSkill = teacherUser?.skillsOffered.find(s => String(s.id) === String(taughtSkillId) || String((s as any)._id) === String(taughtSkillId));

        if (taughtSkill?.pricingModel === 'monthly' && (taughtSkill?.monthlyPrice || 0) > 0) {
          const lastDebited = swap.lastAutoDebitedAt ? new Date(swap.lastAutoDebitedAt).getTime() : new Date(swap.createdAt).getTime();
          // If 30 days passed since last debit or createdAt
          if (now - lastDebited >= monthMs) {
            const checkKey = `@skillswap_monthly_checked_${swap.id}_${Math.floor(now / monthMs)}`;
            const alreadyChecked = await AsyncStorage.getItem(checkKey);
            if (!alreadyChecked) {
              await AsyncStorage.setItem(checkKey, 'true');
              await triggerMonthlyDebit(swap.id);
            }
          }
        }
      }
    };

    checkMonthlySubscriptions();
    const interval = setInterval(checkMonthlySubscriptions, 60000);
    return () => clearInterval(interval);
  }, [swaps, currentUser?.id, allUsers, triggerMonthlyDebit]);

  const value: SkillSwapsContextValue = useMemo(() => {
    return {
      fetchSwaps,
      swaps,
      allSwaps,
      pendingSwaps,
      negotiatingSwaps,
      scheduledSwaps,
      declinedSwaps,
      completedSwaps,
      createSwapRequest,
      addCounterProposal,
      acceptProposal,
      declineSlot,
      declineSwap,
      updateLocation,
      addMessage,
      completeSwap,
      getSwapById,
      setCalendarEventId,
      triggerMonthlyDebit,
      loading,
    };
  }, [
    fetchSwaps,
    swaps,
    allSwaps,
    pendingSwaps,
    negotiatingSwaps,
    scheduledSwaps,
    declinedSwaps,
    completedSwaps,
    createSwapRequest,
    addCounterProposal,
    acceptProposal,
    declineSlot,
    declineSwap,
    updateLocation,
    addMessage,
    completeSwap,
    getSwapById,
    setCalendarEventId,
    triggerMonthlyDebit,
    loading,
  ]);

  return value;
});
