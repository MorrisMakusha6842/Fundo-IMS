import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehicleRegisterComponent } from './vehicle-register.component';

describe('VehicleRegisterComponent', () => {
  let component: VehicleRegisterComponent;
  let fixture: ComponentFixture<VehicleRegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleRegisterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehicleRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
