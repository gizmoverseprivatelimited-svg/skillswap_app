import { useCallback, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { SkillSwapRequest, SkillSwapStatus, SwapMessage, SwapTimeProposal } from '../types';
import { useCurrentUser } from './current-user';
import { useEarnings } from './earnings';

interface CreateSwapRequestInput {
  recipientId: string;
  recipientSkillId: string;
  requesterSkillId: string;
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
  pendingSwaps: SkillSwapRequest[];
  negotiatingSwaps: SkillSwapRequest[];
  scheduledSwaps: SkillSwapRequest[];
  declinedSwaps: SkillSwapRequest[];
  completedSwaps: SkillSwapRequest[];
  createSwapRequest: (input: CreateSwapRequestInput) => SkillSwapRequest;
  addCounterProposal: (input: CounterProposalInput) => void;
  acceptProposal: (input: AcceptProposalInput) => void;
  declineSwap: (input: DeclineSwapInput) => void;
  updateLocation: (input: UpdateLocationInput) => void;
  addMessage: (input: AddMessageInput) => void;
  completeSwap: (requestId: string) => void;
  getSwapById: (requestId: string) => SkillSwapRequest | undefined;
  setCalendarEventId: (requestId: string, eventId: string) => void;
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
  const { currentUser, allUsers } = useCurrentUser();
  const { awardPoints } = useEarnings();
  const [swaps, setSwaps] = useState<SkillSwapRequest[]>(() => {
    const lookupSkillId = (userId: string): string => {
      const user = allUsers.find((candidate) => candidate.id === userId);
      if (!user || user.skillsOffered.length === 0) {
        throw new Error('Unable to seed swap data');
      }
      return user.skillsOffered[0].id;
    };

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const threeDays = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const swapA: SkillSwapRequest = {
      id: 'swap-initial-1',
      requesterId: currentUser.id,
      requesterSkillId: currentUser.skillsOffered[0]?.id ?? '',
      recipientId: '2',
      recipientSkillId: lookupSkillId('2'),
      status: 'negotiating',
      locationPreference: 'Metaverse Coffee Bar - Virtual',
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      proposedTimes: [
        {
          id: 'slot-initial-1',
          proposedById: currentUser.id,
          startISO: new Date(tomorrow.getTime()).toISOString(),
          endISO: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          status: 'pending',
        },
        {
          id: 'slot-initial-2',
          proposedById: '2',
          startISO: new Date(twoDays.getTime()).toISOString(),
          endISO: new Date(twoDays.getTime() + 60 * 60 * 1000).toISOString(),
          status: 'pending',
        },
      ],
      negotiationNotes: [
        {
          id: 'msg-initial-1',
          authorId: currentUser.id,
          body: 'Excited to trade React coaching for your Italian cooking session!',
          createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'msg-initial-2',
          authorId: '2',
          body: 'Amazing! Let\'s align on schedule, evenings work best for me.',
          createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        },
      ],
    };

    const swapB: SkillSwapRequest = {
      id: 'swap-initial-2',
      requesterId: '3',
      requesterSkillId: lookupSkillId('3'),
      recipientId: currentUser.id,
      recipientSkillId: currentUser.skillsOffered[1]?.id ?? currentUser.skillsOffered[0]?.id ?? '',
      status: 'scheduled',
      locationPreference: 'Downtown Creative Hub',
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      proposedTimes: [
        {
          id: 'slot-initial-3',
          proposedById: '3',
          startISO: new Date(threeDays.getTime()).toISOString(),
          endISO: new Date(threeDays.getTime() + 90 * 60 * 1000).toISOString(),
          status: 'accepted',
        },
      ],
      acceptedTimeId: 'slot-initial-3',
      negotiationNotes: [
        {
          id: 'msg-initial-3',
          authorId: '3',
          body: 'Can we exchange Spanish coaching for a photo walk lesson?',
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'msg-initial-4',
          authorId: currentUser.id,
          body: 'Locked in! Bringing gear for hands-on shooting.',
          createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'msg-initial-5',
          authorId: currentUser.id,
          body: 'Swap confirmed for this weekend. See you soon!',
          createdAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
          isSystem: true,
        },
      ],
    };

    return [swapA, swapB];
  });

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

  const addMessage = useCallback(({ requestId, authorId, body, isSystem }: AddMessageInput) => {
    console.log('[SkillSwaps] addMessage called', { requestId, authorId, body, isSystem });
    setSwaps((previous) => {
      const updated = previous.map((swap) => {
        if (swap.id !== requestId) {
          return swap;
        }
        const newMessage = buildMessage(authorId, body, isSystem);
        const nextNotes = [...swap.negotiationNotes, newMessage];
        console.log('[SkillSwaps] Adding message', { swapId: swap.id, messageId: newMessage.id, totalNotes: nextNotes.length });
        return {
          ...swap,
          negotiationNotes: nextNotes,
          updatedAt: new Date().toISOString(),
        };
      });
      return updated;
    });
  }, []);

  const createSwapRequest = useCallback(
    ({ recipientId, recipientSkillId, requesterSkillId, proposedTimes, locationPreference, message }: CreateSwapRequestInput) => {
      const slotPayloads = mapProposals(currentUser.id, proposedTimes);
      const initialNotes: SwapMessage[] = [];
      if (message && message.trim().length > 0) {
        initialNotes.push(buildMessage(currentUser.id, message));
      }
      const draft: SkillSwapRequest = {
        id: `swap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        requesterId: currentUser.id,
        requesterSkillId,
        recipientId,
        recipientSkillId,
        status: 'pending',
        locationPreference,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        proposedTimes: slotPayloads,
        negotiationNotes: initialNotes,
      };
      console.log('[SkillSwaps] Creating swap request', draft);
      setSwaps((previous) => {
        return [draft, ...previous];
      });
      return draft;
    },
    [currentUser.id],
  );

  const addCounterProposal = useCallback((input: CounterProposalInput) => {
    const { requestId, proposerId, slots, message } = input;
    console.log('[SkillSwaps] Counter proposal', input);
    const newSlots = mapProposals(proposerId, slots);
    setSwaps((previous) => {
      return previous.map((swap) => {
        if (swap.id !== requestId) {
          return swap;
        }
        return {
          ...swap,
          proposedTimes: [...swap.proposedTimes, ...newSlots],
          status: 'negotiating',
          updatedAt: new Date().toISOString(),
        };
      });
    });
    if (message) {
      addMessage({ requestId, authorId: proposerId, body: message });
    }
  }, [addMessage]);

  const acceptProposal = useCallback((input: AcceptProposalInput) => {
    const { requestId, timeId, location, note } = input;
    console.log('[SkillSwaps] Accepting proposal', input);
    setSwaps((previous) => {
      return previous.map((swap) => {
        if (swap.id !== requestId) {
          return swap;
        }
        const updatedSlots = swap.proposedTimes.map((slot) => {
          if (slot.id === timeId) {
            const nextSlot: SwapTimeProposal = { ...slot, status: 'accepted' };
            return nextSlot;
          }
          const nextSlot: SwapTimeProposal = { ...slot, status: slot.status === 'accepted' ? 'accepted' : 'declined' };
          return nextSlot;
        });
        return {
          ...swap,
          proposedTimes: updatedSlots,
          acceptedTimeId: timeId,
          status: 'scheduled',
          locationPreference: location ?? swap.locationPreference,
          updatedAt: new Date().toISOString(),
        };
      });
    });
    if (location) {
      addMessage({ requestId, authorId: currentUser.id, body: `Location set to ${location}`, isSystem: true });
    }
    addMessage({ requestId, authorId: currentUser.id, body: 'Swap confirmed! See you soon.', isSystem: true });
    if (note) {
      addMessage({ requestId, authorId: currentUser.id, body: note });
    }
  }, [addMessage, currentUser.id]);

  const declineSwap = useCallback((input: DeclineSwapInput) => {
    const { requestId, note } = input;
    console.log('[SkillSwaps] Declining swap', input);
    setSwaps((previous) => {
      return previous.map((swap) => {
        if (swap.id !== requestId) {
          return swap;
        }
        return {
          ...swap,
          status: 'declined',
          updatedAt: new Date().toISOString(),
        };
      });
    });
    addMessage({ requestId, authorId: currentUser.id, body: 'Swap declined.', isSystem: true });
    if (note) {
      addMessage({ requestId, authorId: currentUser.id, body: note });
    }
  }, [addMessage, currentUser.id]);

  const updateLocation = useCallback((input: UpdateLocationInput) => {
    const { requestId, location } = input;
    console.log('[SkillSwaps] Updating location', input);
    setSwaps((previous) => {
      return previous.map((swap) => {
        if (swap.id !== requestId) {
          return swap;
        }
        return {
          ...swap,
          locationPreference: location,
          updatedAt: new Date().toISOString(),
        };
      });
    });
    addMessage({ requestId, authorId: currentUser.id, body: `Location updated to ${location}`, isSystem: true });
  }, [addMessage, currentUser.id]);

  const completeSwap = useCallback((requestId: string) => {
    console.log('[SkillSwaps] Completing swap', requestId);
    let completedSwap: SkillSwapRequest | undefined;
    setSwaps((previous) => {
      return previous.map((swap) => {
        if (swap.id !== requestId) {
          return swap;
        }
        completedSwap = { ...swap, status: 'completed' as SkillSwapStatus, updatedAt: new Date().toISOString() };
        return completedSwap;
      });
    });
    addMessage({ requestId, authorId: currentUser.id, body: 'Skill swap marked as completed.', isSystem: true });

    if (completedSwap) {
      const teacherId = completedSwap.recipientId;
      const studentId = completedSwap.requesterId;
      awardPoints({
        userId: teacherId,
        amount: 50,
        source: 'class_taught',
        description: 'Taught a skill swap session',
        swapId: requestId,
      });
      awardPoints({
        userId: studentId,
        amount: 10,
        source: 'swap_completed',
        description: 'Completed a skill swap session',
        swapId: requestId,
      });
      console.log('[Earnings] Points awarded for swap completion', { teacherId, studentId, swapId: requestId });
    }
  }, [addMessage, currentUser.id, awardPoints]);

  const getSwapById = useCallback((requestId: string) => {
    return swaps.find((swap) => swap.id === requestId);
  }, [swaps]);

  const setCalendarEventId = useCallback((requestId: string, eventId: string) => {
    console.log('[SkillSwaps] Setting calendar event ID', { requestId, eventId });
    setSwaps((previous) => {
      return previous.map((swap) => {
        if (swap.id !== requestId) {
          return swap;
        }
        return {
          ...swap,
          calendarEventId: eventId,
          updatedAt: new Date().toISOString(),
        };
      });
    });
  }, []);

  const value: SkillSwapsContextValue = useMemo(() => {
    return {
      swaps,
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
    };
  }, [
    swaps,
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
  ]);

  return value;
});
