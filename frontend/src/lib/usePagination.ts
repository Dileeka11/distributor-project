import { useMemo, useState } from 'react';

/**
 * Client-side paging for a table.
 *
 * Give it the full (already filtered) list and a key describing the filters
 * behind it; when that key changes the list is a different one, so paging
 * starts again from the first page. The reset happens during render — React's
 * documented alternative to a setState-in-an-effect, which would render the
 * stale page once before correcting itself.
 *
 * The page is also clamped to the last page that still has rows, so deleting
 * the only row on the final page never leaves an empty table behind.
 *
 * Spread `props` straight onto <Pagination /> and render `slice`.
 */
export function usePagination<T>(items: T[], resetKey: string | number = '', defaultPerPage = 25) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPerPage);
  const [seenKey, setSeenKey] = useState(resetKey);

  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, totalPages);
  const slice = useMemo(
    () => items.slice((current - 1) * perPage, current * perPage),
    [items, current, perPage],
  );

  return {
    slice,
    page: current,
    perPage,
    setPage,
    setPerPage,
    /** Props for <Pagination {...pager.props} />. */
    props: {
      totalItems: items.length,
      currentPage: current,
      itemsPerPage: perPage,
      onPageChange: setPage,
      onItemsPerPageChange: setPerPage,
    },
  };
}
