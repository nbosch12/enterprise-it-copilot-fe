import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Severity } from '../../models/answer';

/** Coloured pill for `severity` / `priority` values, e.g. "Low severity". */
@Component({
  selector: 'app-severity-badge',
  template: `<span class="severity-dot" aria-hidden="true"></span>{{ severity().label }}`,
  styleUrl: './severity-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-level]': 'severity().level'
  }
})
export class SeverityBadge {
  readonly severity = input.required<Severity>();
}
