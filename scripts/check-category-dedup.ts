// Asserts that the module-level cache in src/hooks/useCategories.ts collapses
// concurrent reads onto ONE network request.
//
// Nine ContainerBlocks plus ArticlesTab each call useCategories(), so an
// uncached hook fired TEN identical GET /api/categories per page load. The
// subtle part is the invalidation path: a `force` flag that bypassed the
// in-flight guard would restore the ten-request behaviour after every container
// rename - precisely when all ten hooks refresh at once. This replicates the
// cache logic and counts fetches for both paths.
//
// The logic is duplicated here rather than imported because the hook module is
// "use client" and importing React/window into a tsx-run script is not worth it;
// if you change fetchCategories(), mirror it here.

let cached: unknown[] | null = null;
let inFlight: Promise<unknown[] | null> | null = null;
let fetchCount = 0;

function fakeFetch(): Promise<unknown[]> {
  fetchCount++;
  return new Promise(resolve => setTimeout(() => resolve([{ slug: 'history' }]), 10));
}

function fetchCategories(): Promise<unknown[] | null> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  const p = fakeFetch()
    .then(list => {
      cached = list;
      return cached;
    })
    .finally(() => {
      inFlight = null;
    });
  inFlight = p;
  return p;
}

async function main() {
  let failures = 0;
  const expect = (label: string, got: number, want: number) => {
    const ok = got === want;
    if (!ok) failures++;
    console.log(`${ok ? '  ok  ' : ' FAIL '}${label.padEnd(44)} ${got} fetch(es)${ok ? '' : `, want ${want}`}`);
  };

  // 10 hooks mounting in the same tick
  fetchCount = 0;
  await Promise.all(Array.from({ length: 10 }, () => fetchCategories()));
  expect('10 concurrent mounts', fetchCount, 1);

  // a later mount reads the cache
  fetchCount = 0;
  await fetchCategories();
  expect('mount after cache is warm', fetchCount, 0);

  // ensureCategory(): clears the cache, then all 10 refresh
  fetchCount = 0;
  cached = null;
  await Promise.all(Array.from({ length: 10 }, () => fetchCategories()));
  expect('10 refreshes after a rename', fetchCount, 1);

  console.log(`\n${failures} failure(s).`);
  process.exit(failures ? 1 : 0);
}

main();
