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
