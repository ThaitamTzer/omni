import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AiRuleDto, FaqDto } from '@omni/shared';

// ---- Types + keys ----
export interface AiSettings {
  ai_tone: string;
  ai_max_replies_per_hour: string;
}

export const aiRulesKeys = { all: ['ai-rules'] as const };
export const faqsKeys = { all: ['faqs'] as const };
export const settingsKeys = { all: ['settings'] as const };

// ---- Queries ----
export function useAiRulesQuery() {
  return useQuery({
    queryKey: aiRulesKeys.all,
    queryFn: () => api.get<AiRuleDto[]>('/settings/ai-rules'),
  });
}

export function useFaqsQuery() {
  return useQuery({
    queryKey: faqsKeys.all,
    queryFn: () => api.get<FaqDto[]>('/settings/faqs'),
  });
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => api.get<AiSettings>('/settings'),
  });
}

// ---- Mutations ----
export interface AddRuleInput {
  name: string;
  keywords: string[];
  responseTemplate?: string;
}

export function useAddRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddRuleInput) =>
      api.post('/settings/ai-rules', {
        name: input.name,
        keywords: input.keywords,
        responseTemplate: input.responseTemplate,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiRulesKeys.all }),
  });
}

export function useToggleRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/settings/ai-rules/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiRulesKeys.all }),
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/settings/ai-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiRulesKeys.all }),
  });
}

export interface AddFaqInput {
  question: string;
  answer: string;
  keywords: string[];
  category?: string;
}

export function useAddFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddFaqInput) =>
      api.post('/settings/faqs', {
        question: input.question,
        answer: input.answer,
        keywords: input.keywords,
        category: input.category,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: faqsKeys.all }),
  });
}

export function useToggleFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/settings/faqs/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: faqsKeys.all }),
  });
}

export function useDeleteFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/settings/faqs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: faqsKeys.all }),
  });
}

export function useSaveSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => api.post('/settings', { key, value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}
