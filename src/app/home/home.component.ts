import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PolicyService } from '../services/policy.service';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private policyService = inject(PolicyService);
  private firestore = inject(Firestore);

  subCategories$: Observable<any[]> | undefined;
  filteredPolicies$: Observable<any[]> | undefined;

  selectedCategorySubject = new BehaviorSubject<string | null>(null);
  selectedCategory$ = this.selectedCategorySubject.asObservable();

  ngOnInit() {
    this.subCategories$ = this.policyService.getSubCategories();

    this.filteredPolicies$ = this.selectedCategory$.pipe(
      switchMap(categoryId => {
        if (!categoryId) {
          return this.policyService.getAllPolicies();
        } else {
          // Fetch policies for specific sub-category
          const colRef = collection(this.firestore, `sub-categories/${categoryId}/policies`);
          return collectionData(colRef, { idField: 'id' });
        }
      }),
      catchError(err => {
        console.error('Error fetching policies:', err);
        return of([]);
      })
    );
  }

  selectCategory(categoryId: string) {
    const current = this.selectedCategorySubject.value;
    if (current === categoryId) {
      this.selectedCategorySubject.next(null); // Deselect
    } else {
      this.selectedCategorySubject.next(categoryId);
    }
  }
}
