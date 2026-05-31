import { TestBed } from '@angular/core/testing';
import { AirportSearchService } from './airport-search.service';

describe('AirportSearchService', () => {
  let service: AirportSearchService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [AirportSearchService] });
    service = TestBed.inject(AirportSearchService);
  });

  it('finds airports by IATA code', () => {
    expect(service.findByCode('oma')?.city).toBe('Omaha');
    expect(service.findByCode('NRT')?.city).toBe('Tokyo');
  });

  it('searches city, airport name, and aliases offline from the bundled dataset', () => {
    expect(service.search('tokyo').map(airport => airport.code)).toContain('HND');
    expect(service.search('changi')[0].code).toBe('SIN');
    expect(service.search('nyc').map(airport => airport.code)).toEqual(['EWR', 'JFK', 'LGA']);
  });

  it('persists recent airports and route templates locally', () => {
    service.rememberAirport('OMA');
    service.rememberAirport('LHR');
    const template = service.saveRouteTemplate({
      label: 'Omaha to Europe',
      originAirport: 'OMA',
      destination: 'Europe',
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [AirportSearchService] });
    const restored = TestBed.inject(AirportSearchService);

    expect(restored.recentAirports().map(airport => airport.code)).toEqual(['LHR', 'OMA']);
    expect(restored.routeTemplates()[0].id).toBe(template.id);
  });

  it('rewrites malformed recent airports and route templates from storage', () => {
    localStorage.setItem('tally_recent_airports_v1', JSON.stringify([' oma ', 'XXX', 'LHRX', 'LHR', 'OMA', 42]));
    localStorage.setItem('tally_route_templates_v1', JSON.stringify([
      {
        id: ' route_1 ',
        label: ` ${'Omaha to London '.repeat(8)} `,
        originAirport: ' oma ',
        destination: ` ${'London '.repeat(20)} `,
        destinationAirport: ' lhr ',
        createdAt: '2026-05-31T12:00:00.000Z',
        extra: 'ignored',
      },
      {
        id: 'bad_origin',
        label: 'Bad origin',
        originAirport: 'XXX',
        destination: 'Nowhere',
        createdAt: '2026-05-31T12:00:00.000Z',
      },
    ]));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [AirportSearchService] });
    const restored = TestBed.inject(AirportSearchService);

    expect(restored.recentAirports().map(airport => airport.code)).toEqual(['OMA', 'LHR']);
    expect(JSON.parse(localStorage.getItem('tally_recent_airports_v1') ?? '[]')).toEqual(['OMA', 'LHR']);
    expect(restored.routeTemplates()).toEqual([
      {
        id: 'route_1',
        label: 'Omaha to London Omaha to London Omaha to London Omaha to London Omaha to London ',
        originAirport: 'OMA',
        destination: 'London London London London London London London London London London London Lon',
        destinationAirport: 'LHR',
        createdAt: '2026-05-31T12:00:00.000Z',
      },
    ]);
  });
});
