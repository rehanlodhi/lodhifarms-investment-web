import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Investment, InvestmentType, Investor, Stats } from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

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
