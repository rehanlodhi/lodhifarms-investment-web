export interface Investor { id: string; name: string; email?: string | null; phone?: string | null }
export interface InvestmentType { id: string; name: string; goal: number; description?: string | null }
export interface Investment {
  id: string; investor_id: string; type_id: string; amount: number; date: string; month?: string;
  note?: string | null; screenshots: string[]; investor_name: string; type_name: string;
}
export interface Stats {
  total_raised: number; total_goal: number;
  types: { id: string; name: string; goal: number; raised: number }[];
  type_months: { id: string; name: string; months: Record<string, number> }[];
  investors: { id: string; name: string; invested: number }[];
  monthly: { month: string; amount: number }[];
}
