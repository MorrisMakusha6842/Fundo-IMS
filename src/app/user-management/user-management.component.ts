import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { Firestore, collection, query, orderBy, getDocs, getFirestore } from 'firebase/firestore';
import { UserService } from '../services/user.service';
import { VehicleRegisterService } from '../services/vehicle-register.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  private userService = inject(UserService);
  private firestore = getFirestore();
  private vehicleService = inject(VehicleRegisterService);
  private fb = inject(FormBuilder);

  users: any[] = [];
  filteredUsers: any[] = [];
  searchControl = new FormControl('');
  isLoading = false;

  // Modal States
  isViewModalOpen = false;
  isCreateModalOpen = false;

  // Selected Data
  // Pagination
  currentPage = 1;
  pageSize = 10;

  selectedUser: any = null;
  selectedUserVehicles: any[] = [];

  createUserForm!: FormGroup;

  async ngOnInit() {
    this.createUserForm = this.fb.group({
      displayName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['client', Validators.required],
      company: [''],
      location: ['']
    });

    this.searchControl.valueChanges.subscribe(val => {
      this.filterUsers(val);
    });

    await this.fetchUsers();
  }

  async fetchUsers() {
    this.isLoading = true;
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q).catch(() => getDocs(usersRef));

      this.users = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      this.filteredUsers = [...this.users];
      this.filterUsers(this.searchControl.value);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      this.isLoading = false;
    }
  }

  filterUsers(term: string | null) {
    this.currentPage = 1;
    const lowerTerm = (term || '').toLowerCase();
    this.filteredUsers = this.users.filter(user => 
      (user.displayName || '').toLowerCase().includes(lowerTerm) ||
      (user.email || '').toLowerCase().includes(lowerTerm)
    );
  }

  async openViewModal(user: any) {
    this.selectedUser = user;
    this.selectedUserVehicles = [];
    this.isViewModalOpen = true;

    if (user && user.uid) {
      this.selectedUserVehicles = await this.vehicleService.getByUserId(user.uid);
    }
  }

  closeViewModal() {
    this.isViewModalOpen = false;
    this.selectedUser = null;
    this.selectedUserVehicles = [];
  }

  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.pageSize);
  }

  get paginatedUsers(): any[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(startIndex, startIndex + this.pageSize);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  async onRoleChange(event: any, uid: string) {
    const newRole = event.target.value;
    try {
      await this.userService.updateUserProfile(uid, { role: newRole });
      const user = this.users.find(u => u.uid === uid);
      if (user) user.role = newRole;
      if (this.selectedUser?.uid === uid) this.selectedUser.role = newRole;
    } catch (error) {
      console.error('Error updating role:', error);
    }
  }

  async onCreateUser() {
    if (this.createUserForm.invalid) return;
    this.isLoading = true;
    try {
      const { email, password, displayName, role, company, location } = this.createUserForm.value;
      
      const profileData = {
        company,
        location,
        role,
        usa: {
          usaStatus: 'agreed',
          agreedAt: Date.now()
        }
      };

      await this.userService.createUser(email, password, displayName, profileData);
      
      this.closeCreateModal();
      await this.fetchUsers();
    } catch (error) {
      console.error('Create user error', error);
      alert('Failed to create user: ' + (error as any).message);
    } finally {
      this.isLoading = false;
    }
  }

  openCreateModal() {
    this.createUserForm.reset({ role: 'client' });
    this.isCreateModalOpen = true;
  }

  closeCreateModal() {
    this.isCreateModalOpen = false;
  }

  async onCreateUser() {
    if (this.createUserForm.invalid) return;
    this.isLoading = true;
    try {
      const { email, password, displayName, role, company, location } = this.createUserForm.value;
      const cred = await this.userService.createUser(email, password, displayName, { company, location });

      if (cred.user) {
        await this.userService.updateUserProfile(cred.user.uid, { role });
      }

      this.closeCreateModal();
      await this.fetchUsers();
    } catch (error) {
      console.error('Create user error', error);
      alert('Failed to create user: ' + (error as any).message);
    } finally {
      this.isLoading = false;
    }
  }

  getInitials(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }
}
