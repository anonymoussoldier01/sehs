import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useToast } from '../providers';
import { pretty } from '../lib/api';
import { keys, useSyncedLocal } from '../lib/store';
import { LinkPreview } from './ace';

const TYPE_ABBR = { pdf: 'PDF', docx: 'DOC', image: 'IMG', archive: 'ZIP', webpage: 'WEB', code: 'CODE', other: 'FILE' };
const TYPE_LABEL = { pdf: 'PDF', docx: 'Word', image: 'Image', archive: 'Archive', webpage: 'Web page', code: 'Support file', other: 'File' };

export function FileIcon({ type }) {
  return (
    <div
      className="grid h-[52px] w-[46px] flex-none place-items-center rounded-md rounded-tr-xl text-[10px] font-extrabold tracking-wide shadow"
      style={{ background: 'var(--acc-soft)', color: 'var(--acc)', border: '1px solid var(--acc-line)' }}
      aria-hidden="true"
    >
      {TYPE_ABBR[type] || 'FILE'}
    </div>
  );
}

export function useSaved() {
  const [saved, setSaved] = useSyncedLocal(keys.saved, []);
  const toast = useToast();
  const toggle = (id) => {
    setSaved((list) => {
      const has = list.includes(id);
      toast(has ? 'Removed from saved' : 'Saved — find it under Your library');
      return has ? list.filter((x) => x !== id) : [id, ...list].slice(0, 500);
    });
  };
  return { saved: new Set(saved), toggle };
}

export function highlight(text, tokens) {
  const t = String(text ?? '');
  if (!tokens?.length) return t;
  const sorted = [...new Set(tokens.filter((x) => x && x.length >= 2))].sort((a, b) => b.length - a.length);
  if (!sorted.length) return t;
  const parts = t.split(new RegExp(`(${sorted.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'));
  return parts.map((p, i) =>
    sorted.some((s) => p.toLowerCase().startsWith(s.toLowerCase())) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>
  );
}

export function ResourceCard({ v, title, tokens = [], showDesc = true }) {
  const navigate = useNavigate();
  const { saved, toggle } = useSaved();
  const displayTitle = title || v.displayTitle || v.title;
  const subj = v.subject ? pretty(v.subject) : pretty(v.category);
  const readable = v.fileType === 'pdf' || v.fileType === 'image';

  return (
    <article data-result-id={v.id} className="glare flex gap-3.5 rounded-2xl border p-[18px] shadow-sm transition-all hover:-translate-y-[3px] hover:shadow-lg" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      <FileIcon type={v.fileType} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-[15.5px] font-bold leading-snug">
          <LinkPreview
            to={'/r/' + v.id}
            title={displayTitle}
            desc={v.description}
            meta={[subj, v.provider ? pretty(v.provider) : null, v.answersIncluded ? 'Answers included' : null].filter(Boolean).join(' · ')}
          >
            <span className="link-slide transition-colors hover:text-[var(--acc)]">{highlight(displayTitle, tokens)}</span>
          </LinkPreview>
        </h3>
        <div className="text-xs font-semibold" style={{ color: 'var(--mut)' }}>
          {subj}
          {v.provider ? ` › ${pretty(v.provider)}` : ''}
        </div>
        {showDesc && v.description ? (
          <p className="line-clamp-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--mut)' }}>
            {highlight(v.description, tokens)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="secondary">
            {TYPE_LABEL[v.fileType] || v.fileType}
          </Badge>
          {v.answersIncluded && <Badge variant="success">✓ Answers included</Badge>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-dashed pt-2" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--faint)' }}>
            {[v.year, v.sizeBytes ? fmtBytes(v.sizeBytes) : null].filter(Boolean).join(' · ')}
          </span>
          <span className="flex items-center gap-[7px]">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={saved.has(v.id) ? 'default' : 'secondary'}
                  onClick={() => toggle(v.id)}
                  aria-pressed={String(saved.has(v.id))}
                  aria-label={saved.has(v.id) ? 'Remove from saved' : 'Save this resource'}
                  className="h-9 w-9 p-0"
                >
                  <Star className="h-4 w-4" fill={saved.has(v.id) ? 'currentColor' : 'none'} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{saved.has(v.id) ? 'Saved' : 'Save'}</TooltipContent>
            </Tooltip>
            <Button size="sm" variant="secondary" onClick={() => navigate('/r/' + v.id)}>
              {readable ? 'Read' : 'Details'}
            </Button>
          </span>
        </div>
        <Button variant="default" size="sm" onClick={() => navigate('/r/' + v.id)} className="w-full">
          {readable ? 'Read here →' : 'Details →'}
        </Button>
      </div>
    </article>
  );
}

export function fmtBytes(n) {
  n = Number(n);
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

export function Pager({ page, pages, total, per, onPage }) {
  if (pages <= 1) return null;
  const win = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const btn =
    'inline-flex min-h-[40px] min-w-[42px] items-center justify-center rounded-[10px] border px-3 py-2 text-[13.5px] font-bold transition-all hover:-translate-y-px disabled:opacity-45';
  const nums = [];
  let prev = 0;
  for (const p of win) {
    if (p - prev > 1)
      nums.push(
        <span key={'d' + p} className="px-0.5" style={{ color: 'var(--faint)' }}>
          …
        </span>
      );
    nums.push(
      <button
        key={p}
        onClick={() => onPage(p)}
        aria-current={p === page ? 'page' : undefined}
        className={btn}
        style={
          p === page
            ? { background: 'var(--txt)', borderColor: 'var(--txt)', color: 'var(--bg)', fontWeight: 800 }
            : { borderColor: 'var(--line2)', background: 'var(--panel)' }
        }
      >
        {p}
      </button>
    );
    prev = p;
  }
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn} style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }} aria-label="Previous page">
        ← Previous
      </button>
      {nums}
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className={btn} style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }} aria-label="Next page">
        Next →
      </button>
      <span className="ml-2 text-xs tabular-nums" style={{ color: 'var(--faint)' }}>
        Showing {(page - 1) * per + 1}–{Math.min(total, page * per)} of {total.toLocaleString()}
      </span>
    </div>
  );
}
