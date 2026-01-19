import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        // 1. If user is not logged in, redirect to login/signup
        if (!user) {
          return of(this.router.createUrlTree(['/signup/client']));
        }

        // 2. If route has role data, check the role
        const allowedRoles = route.data['roles'] as Array<string>;
        if (allowedRoles && allowedRoles.length > 0) {
          return this.auth.userRole$.pipe(
            take(1),
            map(userRole => {
              // If user has one of the allowed roles, grant access
              return userRole && allowedRoles.includes(userRole)
                ? true
                : this.router.createUrlTree(['/main-layout/dashboard']); // Redirect if role mismatch
            })
          );
        }
        // 3. If user is logged in and no specific roles are required, grant access
        return of(true);
      })
    );
  }
}
