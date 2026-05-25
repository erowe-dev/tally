import { Injectable, computed, signal } from '@angular/core';
import { AIRPORTS } from '../data/airports';
import { AirportOption } from '../models';

const RECENT_KEY = 'tally_recent_airports_v1';
const TEMPLATE_KEY = 'tally_route_templates_v1';
const MAX_RECENT = 8;
const DEFAULT_LIMIT = 8;

export interface RouteTemplate {
  id: string;
  label: string;
  originAirport: string;
  destination: string;
  destinationAirport?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AirportSearchService {
  private _recentCodes = signal<string[]>(this.loadRecentCodes());
  private _routeTemplates = signal<RouteTemplate[]>(this.loadRouteTemplates());

  readonly airports = signal<readonly AirportOption[]>(AIRPORTS).asReadonly();
  readonly recentAirports = computed(() =>
    this._recentCodes()
      .map(code => this.findByCode(code))
      .filter((airport): airport is AirportOption => airport !== undefined),
  );
  readonly routeTemplates = this._routeTemplates.asReadonly();

  search(query: string, limit = DEFAULT_LIMIT): AirportOption[] {
    const normalized = normalize(query);
    if (!normalized) {
      return this.recentAirports().slice(0, limit);
    }

    return [...AIRPORTS]
      .map(airport => ({ airport, score: scoreAirport(airport, normalized) }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || a.airport.code.localeCompare(b.airport.code))
      .slice(0, limit)
      .map(result => result.airport);
  }

  findByCode(code: string): AirportOption | undefined {
    const normalized = code.trim().toUpperCase();
    return AIRPORTS.find(airport => airport.code === normalized);
  }

  rememberAirport(code: string): void {
    const airport = this.findByCode(code);
    if (!airport) return;

    const updated = [
      airport.code,
      ...this._recentCodes().filter(existing => existing !== airport.code),
    ].slice(0, MAX_RECENT);
    this._recentCodes.set(updated);
    this.saveRecentCodes(updated);
  }

  saveRouteTemplate(template: Omit<RouteTemplate, 'id' | 'createdAt'>): RouteTemplate {
    const saved: RouteTemplate = {
      ...template,
      id: `local_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [saved, ...this._routeTemplates()];
    this._routeTemplates.set(updated);
    this.saveRouteTemplates(updated);
    return saved;
  }

  deleteRouteTemplate(id: string): void {
    const updated = this._routeTemplates().filter(template => template.id !== id);
    this._routeTemplates.set(updated);
    this.saveRouteTemplates(updated);
  }

  private loadRecentCodes(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((code): code is string => typeof code === 'string');
    } catch {
      return [];
    }
  }

  private saveRecentCodes(codes: string[]): void {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(codes));
    } catch {}
  }

  private loadRouteTemplates(): RouteTemplate[] {
    try {
      const raw = localStorage.getItem(TEMPLATE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isRouteTemplate);
    } catch {
      return [];
    }
  }

  private saveRouteTemplates(templates: RouteTemplate[]): void {
    try {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
    } catch {}
  }
}

function scoreAirport(airport: AirportOption, query: string): number {
  const code = normalize(airport.code);
  const city = normalize(airport.city);
  const name = normalize(airport.name);
  const country = normalize(airport.country);
  const aliases = airport.aliases?.map(normalize) ?? [];

  if (code === query) return 100;
  if (code.startsWith(query)) return 90;
  if (city === query) return 80;
  if (city.startsWith(query)) return 70;
  if (aliases.some(alias => alias === query)) return 65;
  if (aliases.some(alias => alias.includes(query))) return 55;
  if (name.includes(query)) return 45;
  if (country.includes(query)) return 25;
  return 0;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function isRouteTemplate(value: unknown): value is RouteTemplate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as RouteTemplate;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.originAirport === 'string' &&
    typeof candidate.destination === 'string' &&
    typeof candidate.createdAt === 'string' &&
    (candidate.destinationAirport === undefined || typeof candidate.destinationAirport === 'string')
  );
}
