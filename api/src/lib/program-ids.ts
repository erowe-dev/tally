export const KNOWN_PROGRAM_IDS = [
  'amex_mr',
  'chase_ur',
  'citi_ty',
  'cap1_miles',
  'bilt',
  'delta_skymiles',
  'united_mp',
  'aa_aadvantage',
  'southwest_rr',
  'alaska_mp',
  'marriott_bonvoy',
  'hyatt',
  'hilton_honors',
  'ihg_rewards',
] as const;

export const KNOWN_PROGRAM_ID_SET = new Set<string>(KNOWN_PROGRAM_IDS);

export type ProgramIdParseResult = { data: string[] } | { error: string };

export function parseProgramIdArray(value: unknown, maxItems: number = KNOWN_PROGRAM_IDS.length): ProgramIdParseResult {
  if (!Array.isArray(value)) return { error: 'Expected an array of program IDs' };
  if (value.length > maxItems) return { error: `Array must contain ${maxItems} or fewer items` };

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return { error: 'Program IDs must be strings' };
    const id = item.trim();
    if (!id) continue;
    if (!KNOWN_PROGRAM_ID_SET.has(id)) return { error: `Unknown program id: ${id}` };
    result.push(id);
  }

  return { data: [...new Set(result)] };
}

export function knownProgramIdsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => KNOWN_PROGRAM_ID_SET.has(item)))];
}
