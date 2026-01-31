import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { InvoiceService, Invoice } from '../services/invoice.service';
import { AuthService } from '../services/auth.service';
import { Observable, combineLatest, map, startWith, of, switchMap } from 'rxjs';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-history.component.html',
  styleUrls: ['./payment-history.component.scss']
})
export class PaymentHistoryComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  filterForm: FormGroup;
  filteredInvoices$: Observable<Invoice[]> = of([]);

  // Pagination State
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  paginatedInvoices: Invoice[] = [];
  allFilteredInvoices: Invoice[] = [];
  isLoading = true;

  constructor() {
    this.filterForm = this.fb.group({
      search: [''],
      startDate: [''],
      endDate: ['']
    });
  }

  ngOnInit() {
    const invoices$ = this.authService.userRole$.pipe(
      switchMap(role => {
        if (role === 'admin' || role === 'agent') {
          return this.invoiceService.getAllInvoices();
        } else {
          const user = this.authService.currentUser;
          return user ? this.invoiceService.getUserInvoices(user.uid) : of([]);
        }
      })
    );

    this.filteredInvoices$ = combineLatest([
      invoices$,
      this.filterForm.valueChanges.pipe(startWith(this.filterForm.value))
    ]).pipe(
      map(([invoices, filters]) => {
        this.isLoading = false;
        return invoices.filter(inv => {
          const term = (filters.search || '').toLowerCase();
          const matchesSearch = !term ||
            (inv.id && inv.id.toLowerCase().includes(term)) ||
            (inv.clientName && inv.clientName.toLowerCase().includes(term)) ||
            (inv.description && inv.description.toLowerCase().includes(term));

          let matchesDate = true;
          if (inv.createdAt && inv.createdAt.toDate) {
            const date = inv.createdAt.toDate();
            if (filters.startDate) matchesDate = matchesDate && date >= new Date(filters.startDate);
            if (filters.endDate) {
              const end = new Date(filters.endDate);
              end.setHours(23, 59, 59, 999);
              matchesDate = matchesDate && date <= end;
            }
          }
          return matchesSearch && matchesDate;
        });
      })
    );

    this.filteredInvoices$.subscribe(data => {
      this.allFilteredInvoices = data;
      this.totalPages = Math.ceil(data.length / this.pageSize) || 1;
      this.currentPage = 1;
      this.updatePagination();
    });
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedInvoices = this.allFilteredInvoices.slice(startIndex, startIndex + this.pageSize);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  downloadInvoice(invoice: Invoice) {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 113, 227); // Brand Blue
    doc.text('INVOICE', 105, 20, { align: 'center' });
    
    // Meta Info
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Invoice ID: ${invoice.id}`, 14, 40);
    doc.text(`Date: ${new Date(invoice.createdAt?.toDate()).toLocaleDateString()}`, 14, 46);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 14, 52);

    // Client Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Bill To: ${invoice.clientName}`, 14, 70);

    // Line Item
    doc.setDrawColor(200);
    doc.line(14, 85, 196, 85);
    doc.text('Description', 14, 92);
    doc.text('Amount', 180, 92, { align: 'right' });
    doc.line(14, 95, 196, 95);

    doc.text(invoice.description || 'Insurance Premium', 14, 105);
    doc.text(`$${invoice.amount.toFixed(2)}`, 180, 105, { align: 'right' });

    doc.save(`Invoice_${invoice.id}.pdf`);
  }
}