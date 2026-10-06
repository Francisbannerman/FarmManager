// Wire types for the Farm Manager API. Property names and enum values match the
// backend's JSON exactly (camelCase properties, camelCase enum strings).

export type SectionType =
  | "tomatoes" | "maize" | "beans" | "garden" | "walkway"
  | "irrigation" | "bush" | "orchard" | "fallow" | "infrastructure"
  | "greenhouse" | "flowers" | "sugarcane" | "potatoes"
  | "waterPump" | "pipe" | "sprinkler";

export type Priority = "low" | "medium" | "high";
export type FinanceType = "income" | "expense";

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  fullName: string;
  tokens: AuthTokens;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
}

export interface Farm {
  id: string;
  name: string;
  widthMeters: number;
  heightMeters: number;
  cellSizeMeters: number;
  gridColumns: number;
  gridRows: number;
  totalAreaAcres: number;
  mappedAreaAcres: number;
  createdAt: string;
}

export interface ResizeFarmResult {
  farm: Farm;
  clearedCellCount: number;
}

export interface SectionDto {
  id: string;
  farmId: string;
  name: string;
  type: SectionType;
  typeLabel: string;
  icon: string;
  color: string;
  cropDetails: string;
  plantDate: string | null;
  harvestDate: string | null;
  waterSchedule: string;
  notes: string;
  cellCount: number;
  areaAcres: number;
  areaSquareMeters: number;
  percentOfFarm: number;
  pendingTaskCount: number;
  totalIncome: number;
  totalExpense: number;
  createdAt: string;
}

export interface SectionInput {
  name: string;
  type: SectionType;
  color: string;
  cropDetails: string | null;
  plantDate: string | null;
  harvestDate: string | null;
  waterSchedule: string | null;
  notes: string | null;
}

export interface GridCellDto {
  row: number;
  col: number;
  sectionId: string;
}

export interface GridSnapshot {
  farmId: string;
  gridColumns: number;
  gridRows: number;
  cellSizeMeters: number;
  cells: GridCellDto[];
}

export interface GridCellChange {
  row: number;
  col: number;
  sectionId: string | null;
}

export interface TaskDto {
  id: string;
  farmId: string;
  title: string;
  sectionId: string | null;
  sectionName: string | null;
  dueDate: string;
  priority: Priority;
  done: boolean;
  completedDate: string | null;
  estimatedCost: number;
  notes: string;
  isOverdue: boolean;
  createdAt: string;
}

export interface TaskInput {
  title: string;
  sectionId: string | null;
  dueDate: string;
  priority: Priority;
  estimatedCost: number | null;
  notes: string | null;
}

export interface FinanceRecordDto {
  id: string;
  farmId: string;
  date: string;
  type: FinanceType;
  category: string;
  amount: number;
  description: string;
  sectionId: string | null;
  sectionName: string | null;
  createdAt: string;
}

export interface FinanceRecordInput {
  date: string;
  type: FinanceType;
  category: string;
  amount: number;
  description: string;
  sectionId: string | null;
}

export interface MonthlyFinance {
  year: number;
  month: number;
  monthLabel: string;
  income: number;
  expense: number;
  profit: number;
}

export interface CumulativeProfitPoint {
  year: number;
  month: number;
  monthLabel: string;
  cumulative: number;
}

export interface SectionFinanceBreakdown {
  sectionId: string;
  sectionName: string;
  icon: string;
  color: string;
  income: number;
  expense: number;
  profit: number;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  roiPercent: number;
  projectedAnnualIncome: number;
  monthlyBreakdown: MonthlyFinance[];
  cumulativeProfit: CumulativeProfitPoint[];
  bySection: SectionFinanceBreakdown[];
}
