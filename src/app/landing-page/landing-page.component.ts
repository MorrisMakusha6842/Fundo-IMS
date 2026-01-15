import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
  selector: 'app-landing-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
    constructor(private router: Router) {}
  parentError: string | null = null;

  continue(form: NgForm) {
    // Only continue when parent form is valid. The template also disables the button.
    this.parentError = null;
    if (!form || form.invalid) return;
    const vals = form.value as any;
    if (vals.password !== vals.confirmPassword) {
      this.parentError = 'Passwords do not match.';
      return;
    }
    // Pass the parent form values to the signup child via navigation state
    this.router.navigate(['/signup/client'], { state: { parentData: { email: vals.email, password: vals.password, confirmPassword: vals.confirmPassword } } });
  }
}


