import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Phòng ban trả về từ `GET /departments`. Backend đã lọc theo phạm vi của người gọi. */
export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  memberCount: number;
}

export const departmentKeys = {
  all: ['departments'] as const,
};

export function useDepartments(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: departmentKeys.all,
    queryFn: () => api.get<DepartmentRow[]>('/departments'),
    enabled: options.enabled ?? true,
  });
}
