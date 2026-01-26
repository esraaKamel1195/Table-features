import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { customersData } from './customer';

@Injectable()
export class CustomerService {
  getData() {
    return customersData;
  }

  constructor(private http: HttpClient) {}

  getCustomersMini() {
    return Promise.resolve(this.getData().slice(0, 5));
  }

  getCustomersSmall() {
    return Promise.resolve(this.getData().slice(0, 10));
  }

  getCustomersMedium() {
    return Promise.resolve(this.getData().slice(0, 50));
  }

  getCustomersLarge() {
    return Promise.resolve(this.getData().slice(0, 200));
  }

  getCustomersXLarge() {
    return Promise.resolve(this.getData());
  }

  getCustomers(params?: any) {
    return this.http
      .get<any>('https://www.primefaces.org/data/customers', { params: params })
      .toPromise();
  }
}
