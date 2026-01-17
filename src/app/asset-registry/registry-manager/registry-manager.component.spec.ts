import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistryManagerComponent } from './registry-manager.component';

describe('RegistryManagerComponent', () => {
  let component: RegistryManagerComponent;
  let fixture: ComponentFixture<RegistryManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistryManagerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistryManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
