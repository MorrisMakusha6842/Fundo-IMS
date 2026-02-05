import { TestBed } from '@angular/core/testing';

import { ClaimsService } from './claims.service';
import { Firestore } from '@angular/fire/firestore';

describe('ClaimsService', () => {
    let service: ClaimsService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                { provide: Firestore, useValue: {} }
            ]
        });
        service = TestBed.inject(ClaimsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});