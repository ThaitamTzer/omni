import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PageDto } from '@omni/shared';

export const pagesKeys = {
  all: ['pages'] as const,
};

export interface AddPageInput {
  fbPageId: string;
  name: string;
  accessToken: string;
  verifyToken: string;
}

export function usePagesQuery() {
  return useQuery({
    queryKey: pagesKeys.all,
    queryFn: () => api.get<PageDto[]>('/pages'),
  });
}

export function useAddPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddPageInput) =>
      api.post('/pages', {
        fbPageId: input.fbPageId,
        name: input.name,
        accessToken: input.accessToken,
        verifyToken: input.verifyToken,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pagesKeys.all }),
  });
}

export function useRemovePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/pages/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pagesKeys.all }),
  });
}
