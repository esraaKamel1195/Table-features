import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CustomTable } from "./custem-table/custom-table";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CustomTable],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('table-features');
}
