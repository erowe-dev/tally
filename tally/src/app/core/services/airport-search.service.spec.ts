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
});
