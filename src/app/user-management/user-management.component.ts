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
...
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

  async onDeleteUser(user: any) {
  if (confirm(`Are you sure you want to delete user ${user.displayName || 'Unknown'}? This action cannot be undone.`)) {
    this.isLoading = true;
    try {
      await this.userService.deleteUser(user.uid);
      await this.fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user.');
    } finally {
      this.isLoading = false;
    }
  }
}

  async openViewModal(user: any) {
  this.selectedUser = user;
  this.selectedUserVehicles = [];
  this.isViewModalOpen = true;

  if (user && user.uid) {
    this.selectedUserVehicles = await this.vehicleService.getByUserId(user.uid);
  }
