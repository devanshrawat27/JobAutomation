/**
 * Freshness is a listing rule, not a closure rule.
 *
 * A role can stay open on an employer's board for months. The product only
 * lists the last two weeks of postings, but "not listed any more" must not be
 * written as "closed" — closure means the board stopped carrying it.
 */
export const LISTING_WINDOW_DAYS = 14;

export const LISTING_WINDOW_LABEL = `${LISTING_WINDOW_DAYS} days`;

export function listingCutoff(now: number = Date.now()): Date {
  return new Date(now - LISTING_WINDOW_DAYS * 86_400_000);
}

/** The date a posting is judged by: when it was published, else when we first saw it. */
export function postingDate(postedAt: Date | null | undefined, firstSeenAt: Date): Date {
  return postedAt ?? firstSeenAt;
}

export function isWithinListingWindow(
  posting: { postedAt: Date | null; firstSeenAt: Date },
  now: number = Date.now(),
): boolean {
  return postingDate(posting.postedAt, posting.firstSeenAt).getTime() >= listingCutoff(now).getTime();
}

/** Prisma filter for "listed now", usable inside an `AND` array. */
export function listingWindowWhere(now: number = Date.now()) {
  const cutoff = listingCutoff(now);
  return {
    OR: [{ postedAt: { gte: cutoff } }, { postedAt: null, firstSeenAt: { gte: cutoff } }],
  };
}
