import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Observable, combineLatest, of } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { InvoiceService, Invoice } from '../services/invoice.service';
import { AuthService } from '../services/auth.service';

@Component({
    selector: 'app-reminders',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './reminders.component.html',
    styleUrl: './reminders.component.scss'
})
export class RemindersComponent implements OnInit {
    private invoiceService = inject(InvoiceService);
    private authService = inject(AuthService);
    private fb = inject(FormBuilder);

    today = new Date();
    purchases$!: Observable<Invoice[]>;
    isLoading = true;

    searchControl = new FormControl('');
    dateRangeForm: FormGroup;

    constructor() {
        this.dateRangeForm = this.fb.group({
            start: [''],
            end: ['']
        });
    }

    ngOnInit(): void {
        const invoices$ = this.authService.user$.pipe(
            switchMap(user => {
                if (!user) return of([]);
                return this.invoiceService.getUserInvoices(user.uid);
            })
        );

        this.purchases$ = combineLatest([
            invoices$,
            this.searchControl.valueChanges.pipe(startWith('')),
            this.dateRangeForm.valueChanges.pipe(startWith(this.dateRangeForm.value))
        ]).pipe(
            map(([invoices, search, dates]) => {
                this.isLoading = false;
                const term = (search || '').toLowerCase();
                
                return invoices.filter(inv => {
                    // Filter by search term
                    const matchesSearch = !term || 
                        (inv.assetName && inv.assetName.toLowerCase().includes(term)) ||
                        (inv.description && inv.description.toLowerCase().includes(term)) ||
                        (inv.id && inv.id.toLowerCase().includes(term));

                    // Filter by date range
                    let matchesDate = true;
                    if (inv.createdAt && inv.createdAt.toDate) {
                        const date = inv.createdAt.toDate();
                        if (dates.start) matchesDate = matchesDate && date >= new Date(dates.start);
                        if (dates.end) {
                            const end = new Date(dates.end);
                            end.setHours(23, 59, 59, 999);
                            matchesDate = matchesDate && date <= end;
                        }
                    }
                    
                    return matchesSearch && matchesDate;
                });
            })
        );
    }
}