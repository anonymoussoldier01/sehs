import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Checkbox } from '@heroui/react/checkbox';
import { ListBox } from '@heroui/react/list-box';
import { ListBoxItem } from '@heroui/react/list-box-item';
import { Select } from '@heroui/react/select';
import { api, pretty } from '../lib/api';
import { bumpInsight } from '../lib/store';
import { BlurFade, Empty, Skeleton, AnimatedGrid } from '../components/magic';
import { Pager, ResourceCard, highlight } from '../components/cards';

const TYPE_LABEL = { pdf: 'PDF', docx: 'Word', image: 'Image', archive: 'Archive', webpage: 'Web page', code: 'Support file', other: 'File' };

function tokensOf(q) {
  return [...new Set(String(q || '').toLowerCase().split(/\s+/).filter((t) => t.length >= 2))];
}

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') || '';
  const cats = (sp.get('cat') || '').split(',').filter(Boolean);
  const provs = (sp.get('provider') || '').split(',').filter(Boolean);
  const types = (sp.get('type') || '').split(',').filter(Boolean);
  const sort = sp.get('sort') || 'relevance';
  const answers = sp.get('answers') === '1';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('sehs-view') || 'grid';
    } catch {
      return 'grid';
    }
  });
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem('sehs-density') === 'compact';
    } catch {
      return false;
    }
  });
  const [data, setData] = useState(null);
  const [facets, setFacets] = useState({ cats: [], provs: [], types: [] });
  const [loading, setLoading] = useState(true);

  const set = (patch) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || (Array.isArray(v) && !v.length)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(',') : v);
    }
    next.delete('page');
    setSp(next, { replace: false });
  };

  useEffect(() => {
    document.title = q ? `Results for “${q}” — SEHS Study` : 'Browse resources — SEHS Study';
  }, [q]);

  useEffect(() => {
    setLoading(true);
    let live = true;
    const params = { q, per: 24, page, sort };
    if (cats.length) params.cat = cats.join(',');
    if (provs.length) params.provider = provs.join(',');
    if (answers) params.answers = '1';
    api
      .search(params)
      .then((j) => {
        if (!live) return;
        let results = j.results || [];
        if (types.length) results = results.filter((r) => types.includes(r.fileType));
        setData({ ...j, results });
        const cc = new Map();
        const pc = new Map();
        const tc = new Map();
        for (const r of j.results || []) {
          cc.set(r.category, (cc.get(r.category) || 0) + 1);
          for (const t of r.tags || []) {
            if (['acer', 'vsse', 'jac', 'capricorn', 'pearson'].includes(t)) pc.set(t, (pc.get(t) || 0) + 1);
          }
          tc.set(r.fileType, (tc.get(r.fileType) || 0) + 1);
        }
        setFacets({
          cats: [...cc.entries()].sort((a, b) => b[1] - a[1]),
          provs: [...pc.entries()].sort((a, b) => b[1] - a[1]),
          types: [...tc.entries()].sort((a, b) => b[1] - a[1]),
        });
        setLoading(false);
        if (q.trim()) bumpInsight('searches');
      })
      .catch(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  const tokens = useMemo(() => tokensOf(q), [q]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 24));

  const toggleMulti = (key, cur, v) => {
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    set({ [key]: next });
  };

  const check = (label, count, checked, onChange) => (
    <Checkbox key={label} isSelected={checked} onChange={onChange} className="min-h-[40px] px-2 py-2 text-[13.5px]">
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      <span className="truncate">{label}</span>
      <span
        className="ml-auto flex-none rounded-full border px-2 py-0.5 text-[11px] tabular-nums"
        style={{ background: 'var(--bg2)', borderColor: 'var(--line)', color: 'var(--faint)' }}
      >
        {Number(count || 0).toLocaleString()}
      </span>
    </Checkbox>
  );

  return (
    <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-start gap-5 px-4 pb-14 pt-2.5 sm:px-6 lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="rounded-2xl border p-4 shadow-sm lg:sticky lg:top-[78px] lg:max-h-[calc(100vh-100px)] lg:overflow-auto" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }} aria-label="Filters">
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="m-0 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.08em]" style={{ color: 'var(--mut)' }}>
            Filters
          </h2>
          <Link to={q ? `/search?q=${encodeURIComponent(q)}` : '/search'} className="rounded-md px-1.5 py-2 text-[13.5px] font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>
            Clear all
          </Link>
        </div>
        <details className="border-t border-dashed py-3" style={{ borderColor: 'var(--line2)' }} open>
          <summary className="flex min-h-[36px] cursor-pointer items-center justify-between rounded-lg px-0.5 text-[13.5px] font-bold">Category</summary>
          <div className="mt-1.5 flex max-h-[224px] flex-col gap-[1px] overflow-auto">
            {facets.cats.map(([v, c]) => check(pretty(v), c, cats.includes(v), () => toggleMulti('cat', cats, v)))}
          </div>
        </details>
        <details className="border-t border-dashed py-3" style={{ borderColor: 'var(--line2)' }} open>
          <summary className="flex min-h-[36px] cursor-pointer items-center justify-between rounded-lg px-0.5 text-[13.5px] font-bold">Provider</summary>
          <div className="mt-1.5 flex max-h-[224px] flex-col gap-[1px] overflow-auto">
            {facets.provs.map(([v, c]) => check(pretty(v), c, provs.includes(v), () => toggleMulti('provider', provs, v)))}
          </div>
        </details>
        <details className="border-t border-dashed py-3" style={{ borderColor: 'var(--line2)' }} open>
          <summary className="flex min-h-[36px] cursor-pointer items-center justify-between rounded-lg px-0.5 text-[13.5px] font-bold">File type</summary>
          <div className="mt-1.5 flex max-h-[224px] flex-col gap-[1px] overflow-auto">
            {facets.types.map(([v, c]) => check(TYPE_LABEL[v] || v, c, types.includes(v), () => toggleMulti('type', types, v)))}
          </div>
        </details>
        <details className="border-t border-dashed py-3" style={{ borderColor: 'var(--line2)' }}>
          <summary className="flex min-h-[36px] cursor-pointer items-center justify-between rounded-lg px-0.5 text-[13.5px] font-bold">More options</summary>
          <Checkbox isSelected={answers} onChange={(v) => set({ answers: v ? '1' : '' })} className="min-h-[40px] px-2 py-2 text-[13.5px]">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Answers included
          </Checkbox>
        </details>
      </aside>

      <main aria-label="Results">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-[3px] pt-0.5">
            <span className="font-display text-[19px] font-bold">
              {loading ? 'Searching…' : total === 0 ? 'No results' : `${total.toLocaleString()} resource${total === 1 ? '' : 's'} found${q ? ` for “${q}”` : ''}`}
            </span>
            {!!data && total > 0 && (data.mode === 'partial' || data.mode === 'fuzzy') && (
              <span className="inline-block rounded-[10px] border border-dashed px-2.5 py-[7px] text-[13px] font-semibold" style={{ color: 'var(--warn, #92400e)', background: 'var(--warn-bg, #fdf0d8)', borderColor: 'var(--amber, #b45309)' }}>
                {data.mode === 'fuzzy' && data.corrected ? `Showing results for “${data.corrected}”. ` : 'No exact matches — showing closest matches. '}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setCompact((c) => {
                  try {
                    localStorage.setItem('sehs-density', !c ? 'compact' : 'comfortable');
                  } catch {
                    /* noop */
                  }
                  return !c;
                });
              }}
            >
              {compact ? 'Comfortable' : 'Compact'}
            </Button>
            <Button
              size="sm"
              variant={answers ? 'primary' : 'secondary'}
              onPress={() => set({ answers: answers ? '' : '1' })}
              aria-pressed={String(answers)}
            >
              {answers ? '✓ Answers' : 'Answers'}
            </Button>
            <div className="flex gap-0.5 rounded-[11px] border p-[3px] shadow-sm" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }} role="group" aria-label="View">
              {[
                ['grid', '▦', 'Grid view'],
                ['list', '☰', 'List view'],
              ].map(([v, ico, label]) => (
                <button
                  key={v}
                  aria-label={label}
                  aria-pressed={String(view === v)}
                  onClick={() => {
                    setView(v);
                    try {
                      localStorage.setItem('sehs-view', v);
                    } catch {
                      /* noop */
                    }
                  }}
                  className="grid min-h-[36px] min-w-[44px] place-items-center rounded-lg px-3 text-[15px] transition-all"
                  style={view === v ? { background: 'var(--txt)', color: 'var(--bg)' } : { color: 'var(--mut)' }}
                >
                  {ico}
                </button>
              ))}
            </div>
            <Select
              aria-label="Sort results"
              selectedKey={sort}
              onSelectionChange={(k) => set({ sort: k === 'relevance' ? '' : String(k) })}
              className="w-[150px]"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-label="Sort options">
                  {[
                    ['relevance', 'Best match'],
                    ['title-az', 'A–Z'],
                    ['title-za', 'Z–A'],
                    ['newest', 'Newest'],
                    ['type', 'File type'],
                    ['answers', 'Answers first'],
                  ].map(([v, l]) => (
                    <ListBoxItem key={v} id={v} textValue={l}>
                      {l}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className={`grid gap-3.5 ${view === 'list' ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : total === 0 ? (
          <Empty
            title="No exact matches"
            msg={q ? `Nothing matched “${q}” with the current filters. Try a broader search or one of these:` : 'Nothing matched the current filters.'}
          >
            {data?.corrected && (
              <div className="mx-auto mt-4 inline-block rounded-[10px] border border-dashed px-4 py-2 text-sm font-semibold" style={{ color: 'var(--warn, #92400e)', background: 'var(--warn-bg, #fdf0d8)' }}>
                Did you mean:{' '}
                <button
                  className="font-extrabold underline"
                  style={{ color: 'var(--acc)' }}
                  onClick={() => {
                    const next = new URLSearchParams(sp);
                    next.set('q', data.corrected);
                    next.delete('page');
                    setSp(next);
                  }}
                >
                  “{data.corrected}”
                </button>
                ?
              </div>
            )}
            <div className="mt-3 text-[13px]">
              <span className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--faint)' }}>
                Try:{' '}
              </span>
              {[['vsse', 'VSSE'], ['maths answers', 'Maths + answers'], ['numerical reasoning', 'Numerical'], ['reading comprehension', 'Reading']].map(([qq, l]) => (
                <button
                  key={qq}
                  onClick={() => {
                    const next = new URLSearchParams();
                    next.set('q', qq);
                    setSp(next);
                  }}
                  className="m-[3px] inline-flex min-h-[38px] items-center rounded-full border px-[15px] py-2 text-[13px] font-bold transition-all hover:-translate-y-px"
                  style={{ borderColor: 'var(--line2)' }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <Link to="/search" className="inline-flex min-h-[42px] items-center rounded-[11px] bg-[#2f49e5] px-[18px] py-2.5 text-sm font-bold text-white">
                Clear search &amp; filters
              </Link>
            </div>
          </Empty>
        ) : (
          <>
            <AnimatedGrid className={`grid gap-3.5 ${view === 'list' || compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
              {(data.results || []).map((v, i) => (
                <BlurFade key={v.id} delay={Math.min(i, 6) * 0.04}>
                  <ResourceCard v={v} title={v.displayTitle} tokens={tokens} showDesc={!compact} />
                </BlurFade>
              ))}
            </AnimatedGrid>
            <Pager
              page={page}
              pages={pages}
              total={total}
              per={24}
              onPage={(p) => {
                const next = new URLSearchParams(sp);
                next.set('page', p);
                setSp(next);
                document.getElementById('main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
