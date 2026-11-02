/**
 * Which posting rows a viewer may see.
 *
 * Public employer-board rows have no owner and are shared. A row with an owner
 * exists only because that candidate supplied the material (pasted post,
 * browser capture, or a link they imported), so it is visible to them alone.
 */
export function visiblePostings(viewerId: string | null) {
  return viewerId
    ? { OR: [{ ownerUserId: null }, { ownerUserId: viewerId }] }
    : { ownerUserId: null };
}
