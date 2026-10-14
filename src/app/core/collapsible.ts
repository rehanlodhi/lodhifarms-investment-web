import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** A card with a clickable header that shows/hides its content. Collapsed by default. */
@Component({
  selector: 'app-collapsible',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card collapsible">
      <button type="button" class="collapse-head" [attr.aria-expanded]="open()" (click)="open.set(!open())">
        <span>{{ title() }}</span>
        <span class="chevron" aria-hidden="true">{{ open() ? '▾' : '▸' }}</span>
      </button>
      <div class="collapse-body" [hidden]="!open()"><ng-content /></div>
    </section>
  `,
})
export class Collapsible {
  readonly title = input.required<string>();
  readonly open = model(false);
}
