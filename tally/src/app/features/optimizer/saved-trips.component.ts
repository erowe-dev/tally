import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SavedTrip } from '../../core/models';
import { TripsService } from '../../core/services/trips.service';

@Component({
  selector: 'tally-saved-trips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="saved-section" *ngIf="visibleSavedTrips().length > 0 || pendingDeleteTrips().length > 0">
      <div class="saved-section-header">
        <div>
          <span class="section-eyebrow">Saved Trips ({{ visibleSavedTrips().length }})</span>
          <span class="saved-sync-note" *ngIf="trips.localOnlyCount() > 0">
            {{ trips.localOnlyCount() }} waiting to sync
          </span>
        </div>
        <button
          type="button"
          class="clear-all-btn"
          [class.confirm]="clearConfirm()"
          (click)="clearAllTrips()"
          [attr.aria-label]="clearConfirm() ? 'Confirm clearing all saved trips' : 'Clear all saved trips'">
          {{ clearConfirm() ? 'Confirm clear?' : 'Clear all' }}
        </button>
      </div>

      <div class="undo-card" *ngFor="let trip of pendingDeleteTrips()" aria-live="polite">
        <span>{{ trip.programName }} removed</span>
        <button type="button" (click)="undoDeleteTrip(trip.id)">Undo</button>
      </div>

      <div class="saved-card" *ngFor="let trip of visibleSavedTrips()">
        <div class="trip-type-icon">{{ trip.tripType === 'flight' ? 'FL' : 'HT' }}</div>
        <div class="saved-info">
          <div class="saved-program">{{ trip.programName }}</div>
          <div class="local-trip-badge" *ngIf="trip.id.startsWith('local_')">Saved locally</div>
          <div class="saved-meta">
            <ng-container *ngIf="trip.tripType === 'flight'">
              <span *ngIf="trip.origin">{{ trip.origin }} to {{ trip.destination }}</span>
              <span *ngIf="trip.cabin"> · {{ trip.cabin }}</span>
              <span *ngIf="trip.passengers && trip.passengers > 1"> · {{ trip.passengers }}pax</span>
            </ng-container>
            <ng-container *ngIf="trip.tripType === 'hotel'">
              <span *ngIf="trip.destination">{{ trip.destination }} · </span>
              <span *ngIf="trip.hotelCat">{{ trip.hotelCat }}</span>
              <span *ngIf="trip.nights"> · {{ trip.nights }} night{{ trip.nights !== 1 ? 's' : '' }}</span>
            </ng-container>
          </div>

          <div class="saved-note-area">
            <button *ngIf="editingNoteId() !== trip.id"
              type="button"
              class="saved-note-preview"
              [class.has-note]="trip.notes"
              [attr.aria-label]="trip.notes ? 'Edit note for ' + trip.programName : 'Add note for ' + trip.programName"
              (click)="startEditNote(trip.id, trip.notes || '')"
            >
              {{ trip.notes || 'Add a note...' }}
            </button>
            <div class="saved-note-edit" *ngIf="editingNoteId() === trip.id">
              <input class="saved-note-input" [(ngModel)]="pendingNote"
                placeholder="Add a note..." maxlength="500"
                (keyup.enter)="commitNote(trip.id)"
                (keyup.escape)="cancelEditNote()"
                [attr.aria-label]="'Saved trip note for ' + trip.programName">
              <button type="button" class="note-save-btn" (click)="commitNote(trip.id)">Save</button>
              <button type="button" class="note-cancel-btn" (click)="cancelEditNote()" aria-label="Cancel note edit">Cancel</button>
            </div>
          </div>
          <div class="saved-date">{{ formatTripDate(trip.createdAt) }}</div>
        </div>
        <div class="saved-pts">{{ trip.ptsRequired | number }}<small>pts</small></div>
        <div class="saved-actions">
          <button type="button" class="reanalyze-btn" (click)="reanalyze.emit(trip)" [attr.aria-label]="'Re-run analysis for ' + trip.programName">Re-run</button>
          <button type="button" class="delete-btn" (click)="queueDeleteTrip(trip)" [attr.aria-label]="'Remove ' + trip.programName">Remove</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .saved-section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 28px; margin-bottom: 12px;
    }
    .saved-sync-note {
      display: block; margin-top: -4px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.08em; color: var(--tally-amber);
      text-transform: uppercase;
    }
    .clear-all-btn {
      background: none; border: none; font-family: 'Geist Mono', monospace;
      font-size: 9px; letter-spacing: 0.08em; color: var(--text3);
      cursor: pointer; padding: 8px 10px; border-radius: 6px; transition: all 0.15s;
    }
    .clear-all-btn:hover { color: var(--tally-red); }
    .clear-all-btn.confirm {
      color: var(--tally-red); background: rgba(220,38,38,0.08);
      border: 1px solid rgba(220,38,38,0.25);
    }
    .saved-card {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 12px; padding: 12px 14px;
      display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
      scroll-margin-bottom: calc(env(safe-area-inset-bottom, 0px) + 110px);
    }
    .trip-type-icon {
      width: 28px; height: 28px; border-radius: 50%; background: var(--surface);
      color: var(--text3); display: flex; align-items: center; justify-content: center;
      font-family: 'Geist Mono', monospace; font-size: 9px; flex-shrink: 0;
    }
    .saved-info { flex: 1; min-width: 0; }
    .saved-program {
      font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .local-trip-badge {
      display: inline-flex; align-items: center; min-height: 24px; margin-bottom: 3px;
      padding: 3px 7px; border-radius: 999px; background: var(--tally-amber-light);
      color: var(--tally-amber); border: 1px solid rgba(180,83,9,0.24);
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.08em; text-transform: uppercase;
    }
    .undo-card {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      background: var(--tally-amber-light); border: 1px solid rgba(180,83,9,0.24);
      border-radius: 12px; padding: 10px 12px; margin-bottom: 8px;
      color: var(--tally-amber); font-family: 'Geist Mono', monospace;
      font-size: 10px; letter-spacing: 0.04em;
    }
    .undo-card span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .undo-card button {
      background: var(--white); color: var(--tally-amber); flex-shrink: 0;
      border: 1px solid rgba(180,83,9,0.28); border-radius: 8px; padding: 8px 12px;
      cursor: pointer; font-family: 'Geist Mono', monospace; font-size: 10px;
    }
    .saved-meta {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.04em;
      overflow-wrap: anywhere;
    }
    .saved-date {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--border2); letter-spacing: 0.04em; margin-top: 2px;
    }
    .saved-pts {
      font-family: 'Geist Mono', monospace; font-size: 14px;
      color: var(--tally-green); text-align: right; flex-shrink: 0;
    }
    .saved-pts small { display: block; font-size: 9px; color: var(--text3); }
    .saved-actions { display: flex; flex-direction: column; align-items: stretch; gap: 4px; flex-shrink: 0; }
    .reanalyze-btn {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      color: var(--text3); font-size: 10px; line-height: 1;
      min-width: 72px; min-height: 44px; cursor: pointer; padding: 8px 10px; transition: all 0.15s;
      font-family: 'Geist Mono', monospace; letter-spacing: 0.05em;
    }
    .reanalyze-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .delete-btn {
      background: none; border: none; color: var(--text3); font-size: 10px;
      line-height: 1; cursor: pointer; min-width: 72px; min-height: 44px; padding: 8px 10px;
      border-radius: 4px; transition: color 0.15s; flex-shrink: 0;
      font-family: 'Geist Mono', monospace; letter-spacing: 0.05em;
    }
    .delete-btn:hover { color: var(--tally-red); }
    .saved-note-area { margin-top: 4px; }
    .saved-note-preview {
      width: 100%; background: none; border: none; outline: none; cursor: pointer;
      font-family: 'Geist', sans-serif; font-size: 11px; color: var(--text3);
      padding: 8px 0; line-height: 1.4; text-align: left;
      overflow-wrap: anywhere;
    }
    .saved-note-preview.has-note { color: var(--text2); }
    .saved-note-preview:focus-visible {
      border-radius: 6px; box-shadow: 0 0 0 3px rgba(26,122,74,0.16);
    }
    .saved-note-edit { display: flex; gap: 4px; align-items: center; min-width: 0; }
    .saved-note-input {
      flex: 1; background: var(--surface); border: 1.5px solid var(--tally-green);
      border-radius: 7px; font-family: 'Geist', sans-serif; font-size: 11px;
      color: var(--text); padding: 8px; outline: none;
    }
    .note-save-btn {
      background: var(--tally-green); border: none; border-radius: 6px;
      color: white; font-family: 'Geist Mono', monospace; font-size: 9px;
      min-height: 44px; padding: 8px 10px; cursor: pointer; flex-shrink: 0; letter-spacing: 0.06em;
    }
    .note-cancel-btn {
      background: none; border: none; color: var(--text3); font-size: 9px;
      cursor: pointer; min-width: 56px; min-height: 44px; padding: 8px; flex-shrink: 0;
      font-family: 'Geist Mono', monospace; letter-spacing: 0.05em;
    }
    @media (max-width: 430px) {
      .saved-card {
        display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: flex-start;
      }
      .saved-actions {
        grid-column: 1 / -1; flex-direction: row; justify-content: flex-end; width: 100%;
      }
      .saved-note-edit { flex-wrap: wrap; }
      .saved-note-input { flex-basis: 100%; }
      .note-save-btn,
      .note-cancel-btn { flex: 1; }
    }
    @media (min-width: 760px) {
      .saved-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) minmax(88px, auto) auto;
      }
      .saved-actions {
        flex-direction: row;
      }
    }
  `],
})
export class SavedTripsComponent implements OnDestroy {
  @Output() reanalyze = new EventEmitter<SavedTrip>();

  trips = inject(TripsService);
  editingNoteId = signal<string | null>(null);
  pendingNote = '';
  clearConfirm = signal(false);
  pendingDeletes = signal<Record<string, SavedTrip>>({});

  private clearConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  private deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly pendingDeleteTrips = computed(() => Object.values(this.pendingDeletes()));
  readonly visibleSavedTrips = computed(() => {
    const pending = this.pendingDeletes();
    return this.trips.trips().filter(t => !pending[t.id]);
  });

  ngOnDestroy(): void {
    if (this.clearConfirmTimer) clearTimeout(this.clearConfirmTimer);
    this.deleteTimers.forEach(timer => clearTimeout(timer));
    this.deleteTimers.clear();
  }

  startEditNote(tripId: string, currentNote: string): void {
    this.pendingNote = currentNote;
    this.editingNoteId.set(tripId);
  }

  commitNote(tripId: string): void {
    this.trips.updateNotes(tripId, this.pendingNote.trim());
    this.editingNoteId.set(null);
  }

  cancelEditNote(): void {
    this.pendingNote = '';
    this.editingNoteId.set(null);
  }

  queueDeleteTrip(trip: SavedTrip): void {
    if (this.deleteTimers.has(trip.id)) return;
    if (this.editingNoteId() === trip.id) this.cancelEditNote();
    this.pendingDeletes.update(pending => ({ ...pending, [trip.id]: trip }));
    const timer = setTimeout(() => {
      this.pendingDeletes.update(pending => {
        const next = { ...pending };
        delete next[trip.id];
        return next;
      });
      this.deleteTimers.delete(trip.id);
      this.trips.deleteTrip(trip.id);
    }, 5000);
    this.deleteTimers.set(trip.id, timer);
  }

  undoDeleteTrip(tripId: string): void {
    const timer = this.deleteTimers.get(tripId);
    if (timer) clearTimeout(timer);
    this.deleteTimers.delete(tripId);
    this.pendingDeletes.update(pending => {
      const next = { ...pending };
      delete next[tripId];
      return next;
    });
  }

  clearAllTrips(): void {
    if (!this.clearConfirm()) {
      this.clearConfirm.set(true);
      if (this.clearConfirmTimer) clearTimeout(this.clearConfirmTimer);
      this.clearConfirmTimer = setTimeout(() => this.clearConfirm.set(false), 3000);
      return;
    }

    if (this.clearConfirmTimer) clearTimeout(this.clearConfirmTimer);
    this.clearConfirmTimer = null;
    this.clearConfirm.set(false);
    this.deleteTimers.forEach(timer => clearTimeout(timer));
    this.deleteTimers.clear();
    this.pendingDeletes.set({});
    this.cancelEditNote();
    this.trips.clearAll();
  }

  formatTripDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  }
}
