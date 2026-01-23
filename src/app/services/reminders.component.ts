import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { RemindersService, Reminder } from '../services/reminders.service';
import { ToastService } from '../services/toast.service';

@Component({
    selector: 'app-reminders',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './reminders.component.html',
    styleUrl: './reminders.component.scss'
})
export class RemindersComponent implements OnInit {
    private remindersService = inject(RemindersService);
    private fb = inject(FormBuilder);
    private toast = inject(ToastService);

    today = new Date();
    reminders$!: Observable<Reminder[]>;
    isLoading = true;

    isModalOpen = false;
    isSubmitting = false;
    reminderForm!: FormGroup;

    ngOnInit(): void {
        this.reminders$ = this.remindersService.getReminders();
        this.reminders$.subscribe(() => this.isLoading = false);

        this.reminderForm = this.fb.group({
            title: ['', Validators.required],
            description: [''],
            dueDate: ['', Validators.required],
            type: ['custom', Validators.required]
        });
    }

    openModal(): void {
        this.isModalOpen = true;
        this.reminderForm.reset({
            type: 'custom' // Default value
        });
    }

    closeModal(): void {
        this.isModalOpen = false;
    }

    async onSubmit(): Promise<void> {
        if (this.reminderForm.invalid) {
            this.toast.show('Please fill in all required fields.', 'error');
            return;
        }

        this.isSubmitting = true;
        try {
            const formValue = this.reminderForm.value;
            await this.remindersService.createReminder(formValue);
            this.toast.show('Reminder created successfully!', 'success');
            this.closeModal();
        } catch (error) {
            console.error('Error creating reminder:', error);
            this.toast.show('Failed to create reminder.', 'error');
        } finally {
            this.isSubmitting = false;
        }
    }
}