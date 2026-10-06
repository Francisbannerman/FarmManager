import { api } from "./client";
import type {
  Farm, FinanceRecordDto, FinanceRecordInput, FinanceSummary, FinanceType, GridCellChange, GridSnapshot,
  ResizeFarmResult, SectionDto, SectionInput, TaskDto, TaskInput,
} from "./types";

// Every farm-scoped body also carries `farmId`; the server takes the id from the
// route and ignores the body copy, but sending it keeps the payload a valid
// instance of the backend command record.

export const farmsApi = {
  list: () => api<Farm[]>("/farms"),
  create: (input: { name: string; widthMeters: number; heightMeters: number }) =>
    api<Farm>("/farms", { method: "POST", body: input }),
  rename: (farmId: string, name: string) =>
    api<Farm>(`/farms/${farmId}`, { method: "PUT", body: { farmId, name } }),
  resize: (farmId: string, widthMeters: number, heightMeters: number) =>
    api<ResizeFarmResult>(`/farms/${farmId}/resize`, { method: "POST", body: { farmId, widthMeters, heightMeters } }),
};

export const sectionsApi = {
  list: (farmId: string) => api<SectionDto[]>(`/farms/${farmId}/sections`),
  create: (farmId: string, input: SectionInput) =>
    api<SectionDto>(`/farms/${farmId}/sections`, { method: "POST", body: { farmId, ...input } }),
  update: (farmId: string, sectionId: string, input: SectionInput) =>
    api<SectionDto>(`/farms/${farmId}/sections/${sectionId}`, { method: "PUT", body: { farmId, sectionId, ...input } }),
  remove: (farmId: string, sectionId: string) =>
    api<void>(`/farms/${farmId}/sections/${sectionId}`, { method: "DELETE" }),
};

export const gridApi = {
  get: (farmId: string) => api<GridSnapshot>(`/farms/${farmId}/grid`),
  update: (farmId: string, changes: GridCellChange[]) =>
    api<GridSnapshot>(`/farms/${farmId}/grid`, { method: "PUT", body: { changes } }),
};

export const tasksApi = {
  list: (farmId: string) => api<TaskDto[]>(`/farms/${farmId}/tasks`),
  create: (farmId: string, input: TaskInput) =>
    api<TaskDto>(`/farms/${farmId}/tasks`, { method: "POST", body: { farmId, ...input } }),
  toggle: (farmId: string, taskId: string) =>
    api<TaskDto>(`/farms/${farmId}/tasks/${taskId}/toggle`, { method: "PATCH" }),
  remove: (farmId: string, taskId: string) =>
    api<void>(`/farms/${farmId}/tasks/${taskId}`, { method: "DELETE" }),
};

export const financeApi = {
  summary: (farmId: string) => api<FinanceSummary>(`/farms/${farmId}/finance/summary`),
  records: (farmId: string, opts: { type?: FinanceType; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.type) q.set("type", opts.type);
    q.set("page", String(opts.page ?? 1));
    q.set("pageSize", String(opts.pageSize ?? 50));
    return api<FinanceRecordDto[]>(`/farms/${farmId}/finance/records?${q.toString()}`);
  },
  create: (farmId: string, input: FinanceRecordInput) =>
    api<FinanceRecordDto>(`/farms/${farmId}/finance/records`, { method: "POST", body: { farmId, ...input } }),
  remove: (farmId: string, recordId: string) =>
    api<void>(`/farms/${farmId}/finance/records/${recordId}`, { method: "DELETE" }),
};
