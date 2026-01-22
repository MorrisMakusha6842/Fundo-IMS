import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserManagementComponent } from './user-management.component';
import { AssetsService } from '../services/assets.service';
import { of } from 'rxjs';

class MockAssetsService {
  getUserVehicles(uid: string) {
    return of([]);
  }
}

describe('UserManagementComponent', () => {
  let component: UserManagementComponent;
  let fixture: ComponentFixture<UserManagementComponent>;
  let assetsService: AssetsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserManagementComponent],
      providers: [
        { provide: AssetsService, useClass: MockAssetsService }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(UserManagementComponent);
    component = fixture.componentInstance;
    assetsService = TestBed.inject(AssetsService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch user vehicles when opening view modal', () => {
    const user = { uid: 'test-uid', displayName: 'Test User', email: 'test@example.com' };
    const spy = spyOn(assetsService, 'getUserVehicles').and.returnValue(of([]));
    
    component.openViewModal(user);
    
    expect(spy).toHaveBeenCalledWith('test-uid');
    expect(component.selectedUser).toEqual(user);
    expect(component.isViewModalOpen).toBeTrue();
  });
});
