import { Injectable, computed, signal } from '@angular/core';
import { AIRPORTS } from '../data/airports';
import { AirportOption } from '../models';

const RECENT_KEY = 'tally_recent_airports_v1';
const TEMPLATE_KEY = 'tally_route_templates_v1';
const MAX_RECENT = 8;
const MAX_TEMPLATES = 12;
const MAX_TEMPLATE_LABEL_LENGTH = 80;
const MAX_TEMPLATE_DESTINATION_LENGTH = 80;
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
      const codes = this.sanitizeRecentCodes(parsed);
      this.saveRecentCodes(codes);
      return codes;
    } catch {
      return [];
    }
  }

  private sanitizeRecentCodes(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value
      .filter((code): code is string => typeof code === 'string')
      .map(code => code.trim().toUpperCase())
      .filter(code => this.findByCode(code) !== undefined))]
      .slice(0, MAX_RECENT);
  }

  private saveRecentCodes(codes: string[]): void {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.sanitizeRecentCodes(codes)));
    } catch {}
  }

  private loadRouteTemplates(): RouteTemplate[] {
    try {
      const raw = localStorage.getItem(TEMPLATE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      const templates = this.sanitizeRouteTemplates(parsed);
      this.saveRouteTemplates(templates);
      return templates;
    } catch {
      return [];
    }
  }

  private sanitizeRouteTemplates(value: unknown): RouteTemplate[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const templates: RouteTemplate[] = [];
    for (const candidate of value) {
      const template = this.sanitizeRouteTemplate(candidate);
      if (!template || seen.has(template.id)) continue;
      seen.add(template.id);
      templates.push(template);
      if (templates.length >= MAX_TEMPLATES) break;
    }
    return templates;
  }

  private sanitizeRouteTemplate(value: unknown): RouteTemplate | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as RouteTemplate;
    const id = cleanTemplateText(candidate.id, 60);
    const label = cleanTemplateText(candidate.label, MAX_TEMPLATE_LABEL_LENGTH);
    const originAirport = cleanAirportCode(candidate.originAirport);
    const destination = cleanTemplateText(candidate.destination, MAX_TEMPLATE_DESTINATION_LENGTH);
    const destinationAirport = cleanAirportCode(candidate.destinationAirport);
    const createdAt = cleanIsoDate(candidate.createdAt);

    if (!id || !label || !originAirport || !destination || !createdAt || !this.findByCode(originAirport)) return null;
    if (destinationAirport && !this.findByCode(destinationAirport)) return null;

    return {
      id,
      label,
      originAirport,
      destination,
      ...(destinationAirport ? { destinationAirport } : {}),
      createdAt,
    };
  }

  private saveRouteTemplates(templates: RouteTemplate[]): void {
    try {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(this.sanitizeRouteTemplates(templates)));
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

function cleanTemplateText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanAirportCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  const code = value.trim().toUpperCase();
  return code.length === 3 ? code : '';
}

function cleanIsoDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
