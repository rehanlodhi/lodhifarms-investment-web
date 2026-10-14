import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBar } from './core/loading';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopBar],
  template: '<app-top-bar /><router-outlet />',
})
export class App {}
