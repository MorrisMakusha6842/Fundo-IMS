import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Observable, combineLatest, of } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { AssetsService } from '../services/assets.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export interface DisplayReminder {
    title: string;
    description: string;
    dueDate: Date | null;
    severity: string;
    statusText: string;
    type: 'Asset Expiry' | 'Custom';
    id?: string;
}

@Component({
    selector: 'app-reminders',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './reminders.component.html',
    styleUrl: './reminders.component.scss'
})
export class RemindersComponent implements OnInit {
    private assetsService = inject(AssetsService);
    private authService = inject(AuthService);
    private fb = inject(FormBuilder);
    private toast = inject(ToastService);

    today = new Date();
    reminders$!: Observable<DisplayReminder[]>;
    isLoading = true;

    isCreateModalOpen = false;
    isViewModalOpen = false;
    isSubmitting = false;
    reminderForm!: FormGroup;
    searchControl = new FormControl('');
    severityControl = new FormControl('All');
    selectedReminder: DisplayReminder | null = null;

    ngOnInit(): void {
        this.reminderForm = this.fb.group({
            title: ['', Validators.required],
            description: [''],
            dueDate: ['', Validators.required],
        });

        const assetReminders$ = this.authService.userRole$.pipe(
            switchMap(role => {
                const user = this.authService.currentUser;
                if (!user) return of([]);
                return (role === 'admin' || role === 'agent')
                    ? this.assetsService.getAllVehicles()
                    : this.assetsService.getUserVehicles(user.uid);
            }),
            map(assets => {
                console.log('Reminders: Fetched assets', assets);
                const reminders: DisplayReminder[] = [];
                assets.forEach(asset => {
                    // Check documents
                    (asset.documents || []).forEach(doc => {
                        if (doc.expiryDate) {
                            const dueDate = new Date(doc.expiryDate);
                            const { severity, statusText } = this.calculateSeverity(dueDate);
                            reminders.push({
                                title: `${asset.year} ${asset.make}`,
                                description: doc.field || doc.name || 'Document',
                                dueDate: dueDate,
                                severity: severity,
                                statusText: statusText,
                                type: 'Asset Expiry',
                                id: asset.id
                            });
                        }
                    });
                });
                return reminders;
            })
        );

        this.reminders$ = combineLatest([
            assetReminders$,
            this.searchControl.valueChanges.pipe(startWith('')),
            this.severityControl.valueChanges.pipe(startWith('All'))
        ]).pipe(
            map(([assetReminders, searchTerm, severityFilter]) => {
                this.isLoading = false;
                let filtered = [...assetReminders].sort((a, b) => {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return a.dueDate.getTime() - b.dueDate.getTime();
                });

                // Filter by Severity
                if (severityFilter && severityFilter !== 'All') {
                    filtered = filtered.filter(r => r.severity === severityFilter.toLowerCase());
                }

                // Filter by Search
                const term = (searchTerm || '').toLowerCase();
                if (term) {
                    filtered = filtered.filter(r => r.title.toLowerCase().includes(term) || r.description.toLowerCase().includes(term));
                }

                return filtered;
            })
        );
    }

    calculateSeverity(dueDate: Date | null): { severity: string, statusText: string } {
        if (!dueDate) {
            return { severity: 'expired', statusText: 'Date Missing' };
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);

        const diffTime = due.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { severity: 'expired', statusText: `Expired ${Math.abs(diffDays)} day(s) ago` };
        if (diffDays <= 2) return { severity: 'red', statusText: `Due in ${diffDays} day(s)` };
        if (diffDays <= 7) return { severity: 'orange', statusText: `Due in ${diffDays} days` };
        if (diffDays <= 30) return { severity: 'yellow', statusText: `Due in ${diffDays} days` };
        return { severity: 'green', statusText: `Due in ${diffDays} days` };
    }

    openCreateModal(): void {
        this.isCreateModalOpen = true;
        this.reminderForm.reset();
    }

    closeCreateModal(): void {
        this.isCreateModalOpen = false;
    }

    openViewModal(reminder: DisplayReminder): void {
        this.selectedReminder = reminder;
        this.isViewModalOpen = true;
    }

    closeViewModal(): void {
        this.isViewModalOpen = false;
        this.selectedReminder = null;
    }

    async onSubmit(): Promise<void> {
        if (this.reminderForm.invalid) return;
        this.isSubmitting = true;
        // Simulate creation
        setTimeout(() => {
            this.toast.show('Custom reminder created (Demo)', 'success');
            this.isSubmitting = false;
            this.closeCreateModal();
        }, 1000);
    }
}