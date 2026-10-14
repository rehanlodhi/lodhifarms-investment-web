export interface Investor { id: string; name: string; email?: string | null; phone?: string | null; type_ids?: string[] }
export interface InvestmentType { id: string; name: string; goal: number; auto_goal?: boolean; description?: string | null }
export interface Investment {
  id: string; investor_id: string; type_id: string; amount: number; date: string; month?: string;
  note?: string | null; screenshots: string[]; investor_name: string; type_name: string;
}
export interface Stats {
  total_raised: number; total_goal: number;
  types: { id: string; name: string; goal: number; auto_goal: boolean; raised: number }[];
  type_months: { id: string; name: string; months: Record<string, number> }[];
  investors: { id: string; name: string; invested: number }[];
  monthly: { month: string; amount: number }[];
}

export interface RequestItem {
  id: string; type_id: string; amount: number; start_month: string; recurring: boolean;
  end_month?: string | null; investor_ids: string[]; note?: string | null;
}
export type RequestForm = Omit<RequestItem, 'id'>;
export interface TypeDues { id: string; name: string; paid: number; owed: number; remaining: number; ahead: number }
export interface InvestorDues { as_of: string; investors: { id: string; name: string; types: TypeDues[] }[] }
