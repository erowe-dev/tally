import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SavedTrip } from '../../core/models';
import { TripsService } from '../../core/services/trips.service';
import { SavedTripsComponent } from './saved-trips.component';

class MockTripsService {
  trips = signal<SavedTrip[]>([]);
  localOnlyCount = signal(0);
  deleteTrip = jasmine.createSpy('deleteTrip');
  updateNotes = jasmine.createSpy('updateNotes');
  clearAll = jasmine.createSpy('clearAll');
}

describe('SavedTripsComponent', () => {
  let fixture: ComponentFixture<SavedTripsComponent>;
  let trips: MockTripsService;

  const savedTrip: SavedTrip = {
    id: 'trip_1',
    tripType: 'flight',
    origin: 'ORD',
    destination: 'LHR',
    cabin: 'business',
    passengers: 1,
    programName: 'Virgin Atlantic Flying Club',
    ptsRequired: 50000,
    createdAt: '2026-05-18T00:00:00.000Z',
  };

  beforeEach(async () => {
    trips = new MockTripsService();
    trips.trips.set([savedTrip]);

    await TestBed.configureTestingModule({
      imports: [SavedTripsComponent],
      providers: [
        { provide: TripsService, useValue: trips },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SavedTripsComponent);
    fixture.detectChanges();
  });

  it('keeps a queued delete undoable before the timer commits', fakeAsync(() => {
    const component = fixture.componentInstance;

    component.queueDeleteTrip(savedTrip);

    expect(component.visibleSavedTrips()).toEqual([]);
    expect(component.pendingDeleteTrips()).toEqual([savedTrip]);

    tick(4999);
    expect(trips.deleteTrip).not.toHaveBeenCalled();

    tick(1);
    expect(trips.deleteTrip).toHaveBeenCalledOnceWith('trip_1');
    expect(component.pendingDeleteTrips()).toEqual([]);
  }));

  it('cancels a queued delete when the user taps undo', fakeAsync(() => {
    const component = fixture.componentInstance;

    component.queueDeleteTrip(savedTrip);
    component.undoDeleteTrip('trip_1');
    tick(5000);

    expect(trips.deleteTrip).not.toHaveBeenCalled();
    expect(component.visibleSavedTrips()).toEqual([savedTrip]);
    expect(component.pendingDeleteTrips()).toEqual([]);
  }));

  it('clears pending timers on destroy', fakeAsync(() => {
    const component = fixture.componentInstance;

    component.queueDeleteTrip(savedTrip);
    fixture.destroy();
    tick(5000);

    expect(trips.deleteTrip).not.toHaveBeenCalled();
  }));

  it('requires confirmation before clearing all saved trips', fakeAsync(() => {
    const component = fixture.componentInstance;

    component.clearAllTrips();

    expect(component.clearConfirm()).toBeTrue();
    expect(trips.clearAll).not.toHaveBeenCalled();

    component.clearAllTrips();

    expect(trips.clearAll).toHaveBeenCalled();
    expect(component.clearConfirm()).toBeFalse();
  }));

  it('clears queued deletes and note edits when clear all is confirmed', fakeAsync(() => {
    const component = fixture.componentInstance;

    component.startEditNote('trip_1', 'draft');
    component.queueDeleteTrip(savedTrip);
    component.clearAllTrips();
    component.clearAllTrips();
    tick(5000);

    expect(trips.clearAll).toHaveBeenCalled();
    expect(trips.deleteTrip).not.toHaveBeenCalled();
    expect(component.pendingDeleteTrips()).toEqual([]);
    expect(component.editingNoteId()).toBeNull();
  }));

  it('trims saved notes before persisting', () => {
    const component = fixture.componentInstance;

    component.startEditNote('trip_1', ' old ');
    component.pendingNote = '  window seats if possible  ';
    component.commitNote('trip_1');

    expect(trips.updateNotes).toHaveBeenCalledOnceWith('trip_1', 'window seats if possible');
    expect(component.editingNoteId()).toBeNull();
  });

  it('resets clear confirmation when the user waits', fakeAsync(() => {
    const component = fixture.componentInstance;

    component.clearAllTrips();
    tick(3000);

    expect(component.clearConfirm()).toBeFalse();
    expect(trips.clearAll).not.toHaveBeenCalled();
  }));
});
