import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { SkillSwapRequest, SkillSwapStatus, SwapMessage, SwapTimeProposal, SwapType } from '../types';
import { useCurrentUser } from './current-user';
import { useEarnings } from './earnings';
import url from '@/constants/backurl';

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
  declineSwap: (input: DeclineSwapInput) => void;
  updateLocation: (input: UpdateLocationInput) => void;
  addMessage: (input: AddMessageInput) => void;
  completeSwap: (requestId: string) => void;
  getSwapById: (requestId: string) => SkillSwapRequest | undefined;
  setCalendarEventId: (requestId: string, eventId: string) => void;
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

export const [SkillSwapsProvider, useSkillSwaps] = createContextHook<SkillSwapsContextValue>(() => {
  const { currentUser, allUsers, loadUser } = useCurrentUser();
  const { awardPoints } = useEarnings();
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

  const fetchAllSwaps = async (silent = false) => {
    const fullUrl = `${url}/swaps/all`;
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch swaps (${response.status})`);
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error(`[SkillSwaps] JSON Parse failed for ${fullUrl}. Response snippet:`, text.substring(0, 200));
        throw parseErr;
      }
      const normalizeSwap = data.map((swap: any): SkillSwapRequest => ({
        ...swap,
        id: swap._id,
      }));
      setAllSwaps(normalizeSwap);
    } catch (err) {
      console.error('[SkillSwaps] fetch failed', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchSwaps = async (silent = false) => {
    if (!currentUser?.id) return;
    const fullUrl = `${url}/swaps?userId=${currentUser?.id}`;
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch swaps (${response.status})`);
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error(`[SkillSwaps] JSON Parse failed for ${fullUrl}. Response snippet:`, text.substring(0, 200));
        throw parseErr;
      }
      const normalizeSwap = data.map((swap: any): SkillSwapRequest => ({
        ...swap,
        id: swap._id,
      }));
      setSwaps(normalizeSwap);
    } catch (err) {
      console.error('[SkillSwaps] fetch failed', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // useEffect(() => {
  //   if (currentUser?.id.length || 1 >= 4) return;
  //   fetchSwaps();
  // }, []);

  useEffect(() => {
    // Always fetch all swaps (needed for admin oversight)
    fetchAllSwaps();

    if (!currentUser?.id || currentUser.id.length < 4) {
      setSwaps([]);
      setLoading(false);

      return;
    }

    // Initial load for user swaps
    fetchSwaps();

    // Start background polling for both user swaps and all swaps
    let intervalId: any;
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        fetchSwaps(true);
        fetchAllSwaps(true);
      }, 4000);
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentUser?.id]);


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
        throw new Error('Failed to create swap request');
      }

      const createdSwap = await response.json();

      // Update local state (optimistic UI)
      setSwaps((prev) => [createdSwap, ...prev]);

      // Reload user data to update credit balance in UI
      await loadUser().catch((err: any) => console.error('[SkillSwaps] Failed to refresh user after swap creation', err));

      return createdSwap;
    },
    [currentUser?.id, loadUser],
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

      // 🔹 Optimistic UI
      setSwaps((previous) =>
        previous.map((swap) =>
          swap.id === requestId
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
          throw new Error('Failed to complete swap');
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
        // Award points based on swapType
        const targetSwap = updatedSwap || swaps.find((s) => s.id === requestId || s._id === requestId);
        if (targetSwap) {
          const swapType = targetSwap.swapType || 'swap';

          if (swapType === 'teach') {
            // Requester is teacher, recipient is learner
            if (targetSwap.requesterId) {
              awardPoints({
                userId: targetSwap.requesterId,
                amount: 50,
                source: 'class_taught',
                description: 'Completed teaching session (Teacher: +50 pts)',
                swapId: requestId,
              });
            }
            if (targetSwap.recipientId) {
              awardPoints({
                userId: targetSwap.recipientId,
                amount: 10,
                source: 'bonus',
                description: 'Completed learning session (Student: +10 pts)',
                swapId: requestId,
              });
            }
          } else if (swapType === 'learn') {
            // Requester is learner, recipient is teacher
            if (targetSwap.recipientId) {
              awardPoints({
                userId: targetSwap.recipientId,
                amount: 50,
                source: 'class_taught',
                description: 'Completed teaching session (Teacher: +50 pts)',
                swapId: requestId,
              });
            }
            if (targetSwap.requesterId) {
              awardPoints({
                userId: targetSwap.requesterId,
                amount: 10,
                source: 'bonus',
                description: 'Completed learning session (Student: +10 pts)',
                swapId: requestId,
              });
            }
          } else {
            // 'swap' — recipient is teacher, requester is student
            const teacherId = targetSwap.recipientId;
            const studentId = targetSwap.requesterId;

            if (teacherId) {
              awardPoints({
                userId: teacherId,
                amount: 50,
                source: 'class_taught',
                description: 'Completed swap session (Teacher: +50 pts)',
                swapId: requestId,
              });
            }

            if (studentId) {
              awardPoints({
                userId: studentId,
                amount: 10,
                source: 'bonus',
                description: 'Completed swap session (Student: +10 pts)',
                swapId: requestId,
              });
            }
          }
        }
      } catch (error) {
        console.error('[SkillSwaps] Complete swap failed', error);
        // optional: rollback or toast
      }
    },
    [currentUser?.id]
  );


  const getSwapById = useCallback((requestId: string) => {
    return swaps.find((swap) => swap.id === requestId);
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
      declineSwap,
      updateLocation,
      addMessage,
      completeSwap,
      getSwapById,
      setCalendarEventId,
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
    declineSwap,
    updateLocation,
    addMessage,
    completeSwap,
    getSwapById,
    setCalendarEventId,
    loading,
  ]);

  return value;
});
