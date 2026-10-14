import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Investment, InvestmentType, Investor, InvestorDues, RequestForm, RequestItem, Stats } from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  investorDues() { return this.http.get<InvestorDues>('/api/stats/investors'); }

  requests() { return this.http.get<RequestItem[]>('/api/requests'); }
  saveRequest(v: RequestForm, id?: string) {
    return id ? this.http.put<RequestItem>(`/api/requests/${id}`, v) : this.http.post<RequestItem>('/api/requests', v);
  }
  deleteRequest(id: string) { return this.http.delete(`/api/requests/${id}`); }

  stats() { return this.http.get<Stats>('/api/stats'); }

  investors() { return this.http.get<Investor[]>('/api/investors'); }
  saveInvestor(v: Partial<Investor>, id?: string) {
    return id ? this.http.put<Investor>(`/api/investors/${id}`, v) : this.http.post<Investor>('/api/investors', v);
  }
  deleteInvestor(id: string) { return this.http.delete(`/api/investors/${id}`); }

  types() { return this.http.get<InvestmentType[]>('/api/investment-types'); }
  saveType(v: Partial<InvestmentType>, id?: string) {
    return id ? this.http.put<InvestmentType>(`/api/investment-types/${id}`, v) : this.http.post<InvestmentType>('/api/investment-types', v);
  }
  deleteType(id: string) { return this.http.delete(`/api/investment-types/${id}`); }

  investments() { return this.http.get<Investment[]>('/api/investments'); }
  saveInvestment(form: FormData, id?: string) {
    return id ? this.http.put<Investment>(`/api/investments/${id}`, form) : this.http.post<Investment>('/api/investments', form);
  }
  bulkAddInvestments(body: {
    investor_ids: string[]; type_id: string; amount: number; date: string; month: string;
    note: string | null; skip_existing: boolean;
  }) {
    return this.http.post<{ created: number; skipped: number }>('/api/investments/bulk', body);
  }
  bulkDeleteInvestments(ids: string[]) {
    return this.http.post<{ deleted: number }>('/api/investments/bulk-delete', { ids });
  }
  deleteInvestment(id: string) { return this.http.delete(`/api/investments/${id}`); }
  addScreenshots(id: string, files: File[]) {
    const fd = new FormData();
    files.forEach((f) => fd.append('screenshots', f));
    return this.http.post<Investment>(`/api/investments/${id}/screenshots`, fd);
  }
  replaceScreenshot(id: string, name: string, file: File) {
    const fd = new FormData();
    fd.set('screenshot', file);
    return this.http.put<Investment>(`/api/investments/${id}/screenshots/${name}`, fd);
  }
  deleteScreenshot(id: string, name: string) { return this.http.delete(`/api/investments/${id}/screenshots/${name}`); }
}
