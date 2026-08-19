import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { KnowledgeFileDto } from '@omni/shared';

export const knowledgeKeys = {
  files: ['knowledge', 'files'] as const,
};

export function useKnowledgeFilesQuery() {
  return useQuery({
    queryKey: knowledgeKeys.files,
    queryFn: () => api.get<KnowledgeFileDto[]>('/knowledge/files'),
    refetchInterval: (query) =>
      query.state.data?.some((f) => f.status === 'processing') ? 3000 : false,
  });
}

export function useUploadFilesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append('files', f);
      return api.postForm<{ ok: boolean; count: number }>('/knowledge/files', form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: knowledgeKeys.files }),
  });
}

export function useDeleteKnowledgeFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/knowledge/files/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: knowledgeKeys.files }),
  });
}
