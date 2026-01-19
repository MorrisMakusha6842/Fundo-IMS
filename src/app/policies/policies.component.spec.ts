import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoliciesComponent } from './policies.component';
import { PolicyService } from '../services/policy.service';
import { ToastService } from '../services/toast.service';
import { of } from 'rxjs';

describe('PoliciesComponent', () => {
  let component: PoliciesComponent;
  let fixture: ComponentFixture<PoliciesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoliciesComponent],
      providers: [
        {
          provide: PolicyService,
          useValue: {
            getSubCategories: () => of([]),
            getAllPolicies: () => of([]),
            addSubCategory: () => Promise.resolve(),
            addPolicy: () => Promise.resolve(),
            deleteSubCategory: () => Promise.resolve(),
            deletePolicy: () => Promise.resolve()
          }
        },
        {
          provide: ToastService,
          useValue: {
            show: () => {}
          }
        }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PoliciesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
