import { useCallback, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { getResources, mockUsers } from '@/mocks/data';
import type { ResourceMeta, ResourceType, SkillCategory, SkillLevel } from '@/types';

export interface ResourceDraft {
  title: string;
  description: string;
  url: string;
  type: ResourceType;
  coverImageUrl: string;
  categories: SkillCategory[];
  difficulty: SkillLevel | 'All Levels';
  durationMinutes?: number;
  formatBadge?: string;
  tags: string[];
}

interface ResourcesContextValue {
  resources: ResourceMeta[];
  featuredResources: ResourceMeta[];
  recentResources: ResourceMeta[];
  savedResourceIds: string[];
  trendingTags: string[];
  addResource: (draft: ResourceDraft, contributorId: string) => ResourceMeta | null;
  toggleSaved: (resourceId: string) => void;
  endorseResource: (resourceId: string) => void;
}

const generateResourceId = (): string => {
  return `res-${Math.random().toString(36).slice(2, 9)}`;
};

const sortByEngagement = (resources: ResourceMeta[]): ResourceMeta[] => {
  return [...resources].sort((a, b) => {
    const aScore = a.endorsements + a.saves / 2;
    const bScore = b.endorsements + b.saves / 2;
    return bScore - aScore;
  });
};

export const [ResourcesProvider, useResources] = createContextHook<ResourcesContextValue>(() => {
  const [resourceList, setResourceList] = useState<ResourceMeta[]>(() => {
    return sortByEngagement(getResources());
  });
  const [savedResourceIds, setSavedResourceIds] = useState<string[]>([]);

  const featuredResources = useMemo<ResourceMeta[]>(() => {
    const curated = sortByEngagement(resourceList).slice(0, 3);
    if (curated.length >= 3) {
      return curated;
    }
    return resourceList.slice(0, 3);
  }, [resourceList]);

  const recentResources = useMemo<ResourceMeta[]>(() => {
    return [...resourceList]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 6);
  }, [resourceList]);

  const trendingTags = useMemo<string[]>(() => {
    const tally = new Map<string, number>();
    resourceList.forEach((resource) => {
      resource.tags.forEach((tag) => {
        tally.set(tag, (tally.get(tag) ?? 0) + 1);
      });
    });
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
  }, [resourceList]);

  const toggleSaved = useCallback((resourceId: string) => {
    setSavedResourceIds((prev) => {
      if (prev.includes(resourceId)) {
        return prev.filter((id) => id !== resourceId);
      }
      return [...prev, resourceId];
    });
  }, []);

  const endorseResource = useCallback((resourceId: string) => {
    setResourceList((prev) => {
      return prev.map((resource) => {
        if (resource.id !== resourceId) {
          return resource;
        }
        return {
          ...resource,
          endorsements: resource.endorsements + 1,
        };
      });
    });
  }, []);

  const addResource = useCallback(
    (draft: ResourceDraft, contributorId: string): ResourceMeta | null => {
      const trimmedTitle = draft.title.trim();
      const trimmedDescription = draft.description.trim();
      const trimmedUrl = draft.url.trim();
      const trimmedCover = draft.coverImageUrl.trim();

      if (
        trimmedTitle.length === 0 ||
        trimmedDescription.length === 0 ||
        trimmedUrl.length === 0 ||
        trimmedCover.length === 0 ||
        draft.categories.length === 0
      ) {
        console.warn('[Resources] Attempted to add invalid draft', { draft });
        return null;
      }

      const contributor = mockUsers.find((user) => user.id === contributorId);
      if (!contributor) {
        console.warn('[Resources] Contributor not found', { contributorId });
        return null;
      }

      const newResource: ResourceMeta = {
        id: generateResourceId(),
        title: trimmedTitle,
        description: trimmedDescription,
        url: trimmedUrl,
        type: draft.type,
        coverImageUrl: trimmedCover,
        categories: draft.categories,
        contributorId,
        contributorName: contributor.name,
        contributorAvatarUrl: contributor.avatarUrl,
        difficulty: draft.difficulty,
        durationMinutes: draft.durationMinutes,
        formatBadge: draft.formatBadge,
        publishedAt: new Date().toISOString(),
        endorsements: 0,
        saves: 1,
        tags: draft.tags,
      };

      setResourceList((prev) => sortByEngagement([newResource, ...prev]));
      setSavedResourceIds((prev) => [...prev, newResource.id]);

      return newResource;
    },
    [],
  );

  const value: ResourcesContextValue = useMemo(() => {
    return {
      resources: resourceList,
      featuredResources,
      recentResources,
      savedResourceIds,
      trendingTags,
      addResource,
      toggleSaved,
      endorseResource,
    };
  }, [resourceList, featuredResources, recentResources, savedResourceIds, trendingTags, addResource, toggleSaved, endorseResource]);

  return value;
});
