import type { Rng } from "./rng";

export const ID_PREFIXES = {
  user: "usr_",
  student: "stu_",
  cohort: "coh_",
  session: "ses_",
  attempt: "att_",
  event: "evt_",
  decision: "dec_",
  itemInstance: "itm_",
  quest: "qst_",
  boss: "bos_",
  solveThread: "slv_",
  flag: "flg_",
} as const;

export type IdEntity = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdEntity];

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const VALID_PREFIX_SET = new Set<string>(Object.values(ID_PREFIXES));

/** Generate a pure 26-character Crockford Base32 ULID from timestampMs and a seeded RNG. */
export function makeUlid(timestampMs: number, rng: Rng): string {
  if (!Number.isInteger(timestampMs) || timestampMs < 0) {
    throw new RangeError(`Invalid ULID timestampMs: ${timestampMs}`);
  }
  const timeChars = new Array<string>(10);
  let t = timestampMs;
  for (let i = 9; i >= 0; i--) {
    const ch = CROCKFORD[t % 32];
    if (ch === undefined) {
      throw new Error("Crockford encoding failure");
    }
    timeChars[i] = ch;
    t = Math.floor(t / 32);
  }

  const randChars = new Array<string>(16);
  for (let i = 0; i < 16; i++) {
    const ch = CROCKFORD[rng.int(0, 31)];
    if (ch === undefined) {
      throw new Error("Crockford encoding failure");
    }
    randChars[i] = ch;
  }

  return `${timeChars.join("")}${randChars.join("")}`;
}

/** Generate a prefixed domain ULID (pure; caller supplies clock and RNG). */
export function makeId(entity: IdEntity, timestampMs: number, rng: Rng): string {
  return `${ID_PREFIXES[entity]}${makeUlid(timestampMs, rng)}`;
}

/** Validate a prefixed domain ULID, optionally requiring a specific entity prefix. */
export function isValidPrefixedId(id: string, entity?: IdEntity): boolean {
  if (id.length !== 30) {
    return false;
  }
  const prefix = id.slice(0, 4);
  const body = id.slice(4);
  if (entity !== undefined) {
    return prefix === ID_PREFIXES[entity] && ULID_RE.test(body);
  }
  return VALID_PREFIX_SET.has(prefix) && ULID_RE.test(body);
}
