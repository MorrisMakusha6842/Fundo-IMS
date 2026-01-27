import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinancialInsightService, FinancialRecord } from './financial-insight.service';
import { AuthService } from '../services/auth.service';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-financial-insight',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './financial-insight.component.html',
  styleUrl: './financial-insight.component.scss'
})
export class FinancialInsightComponent implements OnInit {
  private financialService = inject(FinancialInsightService);
  private authService = inject(AuthService);
  private auth = inject(Auth);

  history$ = this.financialService.getHistory();

  // Draft State
  draftRecord: Partial<FinancialRecord> = {
    currentTaxRate: 0,
    currentFxRate: 0
  };

  previousRecord: FinancialRecord | null = null;
  currentUser: any = null;
  today = new Date();

  // Modal States
  activeModal: 'tax' | 'fx' | 'password' | null = null;
  tempValue: number = 0;
  password: string = '';
  isSaving = false;
  errorMessage: string = '';

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.currentUser = user;
    });

    this.loadLatestData();
  }

  async loadLatestData() {
    this.previousRecord = await this.financialService.getLatestRecord();

    // Initialize draft with previous values or defaults readonly for history
    this.draftRecord = {
      previousTaxRate: this.previousRecord?.currentTaxRate || 0,
      previousFxRate: this.previousRecord?.currentFxRate || 0,
      currentTaxRate: this.previousRecord?.currentTaxRate || 0,
      currentFxRate: this.previousRecord?.currentFxRate || 0
    };
  }

  openValueModal(type: 'tax' | 'fx') {
    this.activeModal = type;
    this.tempValue = type === 'tax' ? (this.draftRecord.currentTaxRate || 0) : (this.draftRecord.currentFxRate || 0);
  }

  saveValueModal() {
    if (this.activeModal === 'tax') {
      this.draftRecord.currentTaxRate = this.tempValue;
    } else if (this.activeModal === 'fx') {
      this.draftRecord.currentFxRate = this.tempValue;
    }
    this.closeModal();
  }

  initiateSave() {
    this.password = '';
    this.errorMessage = '';
    this.activeModal = 'password';
  }

  closeModal() {
    this.activeModal = null;
    this.errorMessage = '';
  }

  async confirmSave() {
    if (!this.password || !this.currentUser?.email) return;

    this.isSaving = true;
    this.errorMessage = '';

    try {
      // Re-authenticate user
      await signInWithEmailAndPassword(this.auth, this.currentUser.email, this.password);

      // Prepare Record
      const newRecord: FinancialRecord = {
        dateApplied: Timestamp.now(),
        appliedBy: {
          uid: this.currentUser.uid,
          displayName: this.currentUser.displayName || 'Unknown'
        },
        previousTaxRate: this.draftRecord.previousTaxRate || 0,
        currentTaxRate: this.draftRecord.currentTaxRate || 0,
        previousFxRate: this.draftRecord.previousFxRate || 0,
        currentFxRate: this.draftRecord.currentFxRate || 0,
        taxRateId: `TAX-${Date.now()}` // Simple unique ID generation
      };

      await this.financialService.addRecord(newRecord);
      this.closeModal();
      this.loadLatestData(); // Refresh baseline
    } catch (error: any) {
      console.error('Error saving record:', error);
      this.errorMessage = 'Incorrect password or permission denied.';
    } finally {
      this.isSaving = false;
    }
  }
}
