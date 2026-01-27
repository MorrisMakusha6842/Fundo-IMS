import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinancialInsightComponent } from './financial-insight.component';

describe('FinancialInsightComponent', () => {
  let component: FinancialInsightComponent;
  let fixture: ComponentFixture<FinancialInsightComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialInsightComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinancialInsightComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
